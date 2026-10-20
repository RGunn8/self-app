// In-memory snapshot of the local database, reloaded whenever SQLite reports a write.
// Screens select from it and derive scores with the pure functions in each feature’s domain.ts.
import { isNull } from 'drizzle-orm';
import { create } from 'zustand';

import { identities, type Identity, pauses, type Pause } from '@/features/identities/model';
import { entries, type Entry } from '@/features/logging/model';
import { type EntryPoint, toEntryPoint } from '@/features/metrics/domain';
import { type Plan, plans } from '@/features/planning/model';
import { identityMetrics, type IdentityMetric, metrics, type Metric } from '@/features/metrics/model';
import { type Settings } from '@/features/settings/model';
import { DEFAULT_SETTINGS, settingsRepo } from '@/features/settings/repo';
import { systemCompletions, type SystemCompletion, systemIdentities, type SystemIdentity, systems, type System, systemSteps, type SystemStep } from '@/features/systems/model';
import { db, onDatabaseChange } from '@/shared/db/client';

export interface Snapshot {
  ready: boolean;
  version: number;
  identities: Identity[];
  metrics: Metric[];
  links: IdentityMetric[];
  entries: Entry[];
  points: EntryPoint[];
  /** The same points grouped by metric, newest first, so per-metric work doesn't scan everything. */
  pointsByMetric: Map<string, EntryPoint[]>;
  pauses: Pause[];
  systems: System[];
  steps: SystemStep[];
  systemIdentities: SystemIdentity[];
  completions: SystemCompletion[];
  plans: Plan[];
  settings: Settings;
}

const empty: Snapshot = {
  ready: false,
  version: 0,
  identities: [],
  metrics: [],
  links: [],
  entries: [],
  points: [],
  pointsByMetric: new Map(),
  pauses: [],
  systems: [],
  steps: [],
  systemIdentities: [],
  completions: [],
  plans: [],
  settings: DEFAULT_SETTINGS,
};

export const useData = create<Snapshot>(() => empty);

const NO_POINTS: EntryPoint[] = [];
/** A metric's points from the snapshot (empty when it has none). */
export const pointsOf = (s: Pick<Snapshot, 'pointsByMetric'>, metricId: string) => s.pointsByMetric.get(metricId) ?? NO_POINTS;

const live = <T extends { deletedAt: number | null }>(rows: T[]) => rows.filter((r) => r.deletedAt === null);

/** How to reload each table into the snapshot. */
const loaders: Record<string, () => Partial<Snapshot>> = {
  identities: () => ({ identities: live(db.select().from(identities).all()).sort((a, b) => a.createdAt - b.createdAt) }),
  metrics: () => ({ metrics: live(db.select().from(metrics).all()) }),
  identity_metrics: () => ({
    links: live(db.select().from(identityMetrics).all()).sort((a, b) => b.weight - a.weight || a.createdAt - b.createdAt),
  }),
  entries: () => {
    const all = db.select().from(entries).where(isNull(entries.deletedAt)).all();
    all.sort((a, b) => b.loggedAt - a.loggedAt);
    const points = all.map(toEntryPoint);
    const pointsByMetric = new Map<string, EntryPoint[]>();
    for (const p of points) {
      const list = pointsByMetric.get(p.metricId);
      if (list) list.push(p);
      else pointsByMetric.set(p.metricId, [p]);
    }
    return { entries: all, points, pointsByMetric };
  },
  pauses: () => ({ pauses: live(db.select().from(pauses).all()) }),
  systems: () => ({ systems: live(db.select().from(systems).all()).sort((a, b) => a.createdAt - b.createdAt) }),
  system_steps: () => ({ steps: live(db.select().from(systemSteps).all()).sort((a, b) => a.position - b.position) }),
  system_identities: () => ({ systemIdentities: live(db.select().from(systemIdentities).all()) }),
  system_completions: () => ({ completions: live(db.select().from(systemCompletions).all()) }),
  plans: () => ({ plans: live(db.select().from(plans).all()) }),
  settings: () => ({ settings: settingsRepo.get() }),
};

/**
 * Reload the snapshot. With `tables`, only those are re-read; every other array keeps its
 * identity, so narrow selectors (`useData((s) => s.metrics)`) skip re-rendering.
 */
export function loadSnapshot(tables?: Iterable<string>) {
  const names = tables ? [...new Set(tables)].filter((t) => t in loaders) : Object.keys(loaders);
  if (tables && names.length === 0) return;
  const patch: Partial<Snapshot> = {};
  for (const t of names) Object.assign(patch, loaders[t]());
  useData.setState((s) => ({ ...patch, ready: true, version: s.version + 1 }));
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pending = new Set<string>();
let unsubscribe: (() => void) | null = null;

/** Start listening for writes. Bursts (a transaction) collapse into one reload of the tables they touched. */
export function startDataSync() {
  loadSnapshot();
  unsubscribe?.();
  unsubscribe = onDatabaseChange((table) => {
    pending.add(table);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const tables = pending;
      pending = new Set();
      loadSnapshot(tables);
    }, 16);
  });
}
