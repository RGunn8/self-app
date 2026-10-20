import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Text, View } from 'react-native';

import { alignment, pausedDays, scoreOf, WEIGHT_LABEL } from '@/features/identities/domain';
import { identityPoints, linksFor } from '@/features/identities/views';
import { MetricTrend } from '@/features/metrics/components/MetricTrend';
import { AGG_LABEL, goalText, PERIOD_LABEL, SOURCE_LABEL } from '@/features/metrics/components/MetricCard';
import { formatChange, formatValue, periodLabel, STATUS_LABEL, trendFor } from '@/features/metrics/domain';
import type { Weight } from '@/features/metrics/model';
import { metricsRepo } from '@/features/metrics/repo';
import { Avatar, Button, Card, ListRow, NavHeader, Overline, Row, Screen, Segmented } from '@/shared/components/ui';
import { today } from '@/shared/lib/dates';
import { pointsOf, useData } from '@/shared/store/data';
import { accentFor, useTheme } from '@/shared/theme';

/** One metric, tracked once. It counts toward every identity that includes it. */
export default function MetricScreen() {
  const { id, fromIdentityId } = useLocalSearchParams<{ id: string; fromIdentityId?: string }>();
  const p = useTheme();
  const s = useData();
  const metric = s.metrics.find((m) => m.id === id);
  const t = today();
  // Opened from an identity: leave its paused days out, as its own screen does.
  const excluded = useMemo(() => {
    const ps = s.pauses.filter((x) => x.identityId === fromIdentityId);
    return ps.length ? pausedDays(ps, ps.reduce((m, x) => (x.startDate < m ? x.startDate : m), t), t) : undefined;
  }, [s.pauses, fromIdentityId, t]);
  if (!metric) return <Screen header={<NavHeader />} />;
  const mine = pointsOf(s, metric.id);

  const supportLinks = s.links.filter((l) => l.metricId === metric.id);
  const supporters = s.identities.filter((i) => supportLinks.some((l) => l.identityId === i.id));
  const from = supporters.find((i) => i.id === fromIdentityId);
  const fromLink = supportLinks.find((l) => l.identityId === fromIdentityId);
  const trend = trendFor(metric, mine, t, excluded);
  const count = mine.length;
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
      <View className="gap-2">
        <Overline>{supporters.length > 1 ? `Shared metric · supports ${supporters.length} identities` : 'Metric'}</Overline>
        <Text className="font-heading text-display-xl text-ink">{metric.name}</Text>
        <Row className="items-baseline gap-1">
          <Text className="font-body-bold text-metric-lg text-ink">{formatValue(trend.current)}</Text>
          <Text className="font-body-semibold text-label text-muted">
            {periodLabel(metric)} · 4-week avg
          </Text>
        </Row>
        <Text style={{ color: trend.status === 'improving' ? p.positive : p.textMuted }} className="font-body-semibold text-label">
          {formatChange(trend.change)}
          {trend.status !== 'steady' ? `  ${STATUS_LABEL[trend.status]}` : ''}
        </Text>
      </View>

      <Card>
        <MetricTrend metric={metric} entries={mine} color={acc.base} deep={acc.deep} identityId={from?.id} excluded={excluded} />
      </Card>

      {from && fromLink ? (
        <Card>
          <Text className="font-heading text-heading-card text-ink">In {from.name}</Text>
          <Text className="font-body-semibold text-label text-muted">
            Weight toward {from.name}
          </Text>
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

      <View className="gap-2">
        <Overline>Supports</Overline>
        {supporters.map((i) => {
          const a = accentFor(p, i.accent);
          const links = linksFor(s, i.id);
          const score = scoreOf(alignment(links, identityPoints(s, links, i.restartedAt), s.pauses.filter((x) => x.identityId === i.id), t));
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
        <Text className="font-body text-caption text-muted">
          One metric, tracked once. It counts toward every identity that includes it.
        </Text>
      </View>

      <ListRow title="All entries" sub={`${count} ${count === 1 ? 'entry' : 'entries'}`} onPress={() => router.push(`/metric/${metric.id}/entries`)} />

      <Card className="gap-2">
        {[
          ['Measurement', AGG_LABEL[metric.aggregation]],
          ['Period', PERIOD_LABEL[metric.period]],
          [metric.direction === 'atMost' ? 'Limit' : 'Goal', goalText(metric)],
          ['Source', SOURCE_LABEL[metric.source]],
        ].map(([k, v]) => (
          <Row key={k} className="justify-between">
            <Text className="font-body-semibold text-label text-muted">
              {k}
            </Text>
            <Text className="font-body-semibold text-label text-ink">{v}</Text>
          </Row>
        ))}
      </Card>
    </Screen>
  );
}
