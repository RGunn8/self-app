import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Every synced table carries id (uuid) + createdAt/updatedAt/deletedAt (epoch ms)
// so a future push/pull sync against the API can merge by updatedAt.
const base = {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
};

export type Priority = 'core' | 'important' | 'supporting';
export type Aggregation = 'total' | 'average' | 'count' | 'max' | 'min';
export type Period = 'day' | 'week' | 'month';
export type Direction = 'atLeast' | 'atMost';
export type Source = 'manual' | 'health';
export type Frequency = 'daily' | 'weekly' | 'asNeeded';
export type Weight = 1 | 2 | 4;

export const identities = sqliteTable('identities', {
  ...base,
  name: text('name').notNull(),
  description: text('description'),
  priority: text('priority').$type<Priority>().notNull(),
  marker: text('marker').notNull(),
  accent: text('accent').notNull(),
  archivedAt: integer('archived_at'),
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

export const metrics = sqliteTable('metrics', {
  ...base,
  name: text('name').notNull(),
  aggregation: text('aggregation').$type<Aggregation>().notNull(),
  unit: text('unit').notNull(),
  target: real('target').notNull(),
  period: text('period').$type<Period>().notNull(),
  direction: text('direction').$type<Direction>().notNull(),
  source: text('source').$type<Source>().notNull(),
  defaultAmount: real('default_amount').notNull(),
  step: real('step').notNull(),
});

export const identityMetrics = sqliteTable('identity_metrics', {
  ...base,
  identityId: text('identity_id').notNull(),
  metricId: text('metric_id').notNull(),
  weight: integer('weight').$type<Weight>().notNull(),
});

export const entries = sqliteTable('entries', {
  ...base,
  metricId: text('metric_id').notNull(),
  value: real('value').notNull(),
  loggedAt: integer('logged_at').notNull(),
  source: text('source').$type<Source>().notNull(),
  systemCompletionId: text('system_completion_id'),
});

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

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(), // always 'me'
  onboardedAt: integer('onboarded_at'),
  userName: text('user_name'),
  distanceUnit: text('distance_unit').$type<'mi' | 'km'>().notNull(),
  checkinEnabled: integer('checkin_enabled', { mode: 'boolean' }).notNull(),
  checkinDay: integer('checkin_day').notNull(), // 0 = Sunday
  checkinTime: text('checkin_time').notNull(), // HH:mm
  scoreDisplay: text('score_display').$type<'badge' | 'bar' | 'hidden'>().notNull(),
  appearance: text('appearance').$type<'system' | 'light' | 'dark'>().notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type Identity = typeof identities.$inferSelect;
export type Pause = typeof pauses.$inferSelect;
export type Metric = typeof metrics.$inferSelect;
export type IdentityMetric = typeof identityMetrics.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type System = typeof systems.$inferSelect;
export type SystemStep = typeof systemSteps.$inferSelect;
export type SystemIdentity = typeof systemIdentities.$inferSelect;
export type SystemCompletion = typeof systemCompletions.$inferSelect;
export type Settings = typeof settings.$inferSelect;
