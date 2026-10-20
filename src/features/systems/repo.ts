// All writes for this feature go through here.
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import { entries } from '@/features/logging/model';
import { metrics } from '@/features/metrics/model';
import { type Frequency, systemCompletions, systemIdentities, systems, systemSteps } from '@/features/systems/model';
import { db } from '@/shared/db/client';
import { removed, stamp, touched } from '@/shared/db/rows';
import { today } from '@/shared/lib/dates';

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
