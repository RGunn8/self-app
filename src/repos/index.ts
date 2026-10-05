// All writes go through here. Rows are soft-deleted (deletedAt) so a later sync can carry deletes.
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import { db } from '@/db/client';
import {
  entries,
  type Frequency,
  identities,
  identityMetrics,
  identityPriorityHistory,
  metrics,
  pauses,
  type Priority,
  settings,
  type Settings,
  type Source,
  systemCompletions,
  systemIdentities,
  systems,
  systemSteps,
  type Weight,
} from '@/db/schema';
import { addDays, today } from '@/lib/dates';

const stamp = () => {
  const now = Date.now();
  return { id: randomUUID(), createdAt: now, updatedAt: now, deletedAt: null };
};
const touched = () => ({ updatedAt: Date.now() });
const removed = () => ({ deletedAt: Date.now(), updatedAt: Date.now() });

// ── Metrics ──────────────────────────────────────────────────────────────

export interface MetricInput {
  name: string;
  aggregation: (typeof metrics.$inferInsert)['aggregation'];
  unit: string;
  target: number;
  period: (typeof metrics.$inferInsert)['period'];
  direction: (typeof metrics.$inferInsert)['direction'];
  source?: Source;
  defaultAmount?: number;
  step?: number;
}

function metricRow(input: MetricInput) {
  const isCount = input.aggregation === 'count';
  return {
    name: input.name.trim(),
    aggregation: input.aggregation,
    unit: input.unit.trim(),
    target: input.target,
    period: input.period,
    direction: input.direction,
    source: input.source ?? 'manual',
    defaultAmount: input.defaultAmount ?? (isCount ? 1 : Math.max(1, Math.round(input.target / 5))),
    step: input.step ?? 1,
  };
}

export const metricsRepo = {
  create(input: MetricInput) {
    const row = { ...stamp(), ...metricRow(input) };
    db.insert(metrics).values(row).run();
    return row.id;
  },
  update(id: string, input: MetricInput) {
    db.update(metrics)
      .set({ ...metricRow(input), ...touched() })
      .where(eq(metrics.id, id))
      .run();
  },
  link(identityId: string, metricId: string, weight: Weight = 2) {
    const existing = db
      .select()
      .from(identityMetrics)
      .where(
        and(eq(identityMetrics.identityId, identityId), eq(identityMetrics.metricId, metricId), isNull(identityMetrics.deletedAt)),
      )
      .get();
    if (existing) {
      db.update(identityMetrics).set({ weight, ...touched() }).where(eq(identityMetrics.id, existing.id)).run();
      return;
    }
    db.insert(identityMetrics).values({ ...stamp(), identityId, metricId, weight }).run();
  },
  setWeight(identityId: string, metricId: string, weight: Weight) {
    db.update(identityMetrics)
      .set({ weight, ...touched() })
      .where(
        and(eq(identityMetrics.identityId, identityId), eq(identityMetrics.metricId, metricId), isNull(identityMetrics.deletedAt)),
      )
      .run();
  },
  /** Removing keeps the metric and its history. */
  unlink(identityId: string, metricId: string) {
    db.update(identityMetrics)
      .set(removed())
      .where(
        and(eq(identityMetrics.identityId, identityId), eq(identityMetrics.metricId, metricId), isNull(identityMetrics.deletedAt)),
      )
      .run();
  },
};

// ── Identities ───────────────────────────────────────────────────────────

export interface IdentityInput {
  name: string;
  description?: string | null;
  priority: Priority;
  marker: string;
  accent: string;
}

export const identitiesRepo = {
  /** Writes the identity and its metric links in one transaction. */
  create(input: IdentityInput, links: { metricId: string; weight: Weight }[]) {
    const id = randomUUID();
    db.transaction((tx) => {
      const now = Date.now();
      tx.insert(identities)
        .values({
          id,
          createdAt: now,
          updatedAt: now,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          priority: input.priority,
          marker: input.marker,
          accent: input.accent,
        })
        .run();
      tx.insert(identityPriorityHistory).values({ ...stamp(), identityId: id, priority: input.priority, fromDate: today() }).run();
      for (const l of links) tx.insert(identityMetrics).values({ ...stamp(), identityId: id, metricId: l.metricId, weight: l.weight }).run();
    });
    return id;
  },
  update(id: string, input: IdentityInput) {
    const current = db.select().from(identities).where(eq(identities.id, id)).get();
    db.transaction((tx) => {
      tx.update(identities)
        .set({
          name: input.name.trim(),
          description: input.description?.trim() || null,
          priority: input.priority,
          marker: input.marker,
          accent: input.accent,
          ...touched(),
        })
        .where(eq(identities.id, id))
        .run();
      // Priority changes apply from today; past weeks keep the priority they had.
      if (current && current.priority !== input.priority) {
        tx.insert(identityPriorityHistory).values({ ...stamp(), identityId: id, priority: input.priority, fromDate: today() }).run();
      }
    });
  },
  archive(id: string, archived: boolean) {
    db.update(identities)
      .set({ archivedAt: archived ? Date.now() : null, ...touched() })
      .where(eq(identities.id, id))
      .run();
  },
  /** Removes the identity. Metrics used elsewhere stay. */
  remove(id: string) {
    db.transaction((tx) => {
      tx.update(identities).set(removed()).where(eq(identities.id, id)).run();
      tx.update(identityMetrics).set(removed()).where(eq(identityMetrics.identityId, id)).run();
      tx.update(systemIdentities).set(removed()).where(eq(systemIdentities.identityId, id)).run();
    });
  },
};

// ── Pauses ───────────────────────────────────────────────────────────────

export const pausesRepo = {
  create(identityId: string, startDate: string, endDate: string | null, reason: string | null) {
    db.insert(pauses).values({ ...stamp(), identityId, startDate, endDate, reason }).run();
  },
  /** Resume: the pause ends yesterday so today is scored again. */
  resume(pauseId: string, startDate: string) {
    const t = today();
    if (startDate >= t) {
      db.update(pauses).set(removed()).where(eq(pauses.id, pauseId)).run();
    } else {
      db.update(pauses)
        .set({ endDate: addDays(t, -1), ...touched() })
        .where(eq(pauses.id, pauseId))
        .run();
    }
  },
};

// ── Entries ──────────────────────────────────────────────────────────────

export const entriesRepo = {
  add(metricId: string, value: number, loggedAt: number, source: Source = 'manual') {
    const row = { ...stamp(), metricId, value, loggedAt, source, systemCompletionId: null };
    db.insert(entries).values(row).run();
    return row.id;
  },
  update(id: string, value: number, loggedAt: number) {
    db.update(entries)
      .set({ value, loggedAt, ...touched() })
      .where(eq(entries.id, id))
      .run();
  },
  remove(id: string) {
    db.update(entries).set(removed()).where(eq(entries.id, id)).run();
  },
  restore(id: string) {
    db.update(entries)
      .set({ deletedAt: null, ...touched() })
      .where(eq(entries.id, id))
      .run();
  },
};

// ── Systems ──────────────────────────────────────────────────────────────

export interface SystemInput {
  name: string;
  cue: string;
  frequency: Frequency;
  timesPerWeek: number;
  steps: { id?: string; name: string; metricId: string | null }[];
  identityIds: string[];
}

export const systemsRepo = {
  save(input: SystemInput, id?: string) {
    const systemId = id ?? randomUUID();
    db.transaction((tx) => {
      const now = Date.now();
      const fields = {
        name: input.name.trim(),
        cue: input.cue.trim(),
        frequency: input.frequency,
        timesPerWeek: input.frequency === 'weekly' ? input.timesPerWeek : input.frequency === 'daily' ? 7 : 0,
        updatedAt: now,
      };
      if (id) tx.update(systems).set(fields).where(eq(systems.id, id)).run();
      else tx.insert(systems).values({ id: systemId, createdAt: now, description: null, deletedAt: null, ...fields }).run();

      // Steps: keep ids for steps that survive, so in-progress checks still match.
      const keep = input.steps.map((s) => s.id).filter((x): x is string => !!x);
      const existing = tx.select().from(systemSteps).where(and(eq(systemSteps.systemId, systemId), isNull(systemSteps.deletedAt))).all();
      for (const s of existing) if (!keep.includes(s.id)) tx.update(systemSteps).set(removed()).where(eq(systemSteps.id, s.id)).run();
      input.steps.forEach((s, position) => {
        if (s.id && existing.some((e) => e.id === s.id)) {
          tx.update(systemSteps)
            .set({ name: s.name.trim(), metricId: s.metricId, position, ...touched() })
            .where(eq(systemSteps.id, s.id))
            .run();
        } else {
          tx.insert(systemSteps).values({ ...stamp(), systemId, name: s.name.trim(), metricId: s.metricId, position }).run();
        }
      });

      const links = tx
        .select()
        .from(systemIdentities)
        .where(and(eq(systemIdentities.systemId, systemId), isNull(systemIdentities.deletedAt)))
        .all();
      for (const l of links) {
        if (!input.identityIds.includes(l.identityId)) tx.update(systemIdentities).set(removed()).where(eq(systemIdentities.id, l.id)).run();
      }
      for (const identityId of input.identityIds) {
        if (!links.some((l) => l.identityId === identityId)) tx.insert(systemIdentities).values({ ...stamp(), systemId, identityId }).run();
      }
    });
    return systemId;
  },
  /** Deletes the system, its steps and joins; entries it logged are kept. */
  remove(id: string) {
    db.transaction((tx) => {
      tx.update(systems).set(removed()).where(eq(systems.id, id)).run();
      tx.update(systemSteps).set(removed()).where(eq(systemSteps.systemId, id)).run();
      tx.update(systemIdentities).set(removed()).where(eq(systemIdentities.systemId, id)).run();
    });
  },
  /**
   * Mark done: one completion plus an entry for each checked step that logs to a manual metric.
   * Returns the completion id and the metric ids that were logged.
   */
  markDone(systemId: string, day: string, checkedStepIds: string[]) {
    const completionId = randomUUID();
    const logged: string[] = [];
    db.transaction((tx) => {
      const now = Date.now();
      tx.insert(systemCompletions).values({ id: completionId, createdAt: now, updatedAt: now, deletedAt: null, systemId, date: day }).run();
      if (checkedStepIds.length === 0) return;
      const steps = tx.select().from(systemSteps).where(inArray(systemSteps.id, checkedStepIds)).all();
      const metricIds = steps.map((s) => s.metricId).filter((x): x is string => !!x);
      if (metricIds.length === 0) return;
      const ms = tx.select().from(metrics).where(inArray(metrics.id, metricIds)).all();
      const loggedAt = day === today() ? now : new Date(`${day}T12:00:00`).getTime();
      for (const m of ms) {
        if (m.source !== 'manual') continue;
        tx.insert(entries)
          .values({ ...stamp(), metricId: m.id, value: m.defaultAmount, loggedAt, source: 'manual', systemCompletionId: completionId })
          .run();
        logged.push(m.id);
      }
    });
    return { completionId, logged };
  },
  /** Undo deletes the completion and the entries it logged. */
  undo(completionId: string) {
    db.transaction((tx) => {
      tx.update(systemCompletions).set(removed()).where(eq(systemCompletions.id, completionId)).run();
      tx.update(entries).set(removed()).where(eq(entries.systemCompletionId, completionId)).run();
    });
  },
};

// ── Settings ─────────────────────────────────────────────────────────────

export const DEFAULT_SETTINGS: Settings = {
  id: 'me',
  onboardedAt: null,
  userName: null,
  distanceUnit: 'mi',
  checkinEnabled: false,
  checkinDay: 0,
  checkinTime: '18:00',
  scoreDisplay: 'badge',
  appearance: 'system',
  updatedAt: 0,
};

export const settingsRepo = {
  get(): Settings {
    const row = db.select().from(settings).where(eq(settings.id, 'me')).get();
    if (row) return row;
    const fresh = { ...DEFAULT_SETTINGS, updatedAt: Date.now() };
    db.insert(settings).values(fresh).run();
    return fresh;
  },
  update(patch: Partial<Omit<Settings, 'id'>>) {
    this.get();
    db.update(settings)
      .set({ ...patch, updatedAt: Date.now() })
      .where(eq(settings.id, 'me'))
      .run();
  },
};
