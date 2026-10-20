import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { base } from '@/shared/db/columns';

export type Priority = 'core' | 'important' | 'supporting';

export const identities = sqliteTable('identities', {
  ...base,
  name: text('name').notNull(),
  description: text('description'),
  priority: text('priority').$type<Priority>().notNull(),
  marker: text('marker').notNull(),
  accent: text('accent').notNull(),
  archivedAt: integer('archived_at'),
  /** YYYY-MM-DD. Alignment, votes and the getting-started path count from here; older entries stay. */
  restartedAt: text('restarted_at'),
});

export const identityPriorityHistory = sqliteTable('identity_priority_history', {
  ...base,
  identityId: text('identity_id').notNull(),
  priority: text('priority').$type<Priority>().notNull(),
  fromDate: text('from_date').notNull(), // YYYY-MM-DD
});

export const pauses = sqliteTable('pauses', {
  ...base,
  identityId: text('identity_id').notNull(),
  startDate: text('start_date').notNull(), // YYYY-MM-DD inclusive
  endDate: text('end_date'), // YYYY-MM-DD inclusive, null = until resumed
  reason: text('reason'),
});

export type Identity = typeof identities.$inferSelect;
export type Pause = typeof pauses.$inferSelect;
