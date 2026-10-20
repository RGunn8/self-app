import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { identityInputs } from '@/features/identities/views';
import { plansKept } from '@/features/planning/domain';
import { usePlanData } from '@/features/planning/views';
import { formatChange } from '@/features/metrics/domain';
import { type DayWin, weekReview } from '@/features/week/domain';
import { useFullestDays } from '@/features/progress/views';
import { Avatar, Button, Card, HeaderAction, NavHeader, Row, Screen } from '@/shared/components/ui';
import { addDays, fmt, parseDay, today, WEEKDAY_INITIALS, weekStart as mondayOf } from '@/shared/lib/dates';
import { useData } from '@/shared/store/data';
import { accentFor, useTheme } from '@/shared/theme';

/** Every win that week, day by day, so daily goals get celebrated without a card each day. */
function DailyWins({ wins, weekStart }: { wins: DayWin[]; weekStart: string }) {
  const p = useTheme();
  const identities = useData((s) => s.identities);
  const colorOf = (id: string) => accentFor(p, identities.find((i) => i.id === id)?.accent);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const byDay = days.map((day) => ({ day, wins: wins.filter((w) => w.day === day) }));
  const activeDays = byDay.filter((d) => d.wins.length).length;

  return (
    <Card className="gap-4">
      <View className="gap-1">
        <Text className="font-body-bold text-overline uppercase text-muted">Daily wins</Text>
        <Text className="font-heading text-heading-card text-ink">
          {wins.length} {wins.length === 1 ? 'win' : 'wins'} across {activeDays} {activeDays === 1 ? 'day' : 'days'}
        </Text>
      </View>
      <Row className="justify-between">
        {byDay.map(({ day, wins: w }, i) => {
          const acc = w.length ? colorOf(w[0].identityId) : null;
          return (
            <View key={day} className="items-center gap-1" accessibilityLabel={`${fmt.dowShort(day)}: ${w.length} ${w.length === 1 ? 'win' : 'wins'}`}>
              <View className="h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: acc ? acc.base : p.chip }}>
                <Text className="font-body-bold text-[13px]" style={{ color: acc ? p.onAccent : p.textMuted }}>
                  {w.length || ''}
                </Text>
              </View>
              <Text className="font-body-semibold text-[11px] text-muted">{WEEKDAY_INITIALS[i]}</Text>
            </View>
          );
        })}
      </Row>
      <View className="gap-3">
        {byDay
          .filter((d) => d.wins.length)
          .map(({ day, wins: w }) => (
            <View key={day} className="gap-1.5">
              <Text className="font-body-semibold text-label text-muted">{fmt.dowShort(day)}</Text>
              {w.map((win, i) => (
                <Row key={i} className="gap-2.5">
                  <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colorOf(win.identityId).base }} />
                  <Text className={win.kind === 'daily' ? 'flex-1 font-body text-body-sm text-ink' : 'flex-1 font-body-semibold text-body-sm text-ink'}>
                    {win.text}
                  </Text>
                </Row>
              ))}
            </View>
          ))}
      </View>
    </Card>
  );
}

const listOf = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

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
  const planData = usePlanData();
  const kept = useMemo(() => plansKept(ws, today(), planData), [ws, planData]);
  const nextWeek = addDays(ws, 7);
  const planning = s.settings.planningEnabled;
  const fullest = useFullestDays(ws, today());

  return (
    <Screen modal header={<NavHeader back={false} left={<HeaderAction label="Close" onPress={() => router.back()} />} />}>
      <View className="gap-2">
        <Text className="font-body text-body-sm text-muted">
          Week of {fmt.short(review.weekStart)} – {fmt.short(review.weekEnd)}
        </Text>
        <Text className="font-heading text-display-lg text-ink">Your week</Text>
        <Text className="font-body text-body-md text-muted">
          Compared with your usual four weeks.
        </Text>
      </View>
      <Card className="gap-4">
        {review.rows.map((r) => {
          const identity = s.identities.find((i) => i.id === r.identityId)!;
          const acc = accentFor(p, identity.accent);
          return (
            <Row key={r.identityId} className="gap-3">
              <Avatar marker={identity.marker} tint={acc.tint} size={36} />
              <View className="flex-1">
                <Text className="text-ink text-[15px] font-body-bold">
                  {r.name}
                </Text>
                <Text className="font-body text-caption text-muted">
                  {r.summary}
                </Text>
              </View>
              <Text style={{ color: r.change !== null && r.change > 0 ? p.positive : p.textMuted }} className="font-body-semibold text-label">
                {formatChange(r.change)}
              </Text>
              <Text className="text-label text-ink w-11 text-right font-body-bold">
                {r.score !== null ? `${r.score}%` : '–'}
              </Text>
            </Row>
          );
        })}
      </Card>
      {review.wins.length ? <DailyWins wins={review.wins} weekStart={review.weekStart} /> : null}
      {fullest.length ? (
        <Text className="font-body text-body-md text-ink">
          Your fullest {fullest.length === 1 ? 'day' : 'days'}: {listOf(fullest.map((d) => fmt.dayName(parseDay(d).getDay())))}.
        </Text>
      ) : null}
      {review.standout ? (
        <Card>
          <Text className="font-body-bold text-overline uppercase text-muted">
            What stood out
          </Text>
          <Text className="font-body text-body-lg text-ink">{review.standout}</Text>
        </Card>
      ) : null}
      {review.skipped.length ? (
        <Text className="font-body text-body-sm text-muted">
          Skipped: {review.skipped.map((x) => `${x.metric}, ${x.days} ${x.days === 1 ? 'day' : 'days'}`).join(' · ')}. Skipped days aren’t counted.
        </Text>
      ) : null}
      {planning && kept.total ? (
        <Text className="font-body text-body-md text-ink">
          You kept {kept.kept} of {kept.total} {kept.total === 1 ? 'plan' : 'plans'} this week.
        </Text>
      ) : null}
      {planning ? (
        <Button
          label={nextWeek > today() ? 'Plan next week' : 'Plan this week'}
          onPress={() => router.push({ pathname: '/plan/week/[weekStart]', params: { weekStart: nextWeek } })}
        />
      ) : null}
      <Button kind="secondary" label="Open dashboard" onPress={() => router.dismissTo('/')} />
    </Screen>
  );
}
