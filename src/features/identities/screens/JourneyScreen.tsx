import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useIdentityView } from '@/features/identities/views';
import { formatValue, periodLabel, yearlyAverages } from '@/features/metrics/domain';
import { Card, NavHeader, Row, Screen } from '@/shared/components/ui';
import { fmt, today } from '@/shared/lib/dates';
import { useData } from '@/shared/store/data';
import { accentFor, radius, useTheme } from '@/shared/theme';

function YearBar({ ratio, color, track }: { ratio: number; color: string; track: string }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(ratio, { duration: 600 });
  }, [ratio, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View className="flex-1 h-3 rounded-pill overflow-hidden" style={{ backgroundColor: track }}>
      <Animated.View style={[{ height: '100%', borderRadius: radius.pill, backgroundColor: color }, style]} />
    </View>
  );
}

export default function JourneyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useTheme();
  const view = useIdentityView(id);
  const points = useData((s) => s.points);
  if (!view) return <Screen header={<NavHeader />} />;
  const acc = accentFor(p, view.identity.accent);
  const t = today();
  const first = points.filter((e) => view.links.some((l) => l.metric.id === e.metricId)).at(-1);
  const cards = view.links.slice(0, 2).map(({ metric }) => ({ metric, years: yearlyAverages(metric, points, t).slice(-3) }));

  const summary = cards
    .filter((c) => c.years.length > 1)
    .map((c, i) => {
      const a = c.years[0];
      const b = c.years[c.years.length - 1];
      return i === 0
        ? `In ${a.year} you averaged ${formatValue(a.value)} ${periodLabel(c.metric)}. This year it's ${formatValue(b.value)}.`
        : `${c.metric.name} went from ${formatValue(a.value)} to ${formatValue(b.value)}.`;
    })
    .join(' ');

  return (
    <Screen header={<NavHeader backLabel={view.identity.name} />}>
      <View className="gap-2">
        <Text className="font-body text-body-sm text-muted">
          {first ? `Tracking since ${fmt.monthYear(new Date(`${first.day}T12:00:00`).getTime())}` : 'Nothing logged yet'}
        </Text>
        <Text className="font-heading text-display-lg text-ink">Your {view.identity.name} journey</Text>
      </View>
      {cards.map(({ metric, years }) => {
        const max = Math.max(...years.map((y) => y.value), metric.target, 1);
        return (
          <Card key={metric.id}>
            <View>
              <Text className="font-heading text-heading-card text-ink">{metric.name}</Text>
              <Text className="font-body text-caption text-muted">
                {periodLabel(metric)}, yearly average
              </Text>
            </View>
            {years.length === 0 ? (
              <Text className="font-body text-body-sm text-muted">
                No entries yet.
              </Text>
            ) : (
              years.map((y) => (
                <Row
                  key={y.year}
                  className="gap-3"
                  accessibilityLabel={`${y.year}: ${formatValue(y.value)} ${metric.unit} per ${metric.period}`}>
                  <Text className="font-body-semibold text-label text-ink w-[84px]">
                    {y.year}
                    {y.ytd ? ' · YTD' : ''}
                  </Text>
                  <YearBar ratio={y.value / max} color={acc.base} track={acc.tint} />
                  <Text className="text-label text-ink w-[52px] text-right font-body-bold">
                    {formatValue(y.value)}
                  </Text>
                </Row>
              ))
            )}
          </Card>
        );
      })}
      {summary ? <Text className="font-body text-body-lg text-ink">{summary}</Text> : null}
    </Screen>
  );
}
