import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import { base } from '@/shared/db/columns';

export type Aggregation = 'total' | 'average' | 'count' | 'max' | 'min';
export type Period = 'day' | 'week' | 'month';
export type Direction = 'atLeast' | 'atMost';
export type Source = 'manual' | 'health';
export type Weight = 1 | 2 | 4;

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

export type Metric = typeof metrics.$inferSelect;
export type IdentityMetric = typeof identityMetrics.$inferSelect;
