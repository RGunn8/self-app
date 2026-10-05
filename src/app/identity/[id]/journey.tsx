import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Card, NavHeader, Row, Screen, T } from '@/components/ui';
import { formatValue, periodLabel, yearlyAverages } from '@/domain/metrics';
import { fmt, today } from '@/lib/dates';
import { useData } from '@/stores/data';
import { useIdentityView } from '@/stores/derived';
import { accentFor, radius, space, useTheme } from '@/theme';

function YearBar({ ratio, color, track }: { ratio: number; color: string; track: string }) {
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming(ratio, { duration: 600 });
  }, [ratio, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ flex: 1, height: 12, borderRadius: radius.pill, backgroundColor: track, overflow: 'hidden' }}>
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
      <View style={{ gap: space.sm }}>
        <T v="bodySm" muted>
          {first ? `Tracking since ${fmt.monthYear(new Date(`${first.day}T12:00:00`).getTime())}` : 'Nothing logged yet'}
        </T>
        <T v="displayLg">Your {view.identity.name} journey</T>
      </View>
      {cards.map(({ metric, years }) => {
        const max = Math.max(...years.map((y) => y.value), metric.target, 1);
        return (
          <Card key={metric.id}>
            <View>
              <T v="headingCard">{metric.name}</T>
              <T v="caption" muted>
                {periodLabel(metric)}, yearly average
              </T>
            </View>
            {years.length === 0 ? (
              <T v="bodySm" muted>
                No entries yet.
              </T>
            ) : (
              years.map((y) => (
                <Row
                  key={y.year}
                  style={{ gap: space.md }}
                  accessibilityLabel={`${y.year}: ${formatValue(y.value)} ${metric.unit} per ${metric.period}`}>
                  <T v="label" style={{ width: 84 }}>
                    {y.year}
                    {y.ytd ? ' · YTD' : ''}
                  </T>
                  <YearBar ratio={y.value / max} color={acc.base} track={acc.tint} />
                  <T v="label" style={{ width: 52, textAlign: 'right', fontFamily: 'Figtree_700Bold' }}>
                    {formatValue(y.value)}
                  </T>
                </Row>
              ))
            )}
          </Card>
        );
      })}
      {summary ? <T v="bodyLg">{summary}</T> : null}
    </Screen>
  );
}
