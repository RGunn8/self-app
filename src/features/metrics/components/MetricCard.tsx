import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { formatChange, formatAmount, formatValue, periodLabel, periodValue, progress, trendFor, windowEnding, type EntryPoint } from '@/features/metrics/domain';
import type { Metric } from '@/features/metrics/model';
import { Bar } from '@/shared/components/charts';
import { Card, Row } from '@/shared/components/ui';
import { addDays, today } from '@/shared/lib/dates';
import { useTheme } from '@/shared/theme';

export function goalText(m: Pick<Metric, 'direction' | 'target' | 'unit' | 'period'>) {
  const per = m.period === 'day' ? (m.unit === 'h' ? 'night' : 'day') : m.period === 'week' ? 'wk' : 'mo';
  return `${m.direction === 'atMost' ? 'At most ' : ''}${formatAmount(m.target, m.unit)} / ${per}`;
}

export const AGG_LABEL = { total: 'Total', average: 'Average', count: 'Count', max: 'Maximum', min: 'Minimum' } as const;
export const PERIOD_LABEL = { day: 'Daily', week: 'Weekly', month: 'Monthly' } as const;
export const SOURCE_LABEL = { manual: 'Manual', health: 'Apple Health' } as const;

export function MetricCard({
  metric,
  points,
  color,
  track,
  fromIdentityId,
}: {
  metric: Metric;
  points: EntryPoint[];
  color: string;
  track: string;
  fromIdentityId?: string;
}) {
  const p = useTheme();
  const t = today();
  const trend = trendFor(metric, points, t);
  const last7 = periodValue(metric, points, windowEnding(t, 7));
  const prev4 = periodValue(metric, points, windowEnding(addDays(t, -7), 28));
  const prog = trend.current === null ? 0 : progress(trend.current, metric.target, metric.direction);
  const limit = metric.direction === 'atMost';
  return (
    <Card
      onPress={() => router.push({ pathname: '/metric/[id]', params: { id: metric.id, fromIdentityId } })}
      className="gap-2">
      <Row className="justify-between">
        <Text className="font-body-bold text-overline uppercase text-muted">
          {metric.name}
          {limit ? ' · Limit' : ''}
        </Text>
        <Text className="font-body text-caption text-muted">
          {SOURCE_LABEL[metric.source]}
        </Text>
      </Row>
      <Row className="justify-between items-end">
        <View>
          <Row className="gap-1 items-baseline">
            <Text className="font-body-bold text-metric-md text-ink">{formatValue(trend.current)}</Text>
            <Text className="font-body-semibold text-label text-muted">
              {periodLabel(metric)}
            </Text>
          </Row>
          <Text className="font-body text-caption text-muted">
            4-week avg
          </Text>
        </View>
        <View className="items-end">
          <Text className="font-body text-caption text-muted">
            {limit ? 'Limit' : 'Goal'}
          </Text>
          <Text className="font-body-semibold text-label text-ink">{goalText(metric)}</Text>
        </View>
      </Row>
      <Bar ratio={prog} color={color} track={track} thickness={8} label={`${Math.round(prog * 100)}% of goal`} />
      <Row className="justify-between">
        <Text className="font-body text-caption text-muted">
          Last 7 days {formatValue(last7)} · Prev. 4 wks {formatValue(prev4)}
        </Text>
        <Text style={{ color: trend.status === 'improving' ? p.positive : p.textMuted }} className="font-body-semibold text-label">
          {formatChange(trend.change)}
        </Text>
      </Row>
    </Card>
  );
}
