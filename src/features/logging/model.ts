import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { Source } from '@/features/metrics/model';
import { base } from '@/shared/db/columns';

export const entries = sqliteTable('entries', {
  ...base,
  metricId: text('metric_id').notNull(),
  value: real('value').notNull(),
  loggedAt: integer('logged_at').notNull(),
  source: text('source').$type<Source>().notNull(),
  systemCompletionId: text('system_completion_id'),
});

export type Entry = typeof entries.$inferSelect;
