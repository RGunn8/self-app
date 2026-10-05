import { router } from 'expo-router';
import { View } from 'react-native';

import type { Metric } from '@/db/schema';
import { formatChange, formatValue, periodLabel, periodValue, progress, trendFor, windowEnding, type EntryPoint } from '@/domain/metrics';
import { addDays, today } from '@/lib/dates';
import { space, useTheme } from '@/theme';
import { Bar } from './charts';
import { Card, Row, T } from './ui';

export function goalText(m: Pick<Metric, 'direction' | 'target' | 'unit' | 'period'>) {
  const per = m.period === 'day' ? (m.unit === 'h' ? 'night' : 'day') : m.period === 'week' ? 'wk' : 'mo';
  return `${m.direction === 'atMost' ? 'At most ' : ''}${formatValue(m.target)} ${m.unit} / ${per}`;
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
      style={{ gap: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="overline" muted>
          {metric.name}
          {limit ? ' · Limit' : ''}
        </T>
        <T v="caption" muted>
          {SOURCE_LABEL[metric.source]}
        </T>
      </Row>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Row style={{ gap: space.xs, alignItems: 'baseline' }}>
            <T v="metricMd">{formatValue(trend.current)}</T>
            <T v="label" muted>
              {periodLabel(metric)}
            </T>
          </Row>
          <T v="caption" muted>
            4-week avg
          </T>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <T v="caption" muted>
            {limit ? 'Limit' : 'Goal'}
          </T>
          <T v="label">{goalText(metric)}</T>
        </View>
      </Row>
      <Bar ratio={prog} color={color} track={track} thickness={8} label={`${Math.round(prog * 100)}% of goal`} />
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="caption" muted>
          Last 7 days {formatValue(last7)} · Prev. 4 wks {formatValue(prev4)}
        </T>
        <T v="label" color={trend.status === 'improving' ? p.positive : p.textMuted}>
          {formatChange(trend.change)}
        </T>
      </Row>
    </Card>
  );
}
