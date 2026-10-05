// In-memory snapshot of the local database, reloaded whenever SQLite reports a write.
// Screens select from it and derive scores with the pure functions in src/domain.
import { isNull } from 'drizzle-orm';
import { create } from 'zustand';

import { db, onDatabaseChange } from '@/db/client';
import {
  entries,
  type Entry,
  identities,
  type Identity,
  identityMetrics,
  type IdentityMetric,
  metrics,
  type Metric,
  pauses,
  type Pause,
  type Settings,
  systemCompletions,
  type SystemCompletion,
  systemIdentities,
  type SystemIdentity,
  systems,
  type System,
  systemSteps,
  type SystemStep,
} from '@/db/schema';
import { type EntryPoint, toEntryPoint } from '@/domain/metrics';
import { DEFAULT_SETTINGS, settingsRepo } from '@/repos';

export interface Snapshot {
  ready: boolean;
  version: number;
  identities: Identity[];
  metrics: Metric[];
  links: IdentityMetric[];
  entries: Entry[];
  points: EntryPoint[];
  pauses: Pause[];
  systems: System[];
  steps: SystemStep[];
  systemIdentities: SystemIdentity[];
  completions: SystemCompletion[];
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
  pauses: [],
  systems: [],
  steps: [],
  systemIdentities: [],
  completions: [],
  settings: DEFAULT_SETTINGS,
};

export const useData = create<Snapshot>(() => empty);

export function loadSnapshot() {
  const live = <T extends { deletedAt: number | null }>(rows: T[]) => rows.filter((r) => r.deletedAt === null);
  const allEntries = db.select().from(entries).where(isNull(entries.deletedAt)).all();
  allEntries.sort((a, b) => b.loggedAt - a.loggedAt);
  useData.setState((s) => ({
    ready: true,
    version: s.version + 1,
    identities: live(db.select().from(identities).all()).sort((a, b) => a.createdAt - b.createdAt),
    metrics: live(db.select().from(metrics).all()),
    links: live(db.select().from(identityMetrics).all()).sort((a, b) => b.weight - a.weight || a.createdAt - b.createdAt),
    entries: allEntries,
    points: allEntries.map(toEntryPoint),
    pauses: live(db.select().from(pauses).all()),
    systems: live(db.select().from(systems).all()).sort((a, b) => a.createdAt - b.createdAt),
    steps: live(db.select().from(systemSteps).all()).sort((a, b) => a.position - b.position),
    systemIdentities: live(db.select().from(systemIdentities).all()),
    completions: live(db.select().from(systemCompletions).all()),
    settings: settingsRepo.get(),
  }));
}

let timer: ReturnType<typeof setTimeout> | null = null;
let unsubscribe: (() => void) | null = null;

/** Start listening for writes. Bursts (a transaction) collapse into one reload. */
export function startDataSync() {
  loadSnapshot();
  unsubscribe?.();
  unsubscribe = onDatabaseChange(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(loadSnapshot, 16);
  });
}
