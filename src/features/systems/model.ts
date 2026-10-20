import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { base } from '@/shared/db/columns';

export type Frequency = 'daily' | 'weekly' | 'asNeeded';

export const systems = sqliteTable('systems', {
  ...base,
  name: text('name').notNull(),
  description: text('description'),
  cue: text('cue').notNull(),
  frequency: text('frequency').$type<Frequency>().notNull(),
  timesPerWeek: integer('times_per_week').notNull(),
});

export const systemSteps = sqliteTable('system_steps', {
  ...base,
  systemId: text('system_id').notNull(),
  name: text('name').notNull(),
  position: integer('position').notNull(),
  metricId: text('metric_id'),
});

export const systemIdentities = sqliteTable('system_identities', {
  ...base,
  systemId: text('system_id').notNull(),
  identityId: text('identity_id').notNull(),
});

export const systemCompletions = sqliteTable('system_completions', {
  ...base,
  systemId: text('system_id').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
});

export type System = typeof systems.$inferSelect;
export type SystemStep = typeof systemSteps.$inferSelect;
export type SystemIdentity = typeof systemIdentities.$inferSelect;
export type SystemCompletion = typeof systemCompletions.$inferSelect;
