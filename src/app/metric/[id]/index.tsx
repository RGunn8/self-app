import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, View } from 'react-native';

import { TrendChart } from '@/components/charts';
import { AGG_LABEL, goalText, PERIOD_LABEL, SOURCE_LABEL } from '@/components/metric';
import { Avatar, Button, Card, ListRow, NavHeader, Overline, Row, Screen, Segmented, T } from '@/components/ui';
import type { Weight } from '@/db/schema';
import { scoreOf, alignment, WEIGHT_LABEL } from '@/domain/alignment';
import { chartSeries, formatChange, formatValue, periodLabel, type RangeKey, STATUS_LABEL, trendFor } from '@/domain/metrics';
import { today } from '@/lib/dates';
import { metricsRepo } from '@/repos';
import { useData } from '@/stores/data';
import { linksFor } from '@/stores/derived';
import { accentFor, space, useTheme } from '@/theme';

const RANGES: { key: RangeKey; label: string }[] = ['1M', '3M', '6M', '1Y', 'ALL'].map((k) => ({ key: k as RangeKey, label: k }));

/** One metric, tracked once. It counts toward every identity that includes it. */
export default function MetricScreen() {
  const { id, fromIdentityId } = useLocalSearchParams<{ id: string; fromIdentityId?: string }>();
  const p = useTheme();
  const s = useData();
  const [range, setRange] = useState<RangeKey>('3M');
  const metric = s.metrics.find((m) => m.id === id);
  const t = today();
  const series = useMemo(() => (metric ? chartSeries(metric, s.points, t, range) : []), [metric, s.points, t, range]);
  if (!metric) return <Screen header={<NavHeader />} />;

  const supportLinks = s.links.filter((l) => l.metricId === metric.id);
  const supporters = s.identities.filter((i) => supportLinks.some((l) => l.identityId === i.id));
  const from = supporters.find((i) => i.id === fromIdentityId);
  const fromLink = supportLinks.find((l) => l.identityId === fromIdentityId);
  const trend = trendFor(metric, s.points, t);
  const count = s.entries.filter((e) => e.metricId === metric.id).length;
  const acc = from ? accentFor(p, from.accent) : { base: p.neutral[700], tint: p.chip, deep: p.text };

  const remove = () =>
    Alert.alert(`Remove from ${from!.name}?`, 'Removing keeps the metric and its history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          metricsRepo.unlink(from!.id, metric.id);
          router.back();
        },
      },
    ]);

  return (
    <Screen header={<NavHeader backLabel={from?.name ?? 'Back'} />} bottomInset={80}>
      <View style={{ gap: space.sm }}>
        <Overline>{supporters.length > 1 ? `Shared metric · supports ${supporters.length} identities` : 'Metric'}</Overline>
        <T v="displayXl">{metric.name}</T>
        <Row style={{ alignItems: 'baseline', gap: space.xs }}>
          <T v="metricLg">{formatValue(trend.current)}</T>
          <T v="label" muted>
            {periodLabel(metric)} · 4-week avg
          </T>
        </Row>
        <T v="label" color={trend.status === 'improving' ? p.positive : p.textMuted}>
          {formatChange(trend.change)}
          {trend.status !== 'steady' ? `  ${STATUS_LABEL[trend.status]}` : ''}
        </T>
      </View>

      <Card>
        <TrendChart
          points={series}
          target={metric.target}
          targetWord={metric.direction === 'atMost' ? 'Limit' : 'Goal'}
          unit={metric.unit}
          color={acc.base}
          deep={acc.deep}
        />
        <Segmented options={RANGES} value={range} onChange={setRange} accessibilityLabel="Chart range" />
      </Card>

      {from && fromLink ? (
        <Card>
          <T v="headingCard">In {from.name}</T>
          <T v="label" muted>
            Weight toward {from.name}
          </T>
          <Segmented
            options={[
              { key: '1', label: WEIGHT_LABEL[1] },
              { key: '2', label: WEIGHT_LABEL[2] },
              { key: '4', label: WEIGHT_LABEL[4] },
            ]}
            value={String(fromLink.weight) as '1' | '2' | '4'}
            onChange={(k) => metricsRepo.setWeight(from.id, metric.id, Number(k) as Weight)}
          />
          <Button
            kind="secondary"
            label="Edit metric"
            onPress={() => router.push({ pathname: '/metric-form', params: { kind: 'edit', metricId: metric.id, identityId: from.id } })}
          />
          <Button kind="ghost" label={`Remove from ${from.name}`} onPress={remove} />
        </Card>
      ) : (
        <Button
          kind="secondary"
          label="Edit metric"
          onPress={() => router.push({ pathname: '/metric-form', params: { kind: 'edit', metricId: metric.id } })}
        />
      )}

      <View style={{ gap: space.sm }}>
        <Overline>Supports</Overline>
        {supporters.map((i) => {
          const a = accentFor(p, i.accent);
          const score = scoreOf(alignment(linksFor(s, i.id), s.points, s.pauses.filter((x) => x.identityId === i.id), t));
          const w = supportLinks.find((l) => l.identityId === i.id)!.weight;
          return (
            <ListRow
              key={i.id}
              left={<Avatar marker={i.marker} tint={a.tint} size={32} />}
              title={i.name}
              sub={`${score !== null ? `${score}% · ` : ''}${WEIGHT_LABEL[w]} weight`}
              onPress={() => (i.id === fromIdentityId ? router.back() : router.navigate(`/identity/${i.id}`))}
            />
          );
        })}
        <T v="caption" muted>
          One metric, tracked once. It counts toward every identity that includes it.
        </T>
      </View>

      <ListRow title="All entries" sub={`${count} ${count === 1 ? 'entry' : 'entries'}`} onPress={() => router.push(`/metric/${metric.id}/entries`)} />

      <Card style={{ gap: space.sm }}>
        {[
          ['Measurement', AGG_LABEL[metric.aggregation]],
          ['Period', PERIOD_LABEL[metric.period]],
          [metric.direction === 'atMost' ? 'Limit' : 'Goal', goalText(metric)],
          ['Source', SOURCE_LABEL[metric.source]],
        ].map(([k, v]) => (
          <Row key={k} style={{ justifyContent: 'space-between' }}>
            <T v="label" muted>
              {k}
            </T>
            <T v="label">{v}</T>
          </Row>
        ))}
      </Card>
    </Screen>
  );
}
