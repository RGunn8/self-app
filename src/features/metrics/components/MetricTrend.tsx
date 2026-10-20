import { router } from 'expo-router';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, Text } from 'react-native';

import {
  CHART_PERIODS,
  type ChartPeriod,
  chartSeries,
  type ChartSeries,
  type EntryPoint,
  formatValue,
  type LinePeriod,
  type MetricDef,
} from '@/features/metrics/domain';
import { TrendChart } from '@/shared/components/charts';
import { ICON_STROKE, Row, Segmented } from '@/shared/components/ui';
import { fmt, today } from '@/shared/lib/dates';
import { useTheme } from '@/shared/theme';

/** What the readout says when no point is selected. */
function summaryOf(metric: MetricDef, s: ChartSeries) {
  if (s.cumulative) {
    let last: number | null = null;
    for (const pt of s.points) if (pt.value !== null) last = pt.value;
    return { value: last, caption: `of ${formatValue(metric.target)} · ${s.cumulative} to date` };
  }
  const nums = s.points.flatMap((pt) => (pt.value === null || pt.partial ? [] : [pt.value]));
  const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  return { value: avg, caption: s.bucket === 'day' || metric.period === 'day' ? 'Daily avg' : 'Weekly avg' };
}

function LineTrend({
  metric,
  entries,
  period,
  color,
  deep,
  excluded,
}: {
  metric: MetricDef;
  entries: EntryPoint[];
  period: LinePeriod;
  color: string;
  deep: string;
  excluded?: Set<string>;
}) {
  const p = useTheme();
  const [offset, setOffset] = useState(0);
  const t = today();
  const s = useMemo(() => chartSeries(metric, entries, period, t, offset, excluded), [metric, entries, period, t, offset, excluded]);
  const canBack = s.hasEarlier;
  const canForward = offset > 0;

  return (
    <>
      <Row className="items-center justify-between">
        <Pressable
          onPress={() => setOffset((o) => o + 1)}
          disabled={!canBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Earlier"
          className="p-1"
          style={{ opacity: canBack ? 1 : 0.3 }}>
          <ChevronLeft size={20} color={p.text} strokeWidth={ICON_STROKE} />
        </Pressable>
        <Text className="font-body-semibold text-label text-ink">{period === 'M' ? fmt.monthKey(s.from) : fmt.span(s.from, s.to)}</Text>
        <Pressable
          onPress={() => setOffset((o) => Math.max(0, o - 1))}
          disabled={!canForward}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Later"
          className="p-1"
          style={{ opacity: canForward ? 1 : 0.3 }}>
          <ChevronRight size={20} color={p.text} strokeWidth={ICON_STROKE} />
        </Pressable>
      </Row>
      <TrendChart
        key={offset}
        points={s.points}
        bucket={s.bucket}
        summary={summaryOf(metric, s)}
        pointNote={s.cumulative ? `${s.cumulative} to date` : undefined}
        target={metric.target}
        targetWord={metric.direction === 'atMost' ? 'Limit' : 'Goal'}
        unit={metric.unit}
        color={color}
        deep={deep}
      />
    </>
  );
}

/** One metric over W / M / 3M as a line with arrows to step back in time; All opens its history calendar. */
export function MetricTrend({
  metric,
  entries,
  color,
  deep,
  identityId,
  excluded,
}: {
  metric: MetricDef;
  entries: EntryPoint[];
  color: string;
  deep: string;
  /** The identity this is shown under, so the history screen keeps its color. */
  identityId?: string;
  /** That identity's paused days, left out of the chart. */
  excluded?: Set<string>;
}) {
  const [period, setPeriod] = useState<LinePeriod>('M');
  const choose = (k: ChartPeriod) => {
    if (k !== 'All') return setPeriod(k);
    router.push({ pathname: '/metric/[id]/calendar', params: { id: metric.id, ...(identityId ? { fromIdentityId: identityId } : {}) } });
  };

  return (
    <>
      {/* Remounting starts a new metric or period back on the current window. */}
      <LineTrend key={`${metric.id}-${period}`} metric={metric} entries={entries} period={period} color={color} deep={deep} excluded={excluded} />
      <Segmented options={CHART_PERIODS} value={period} onChange={choose} accessibilityLabel="Chart period" />
    </>
  );
}
