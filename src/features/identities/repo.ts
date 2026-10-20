// All writes for this feature go through here.
import { eq } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import { identities, identityPriorityHistory, pauses, type Priority } from '@/features/identities/model';
import { identityMetrics, type Weight } from '@/features/metrics/model';
import { systemIdentities } from '@/features/systems/model';
import { db } from '@/shared/db/client';
import { removed, stamp, touched } from '@/shared/db/rows';
import { addDays, today } from '@/shared/lib/dates';

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
  /** Fresh start from `day` (null undoes it). Nothing is deleted. */
  restart(id: string, day: string | null) {
    db.update(identities)
      .set({ restartedAt: day, ...touched() })
      .where(eq(identities.id, id))
      .run();
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
