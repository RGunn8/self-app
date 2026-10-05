import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Bar, TrendChart } from '@/components/charts';
import { alignmentLabel } from '@/components/identity';
import { MetricCard } from '@/components/metric';
import { SystemCard } from '@/components/system';
import { Avatar, Button, Card, Chip, EmptyState, HeaderAction, NavHeader, Overline, Row, Screen, SectionTitle, Segmented, T } from '@/components/ui';
import type { Weight } from '@/db/schema';
import { formatDelta, WEIGHT_LABEL, WEIGHT_VALUES } from '@/domain/alignment';
import { chartSeries, formatValue, periodLabel, periodValue, type RangeKey, windowEnding, yearlyAverages } from '@/domain/metrics';
import { fmt, today } from '@/lib/dates';
import { metricsRepo, pausesRepo } from '@/repos';
import { useData } from '@/stores/data';
import { PRIORITIES, useIdentityView, useSystemViews } from '@/stores/derived';
import { accentFor, radius, space, useTheme } from '@/theme';

const RANGES: { key: RangeKey; label: string }[] = ['1M', '3M', '6M', '1Y', 'ALL'].map((k) => ({ key: k as RangeKey, label: k }));

export default function IdentityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useTheme();
  const view = useIdentityView(id);
  const points = useData((s) => s.points);
  const systems = useSystemViews(id);
  const [open, setOpen] = useState(true);
  const [chartMetricId, setChartMetricId] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('3M');

  const chartMetric = view?.links.find((l) => l.metric.id === chartMetricId)?.metric ?? view?.links[0]?.metric;
  const series = useMemo(
    () => (chartMetric ? chartSeries(chartMetric, points, today(), range) : []),
    [chartMetric, points, range],
  );

  if (!view) {
    return (
      <Screen header={<NavHeader />}>
        <T v="bodyMd" muted>
          This identity no longer exists.
        </T>
      </Screen>
    );
  }

  const { identity, alignment: a, links } = view;
  const acc = accentFor(p, identity.accent);
  const priority = PRIORITIES.find((x) => x.key === identity.priority)!;
  const t = today();
  const journey = links[0] ? yearlyAverages(links[0].metric, points, t) : [];

  const cycleWeight = (metricId: string, w: Weight) => {
    const next = WEIGHT_VALUES[(WEIGHT_VALUES.indexOf(w) + 1) % WEIGHT_VALUES.length];
    metricsRepo.setWeight(identity.id, metricId, next);
  };

  return (
    <Screen
      header={
        <NavHeader
          right={
            <>
              <HeaderAction label="Journey" onPress={() => router.push(`/identity/${identity.id}/journey`)} />
              <HeaderAction label="Edit" onPress={() => router.push(`/identity/${identity.id}/edit`)} />
            </>
          }
        />
      }
      bottomInset={80}>
      {/* Hero */}
      <View style={{ gap: space.md }}>
        <Overline color={acc.deep}>{priority.label}</Overline>
        <Row style={{ gap: space.md }}>
          <Avatar marker={identity.marker} tint={acc.tint} size={56} />
          <T v="displayXl" style={{ flex: 1 }}>
            {identity.name}
          </T>
        </Row>
        {identity.description ? (
          <T v="bodyLg" muted>
            “{identity.description}”
          </T>
        ) : null}
      </View>

      {view.pause ? (
        <Card tint={acc.tint}>
          <T v="headingCard" color={acc.deep}>
            {alignmentLabel(a, view.pause.endDate)}
          </T>
          <T v="bodySm" color={acc.deep}>
            Not scored while paused. Paused days are left out of trends.
            {view.pause.reason ? ` Paused for ${view.pause.reason.toLowerCase()}.` : ''}
          </T>
          <Button kind="secondary" label="Resume" onPress={() => pausesRepo.resume(view.pause!.id, view.pause!.startDate)} />
        </Card>
      ) : null}

      {/* Alignment */}
      {a.status === 'scored' ? (
        <Animated.View layout={LinearTransition}>
          <Card>
            <T v="overline" muted>
              Last 28 days
            </T>
            <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <T v="metricXl">{a.score}%</T>
                <T v="label" muted>
                  aligned
                </T>
              </View>
              <T v="label" color={view.delta !== null && view.delta > 0 ? p.positive : p.textMuted}>
                {formatDelta(view.delta)} vs previous 4 weeks
              </T>
            </Row>
            <Bar ratio={a.score / 100} color={acc.base} track={acc.tint} thickness={12} label={`${a.score}% aligned`} />
            <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" hitSlop={8}>
              <T v="label" color={p.accentText}>
                {open ? 'Hide breakdown' : 'Show breakdown'}
              </T>
            </Pressable>
            {open ? (
              <Animated.View entering={FadeIn} style={{ gap: space.sm }}>
                <Row>
                  <T v="caption" muted style={{ flex: 1 }}>
                    Metric
                  </T>
                  <T v="caption" muted style={{ width: 64, textAlign: 'right' }}>
                    Progress
                  </T>
                  <T v="caption" muted style={{ width: 36, textAlign: 'right' }}>
                    Pts
                  </T>
                  <T v="caption" muted style={{ width: 76, textAlign: 'right' }}>
                    Weight
                  </T>
                </Row>
                {a.breakdown.map((r) => (
                  <Row key={r.metricId}>
                    <T v="label" style={{ flex: 1 }} numberOfLines={1}>
                      {r.name}
                    </T>
                    <T v="label" style={{ width: 64, textAlign: 'right' }}>
                      {r.score}%
                    </T>
                    <T v="label" style={{ width: 36, textAlign: 'right', fontFamily: 'Figtree_700Bold' }}>
                      {r.pts}
                    </T>
                    <View style={{ width: 76, alignItems: 'flex-end' }}>
                      <Pressable
                        onPress={() => cycleWeight(r.metricId, r.weight)}
                        accessibilityRole="button"
                        accessibilityLabel={`Weight ${WEIGHT_LABEL[r.weight]}. Tap to change`}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: radius.pill,
                          backgroundColor: r.weight === 4 ? p.selected : r.weight === 2 ? p.neutral[300] : p.chip,
                        }}>
                        <T v="caption" color={r.weight === 4 ? p.onSelected : p.text} style={{ fontFamily: 'Figtree_700Bold' }}>
                          {WEIGHT_LABEL[r.weight]}
                        </T>
                      </Pressable>
                    </View>
                  </Row>
                ))}
                <T v="caption" muted>
                  Weighted average of each metric’s progress toward its goal, last 28 days. Progress caps at 100%. Daily metrics count
                  logged days only; skipped days are left out. Points add up to the score.
                </T>
              </Animated.View>
            ) : null}
          </Card>
        </Animated.View>
      ) : a.status === 'baseline' ? (
        <Card>
          <T v="overline" muted>
            Last 28 days
          </T>
          <T v="headingCard">Building your baseline</T>
          <T v="bodySm" muted>
            Alignment appears after 7 days of data. {a.daysToGo} {a.daysToGo === 1 ? 'day' : 'days'} to go.
          </T>
        </Card>
      ) : null}

      {/* Stats */}
      {links.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {links.slice(0, 4).map(({ metric }) => {
            const v30 = periodValue({ ...metric, period: metric.period === 'day' ? 'day' : 'month' }, points, windowEnding(t, 30));
            const per = periodValue(metric, points, windowEnding(t, 28));
            return (
              <View key={metric.id} style={{ width: '48.5%', padding: space.lg, borderRadius: radius.md, backgroundColor: p.card, gap: 2 }}>
                <T v="caption" muted numberOfLines={1}>
                  {metric.name} · 30 days
                </T>
                <T v="metricSm">
                  {formatValue(v30)} {metric.unit}
                </T>
                <T v="caption" muted>
                  {formatValue(per)} {periodLabel(metric)}
                </T>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Trend */}
      {chartMetric ? (
        <Card>
          <T v="overline" muted>
            Trend
          </T>
          <View>
            <T v="headingCard">{chartMetric.name}</T>
            <T v="caption" muted>
              {periodLabel(chartMetric)} · {chartMetric.period === 'day' && range === '1M' ? 'daily' : 'weekly'}
            </T>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
            {links.map(({ metric }) => (
              <Chip key={metric.id} label={metric.name} selected={metric.id === chartMetric.id} onPress={() => setChartMetricId(metric.id)} />
            ))}
          </ScrollView>
          <TrendChart
            points={series}
            target={chartMetric.target}
            targetWord={chartMetric.direction === 'atMost' ? 'Limit' : 'Goal'}
            unit={chartMetric.unit}
            color={acc.base}
            deep={acc.deep}
          />
          <Segmented options={RANGES} value={range} onChange={setRange} accessibilityLabel="Chart range" />
        </Card>
      ) : null}

      {/* Metrics */}
      <View style={{ gap: space.md }}>
        <SectionTitle title={`What ${identity.name} means to you`} caption="The things you chose to track." />
        {links.length === 0 ? (
          <EmptyState title="Nothing tracked yet" body={`Choose what living as ${identity.name} looks like for you.`} />
        ) : (
          links.map(({ metric }) => (
            <MetricCard key={metric.id} metric={metric} points={points} color={acc.base} track={acc.tint} fromIdentityId={identity.id} />
          ))
        )}
        <Button kind="dashed" label="+ Add something to track" onPress={() => router.push({ pathname: '/add-tracker', params: { identityId: identity.id } })} />
      </View>

      {/* Systems */}
      <View style={{ gap: space.md }}>
        <SectionTitle title="Systems" caption={`Routines that help you live as ${identity.name}. They log to your metrics but don’t score on their own.`} />
        {systems.map((s) => (
          <SystemCard key={s.system.id} view={s} accent={acc} identityId={identity.id} />
        ))}
        <Button kind="dashed" label="+ Add a system" onPress={() => router.push({ pathname: '/system-form', params: { identityId: identity.id } })} />
      </View>

      {/* Journey teaser */}
      {journey.length >= 1 && links[0] ? (
        <Card onPress={() => router.push(`/identity/${identity.id}/journey`)} tint={acc.tint}>
          <T v="headingCard" color={acc.deep}>
            Your {identity.name} journey
          </T>
          <T v="bodySm" color={acc.deep}>
            {journey.length > 1
              ? `${links[0].metric.name}: ${formatValue(journey[0].value)} in ${journey[0].year} → ${formatValue(journey[journey.length - 1].value)} this year`
              : `Tracking since ${fmt.monthYear(identity.createdAt)}`}
          </T>
        </Card>
      ) : null}
    </Screen>
  );
}
