// All writes for this feature go through here.
import { and, eq, isNull } from 'drizzle-orm';

import { identityMetrics, metrics, type Source, type Weight } from '@/features/metrics/model';
import { db } from '@/shared/db/client';
import { removed, stamp, touched } from '@/shared/db/rows';

export interface MetricInput {
  name: string;
  aggregation: (typeof metrics.$inferInsert)['aggregation'];
  unit: string;
  target: number;
  period: (typeof metrics.$inferInsert)['period'];
  direction: (typeof metrics.$inferInsert)['direction'];
  source?: Source;
  defaultAmount?: number;
  step?: number;
}

function metricRow(input: MetricInput) {
  const isCount = input.aggregation === 'count';
  return {
    name: input.name.trim(),
    aggregation: input.aggregation,
    unit: input.unit.trim(),
    target: input.target,
    period: input.period,
    direction: input.direction,
    source: input.source ?? 'manual',
    defaultAmount: input.defaultAmount ?? (isCount ? 1 : Math.max(1, Math.round(input.target / 5))),
    step: input.step ?? 1,
  };
}

export const metricsRepo = {
  create(input: MetricInput) {
    const row = { ...stamp(), ...metricRow(input) };
    db.insert(metrics).values(row).run();
    return row.id;
  },
  update(id: string, input: MetricInput) {
    db.update(metrics)
      .set({ ...metricRow(input), ...touched() })
      .where(eq(metrics.id, id))
      .run();
  },
  link(identityId: string, metricId: string, weight: Weight = 2) {
    const existing = db
      .select()
      .from(identityMetrics)
      .where(
        and(eq(identityMetrics.identityId, identityId), eq(identityMetrics.metricId, metricId), isNull(identityMetrics.deletedAt)),
      )
      .get();
    if (existing) {
      db.update(identityMetrics).set({ weight, ...touched() }).where(eq(identityMetrics.id, existing.id)).run();
      return;
    }
    db.insert(identityMetrics).values({ ...stamp(), identityId, metricId, weight }).run();
  },
  setWeight(identityId: string, metricId: string, weight: Weight) {
    db.update(identityMetrics)
      .set({ weight, ...touched() })
      .where(
        and(eq(identityMetrics.identityId, identityId), eq(identityMetrics.metricId, metricId), isNull(identityMetrics.deletedAt)),
      )
      .run();
  },
  /** Removing keeps the metric and its history. */
  unlink(identityId: string, metricId: string) {
    db.update(identityMetrics)
      .set(removed())
      .where(
        and(eq(identityMetrics.identityId, identityId), eq(identityMetrics.metricId, metricId), isNull(identityMetrics.deletedAt)),
      )
      .run();
  },
};
