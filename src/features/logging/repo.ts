// All writes for this feature go through here.
import { and, eq } from 'drizzle-orm';

import { entries } from '@/features/logging/model';
import type { Source } from '@/features/metrics/model';
import { plans } from '@/features/planning/model';
import { db } from '@/shared/db/client';
import { removed, stamp, touched } from '@/shared/db/rows';

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
  /** Deleting an entry an intention logged puts that plan back to planned, so it doesn't look done with nothing behind it. */
  remove(id: string) {
    db.transaction((tx) => {
      tx.update(entries).set(removed()).where(eq(entries.id, id)).run();
      tx.update(plans)
        .set({ status: 'planned', ...touched() })
        .where(and(eq(plans.entryId, id), eq(plans.status, 'done')))
        .run();
    });
  },
  /** Undoing the delete marks that plan done again. */
  restore(id: string) {
    db.transaction((tx) => {
      tx.update(entries)
        .set({ deletedAt: null, ...touched() })
        .where(eq(entries.id, id))
        .run();
      tx.update(plans)
        .set({ status: 'done', ...touched() })
        .where(and(eq(plans.entryId, id), eq(plans.status, 'planned')))
        .run();
    });
  },
};
