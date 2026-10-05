import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Avatar, Button, Card, HeaderAction, NavHeader, Row, Screen, T } from '@/components/ui';
import { formatChange } from '@/domain/metrics';
import { weekReview } from '@/domain/week';
import { addDays, fmt, parseDay, today, weekStart as mondayOf } from '@/lib/dates';
import { useData } from '@/stores/data';
import { identityInputs } from '@/stores/derived';
import { accentFor, space, useTheme } from '@/theme';

/** The most recent full week: this week if today is Sunday, otherwise last week. */
function latestWeek() {
  const t = today();
  return parseDay(t).getDay() === 0 ? mondayOf(t) : addDays(mondayOf(t), -7);
}

export default function WeekInReview() {
  const { weekStart } = useLocalSearchParams<{ weekStart: string }>();
  const p = useTheme();
  const s = useData();
  const ws = weekStart === 'latest' || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) ? latestWeek() : mondayOf(weekStart);
  const review = useMemo(
    () => weekReview(identityInputs(s), s.points, ws),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.version, ws],
  );

  return (
    <Screen header={<NavHeader back={false} left={<HeaderAction label="Close" onPress={() => router.back()} />} />}>
      <View style={{ gap: space.sm }}>
        <T v="bodySm" muted>
          Week of {fmt.short(review.weekStart)} – {fmt.short(review.weekEnd)}
        </T>
        <T v="displayLg">Your week</T>
        <T v="bodyMd" muted>
          Compared with your usual four weeks.
        </T>
      </View>
      <Card style={{ gap: space.lg }}>
        {review.rows.map((r) => {
          const identity = s.identities.find((i) => i.id === r.identityId)!;
          const acc = accentFor(p, identity.accent);
          return (
            <Row key={r.identityId} style={{ gap: space.md }}>
              <Avatar marker={identity.marker} tint={acc.tint} size={36} />
              <View style={{ flex: 1 }}>
                <T v="label" style={{ fontSize: 15, fontFamily: 'Figtree_700Bold' }}>
                  {r.name}
                </T>
                <T v="caption" muted>
                  {r.summary}
                </T>
              </View>
              <T v="label" color={r.change !== null && r.change > 0 ? p.positive : p.textMuted}>
                {formatChange(r.change)}
              </T>
              <T v="label" style={{ width: 44, textAlign: 'right', fontFamily: 'Figtree_700Bold' }}>
                {r.score !== null ? `${r.score}%` : '–'}
              </T>
            </Row>
          );
        })}
      </Card>
      {review.standout ? (
        <Card>
          <T v="overline" muted>
            What stood out
          </T>
          <T v="bodyLg">{review.standout}</T>
        </Card>
      ) : null}
      {review.skipped.length ? (
        <T v="bodySm" muted>
          Skipped: {review.skipped.map((x) => `${x.metric}, ${x.days} ${x.days === 1 ? 'day' : 'days'}`).join(' · ')}. Skipped days aren’t counted.
        </T>
      ) : null}
      <Button label="Open dashboard" onPress={() => router.dismissTo('/')} />
    </Screen>
  );
}
