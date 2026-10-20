import { router, useLocalSearchParams } from 'expo-router';
import { Ellipsis } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';

import { restartedLabel, resumeIdentity } from '@/features/identities/actions';
import { alignmentLabel } from '@/features/identities/components/IdentityCard';
import { formatDelta, WEIGHT_LABEL, WEIGHT_VALUES } from '@/features/identities/domain';
import { PRIORITIES, useIdentityView } from '@/features/identities/views';
import { MetricCard } from '@/features/metrics/components/MetricCard';
import { formatValue, periodLabel, periodValue, windowEnding, yearlyAverages } from '@/features/metrics/domain';
import type { Weight } from '@/features/metrics/model';
import { metricsRepo } from '@/features/metrics/repo';
import { SystemCard } from '@/features/systems/components/SystemCard';
import { useSystemViews } from '@/features/systems/views';
import { MetricTrend } from '@/features/metrics/components/MetricTrend';
import { UnlockPath } from '@/features/progress/components/UnlockPath';
import { unlockPath, votesFor } from '@/features/progress/domain';
import { logDataOf } from '@/features/progress/views';
import { Bar } from '@/shared/components/charts';
import { Avatar, Button, Card, Chip, EmptyState, ICON_STROKE, NavHeader, Overline, Row, Screen, SectionTitle } from '@/shared/components/ui';
import { cx } from '@/shared/lib/cx';
import { fmt, today } from '@/shared/lib/dates';
import { pointsOf, useData } from '@/shared/store/data';
import { accentFor, space, useTheme } from '@/shared/theme';


export default function IdentityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useTheme();
  const view = useIdentityView(id);
  const points = useData((s) => s.points);
  const logData = useData(useShallow(logDataOf));
  const pointsByMetric = useData((s) => s.pointsByMetric);
  const systems = useSystemViews(id);
  const [open, setOpen] = useState(true);
  const [chartMetricId, setChartMetricId] = useState<string | null>(null);

  const chartMetric = view?.links.find((l) => l.metric.id === chartMetricId)?.metric ?? view?.links[0]?.metric;

  if (!view) {
    return (
      <Screen header={<NavHeader />}>
        <Text className="font-body text-body-md text-muted">
          This identity no longer exists.
        </Text>
      </Screen>
    );
  }

  const { identity, alignment: a, links } = view;
  const acc = accentFor(p, identity.accent);
  const priority = PRIORITIES.find((x) => x.key === identity.priority)!;
  const t = today();
  const journey = links[0] ? yearlyAverages(links[0].metric, points, t) : [];
  const votes = votesFor(identity.id, logData, identity.restartedAt);
  const steps = unlockPath({ links, since: identity.restartedAt }, points, t);
  // The path stays until insights unlock; after that the identity speaks for itself.
  const path = steps.find((x) => x.key === 'insights')!.state === 'done' ? null : steps;

  const cycleWeight = (metricId: string, w: Weight) => {
    const next = WEIGHT_VALUES[(WEIGHT_VALUES.indexOf(w) + 1) % WEIGHT_VALUES.length];
    metricsRepo.setWeight(identity.id, metricId, next);
  };

  return (
    <Screen
      header={
        <NavHeader
          right={
            <Pressable
              onPress={() => router.push(`/identity/${identity.id}/actions`)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${identity.name} options`}
              className="p-2">
              <Ellipsis size={22} color={p.text} strokeWidth={ICON_STROKE} />
            </Pressable>
          }
        />
      }
      bottomInset={80}>
      {/* Hero */}
      <View className="gap-3">
        <Overline color={acc.deep}>{priority.label}</Overline>
        <Row className="gap-3">
          <Avatar marker={identity.marker} tint={acc.tint} size={56} />
          <Text className="font-heading text-display-xl text-ink flex-1">
            {identity.name}
          </Text>
        </Row>
        {votes.count || identity.restartedAt ? (
          <Text className="font-body-semibold text-label text-muted">
            {[
              votes.count ? `${votes.count} ${votes.count === 1 ? 'vote' : 'votes'} cast${votes.since && !identity.restartedAt ? ` since ${fmt.short(votes.since)}` : ''}` : null,
              restartedLabel(identity),
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        ) : null}
        {identity.description ? (
          <Text className="font-body text-body-lg text-muted">
            “{identity.description}”
          </Text>
        ) : null}
      </View>

      {view.pause ? (
        <Card tint={acc.tint}>
          <Text style={{ color: acc.deep }} className="font-heading text-heading-card">
            {alignmentLabel(a, view.pause.endDate)}
          </Text>
          <Text style={{ color: acc.deep }} className="font-body text-body-sm">
            Not scored while paused. Paused days are left out of trends.
            {view.pause.reason ? ` Paused for ${view.pause.reason.toLowerCase()}.` : ''}
          </Text>
          <Button kind="secondary" label="Resume" onPress={() => resumeIdentity(identity, view.pause!)} />
        </Card>
      ) : null}

      {/* Alignment */}
      {a.status === 'scored' ? (
        <Animated.View layout={LinearTransition}>
          <Card>
            <Text className="font-body-bold text-overline uppercase text-muted">
              Last 28 days
            </Text>
            <Row className="justify-between items-end">
              <View>
                <Text className="font-body-bold text-metric-xl text-ink">{a.score}%</Text>
                <Text className="font-body-semibold text-label text-muted">
                  aligned
                </Text>
              </View>
              <Text style={{ color: view.delta !== null && view.delta > 0 ? p.positive : p.textMuted }} className="font-body-semibold text-label">
                {formatDelta(view.delta)} vs previous 4 weeks
              </Text>
            </Row>
            <Bar ratio={a.score / 100} color={acc.base} track={acc.tint} thickness={12} label={`${a.score}% aligned`} />
            <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" hitSlop={8}>
              <Text className="font-body-semibold text-label text-accent-text">
                {open ? 'Hide breakdown' : 'Show breakdown'}
              </Text>
            </Pressable>
            {open ? (
              <Animated.View entering={FadeIn} style={{ gap: space.sm }}>
                <Row>
                  <Text className="font-body text-caption text-muted flex-1">
                    Metric
                  </Text>
                  <Text className="font-body text-caption text-muted w-16 text-right">
                    Progress
                  </Text>
                  <Text className="font-body text-caption text-muted w-9 text-right">
                    Pts
                  </Text>
                  <Text className="font-body text-caption text-muted w-[76px] text-right">
                    Weight
                  </Text>
                </Row>
                {a.breakdown.map((r) => (
                  <Row key={r.metricId}>
                    <Text numberOfLines={1} className="font-body-semibold text-label text-ink flex-1">
                      {r.name}
                    </Text>
                    <Text className="font-body-semibold text-label text-ink w-16 text-right">
                      {r.score}%
                    </Text>
                    <Text className="text-label text-ink w-9 text-right font-body-bold">
                      {r.pts}
                    </Text>
                    <View className="w-[76px] items-end">
                      <Pressable
                        onPress={() => cycleWeight(r.metricId, r.weight)}
                        accessibilityRole="button"
                        accessibilityLabel={`Weight ${WEIGHT_LABEL[r.weight]}. Tap to change`}
                        className={cx('rounded-pill px-2.5 py-1', r.weight === 4 ? 'bg-selected' : r.weight === 2 ? 'bg-neutral-300' : 'bg-chip')}>
                        <Text style={{ color: r.weight === 4 ? p.onSelected : p.text }} className="text-caption font-body-bold">
                          {WEIGHT_LABEL[r.weight]}
                        </Text>
                      </Pressable>
                    </View>
                  </Row>
                ))}
                <Text className="font-body text-caption text-muted">
                  Weighted average of each metric’s progress toward its goal, last 28 days. Progress caps at 100%. Daily metrics count
                  logged days only; skipped days are left out. Points add up to the score.
                </Text>
              </Animated.View>
            ) : null}
          </Card>
        </Animated.View>
      ) : null}

      {path && !view.pause ? <UnlockPath name={identity.name} steps={path} accent={acc} /> : null}

      {/* Stats */}
      {links.length ? (
        <View className="flex-row flex-wrap gap-2">
          {links.slice(0, 4).map(({ metric }) => {
            const v30 = periodValue({ ...metric, period: metric.period === 'day' ? 'day' : 'month' }, points, windowEnding(t, 30));
            const per = periodValue(metric, points, windowEnding(t, 28));
            return (
              <View key={metric.id} className="w-[48.5%] p-4 rounded-md bg-card gap-0.5">
                <Text numberOfLines={1} className="font-body text-caption text-muted">
                  {metric.name} · 30 days
                </Text>
                <Text className="font-body-bold text-metric-sm text-ink">
                  {formatValue(v30)} {metric.unit}
                </Text>
                <Text className="font-body text-caption text-muted">
                  {formatValue(per)} {periodLabel(metric)}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Trend */}
      {chartMetric ? (
        <Card>
          <Text className="font-body-bold text-overline uppercase text-muted">
            Trend
          </Text>
          <View>
            <Text className="font-heading text-heading-card text-ink">{chartMetric.name}</Text>
            <Text className="font-body text-caption text-muted">
              Goal {formatValue(chartMetric.target)} {periodLabel(chartMetric)}
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {links.map(({ metric }) => (
              <Chip key={metric.id} label={metric.name} selected={metric.id === chartMetric.id} onPress={() => setChartMetricId(metric.id)} />
            ))}
          </ScrollView>
          <MetricTrend
            metric={chartMetric}
            entries={pointsOf({ pointsByMetric }, chartMetric.id)}
            color={acc.base}
            deep={acc.deep}
            identityId={identity.id}
            excluded={view.paused}
          />
        </Card>
      ) : null}

      {/* Metrics */}
      <View className="gap-3">
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
      <View className="gap-3">
        <SectionTitle title="Systems" caption={`Routines that help you live as ${identity.name}. They log to your metrics but don’t score on their own.`} />
        {systems.map((s) => (
          <SystemCard key={s.system.id} view={s} accent={acc} identityId={identity.id} />
        ))}
        <Button kind="dashed" label="+ Add a system" onPress={() => router.push({ pathname: '/system-form', params: { identityId: identity.id } })} />
      </View>

      {/* Journey teaser */}
      {journey.length >= 1 && links[0] ? (
        <Card onPress={() => router.push(`/identity/${identity.id}/journey`)} tint={acc.tint}>
          <Text style={{ color: acc.deep }} className="font-heading text-heading-card">
            Your {identity.name} journey
          </Text>
          <Text style={{ color: acc.deep }} className="font-body text-body-sm">
            {journey.length > 1
              ? `${links[0].metric.name}: ${formatValue(journey[0].value)} in ${journey[0].year} → ${formatValue(journey[journey.length - 1].value)} this year`
              : `Tracking since ${fmt.monthYear(identity.createdAt)}`}
          </Text>
        </Card>
      ) : null}
    </Screen>
  );
}
