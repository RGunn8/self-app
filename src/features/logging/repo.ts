// All writes for this feature go through here.
import { eq } from 'drizzle-orm';

import { entries } from '@/features/logging/model';
import type { Source } from '@/features/metrics/model';
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
