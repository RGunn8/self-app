import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { base } from '@/shared/db/columns';

export type PlanKind = 'system' | 'intention';
export type PlanStatus = 'planned' | 'done' | 'skipped';

/**
 * A decision about when to act: a session of a system, or a one-off intention for an identity.
 * Plans belong to their day and expire with it; there's no backlog.
 */
export const plans = sqliteTable('plans', {
  ...base,
  day: text('day').notNull(), // YYYY-MM-DD
  time: text('time'), // HH:mm, null = anytime
  kind: text('kind').$type<PlanKind>().notNull(),
  systemId: text('system_id'),
  identityId: text('identity_id'),
  title: text('title'),
  metricId: text('metric_id'),
  amount: real('amount'),
  /** Intentions only. A system session's status comes from the system's completion that day. */
  status: text('status').$type<PlanStatus>().notNull(),
  entryId: text('entry_id'),
  position: integer('position').notNull(),
});

export type Plan = typeof plans.$inferSelect;
