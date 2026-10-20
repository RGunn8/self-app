import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { bringToToday } from '@/features/planning/actions';
import { PlanRow } from '@/features/planning/components/PlanRow';
import { dayPlan, fromYesterday, suggestionsFor } from '@/features/planning/domain';
import { plansRepo } from '@/features/planning/repo';
import { usePlanData } from '@/features/planning/views';
import { DayRing } from '@/features/progress/components/DayRing';
import { useDayScore } from '@/features/progress/views';
import { Button, Chip, EmptyState, HeaderAction, ICON_STROKE, Overline, Row } from '@/shared/components/ui';
import { addDays, fmt, greeting, today, weekStart } from '@/shared/lib/dates';
import { useData } from '@/shared/store/data';
import { space, useTheme } from '@/shared/theme';

/** Today's plan: when you'll act as who you want to be. Plans expire with the day; nothing piles up. */
export default function TodayScreen() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const data = usePlanData();
  const userName = useData((s) => s.settings.userName);
  const limit = useData((s) => s.settings.dayPlanLimit);
  const score = useDayScore(today());
  const hasSystems = data.systems.length > 0;
  const hasIdentities = data.identities.some((i) => i.archivedAt === null);
  const t = today();

  const items = useMemo(() => dayPlan(t, data), [t, data]);
  const yesterday = useMemo(() => fromYesterday(t, data), [t, data]);
  const suggestions = useMemo(() => suggestionsFor(t, data).slice(0, 3), [t, data]);

  const planned = items.filter((i) => i.status === 'planned');
  const timed = planned.filter((i) => i.time);
  const anytime = planned.filter((i) => !i.time);
  const done = items.filter((i) => i.status === 'done');
  const skipped = items.filter((i) => i.status === 'skipped');
  const tomorrow = addDays(t, 1);
  const addToday = () => router.push({ pathname: '/plan/[day]', params: { day: t } });

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top + space.md }}>
      <ScrollView contentContainerClassName="px-gutter gap-4" contentContainerStyle={{ paddingBottom: 160 }}>
        <View className="gap-1">
          <Row className="justify-between">
            <Text className="font-body text-body-sm text-muted">
              {greeting()}
              {userName ? `, ${userName}` : ''} · {fmt.dowShort(t)}
            </Text>
            <HeaderAction label="Plan week" onPress={() => router.push({ pathname: '/plan/week/[weekStart]', params: { weekStart: weekStart(t) } })} />
          </Row>
          <Row className="justify-between">
            <Text className="font-heading text-display-lg text-ink">Today</Text>
            {score ? <DayRing score={score} /> : null}
          </Row>
        </View>

        {yesterday.length ? (
          <Row className="justify-between rounded-md border-[1.5px] border-dashed border-field-border px-4 py-3">
            <Text className="flex-1 font-body text-body-sm text-muted">
              {yesterday.length} from yesterday didn’t happen
            </Text>
            <HeaderAction label="Bring over" onPress={() => bringToToday(yesterday)} />
          </Row>
        ) : null}

        {items.length === 0 ? (
          !hasIdentities ? (
            <EmptyState title="Start with an identity" body="Plans belong to who you want to become. Create an identity first." action={<Button label="Create an identity" onPress={() => router.push('/identity/create')} />} />
          ) : (
            <View className="gap-3 rounded-card bg-card p-5">
              <Text className="font-heading text-heading-card text-ink">Plan your day</Text>
              <Text className="font-body text-body-sm text-muted">
                Decide when you’ll act as who you want to be. A time makes it far more likely to happen.
              </Text>
              {suggestions.length ? (
                <Row className="flex-wrap">
                  {suggestions.map((s) => (
                    <Chip key={s.system.id} label={`+ ${s.system.name}`} onPress={() => plansRepo.addSession(s.system.id, t, s.time)} />
                  ))}
                </Row>
              ) : null}
              <Button kind="secondary" label="Plan today" onPress={addToday} />
              {!hasSystems ? (
                <Text className="font-body text-caption text-muted">Systems you create show up here as suggestions.</Text>
              ) : null}
            </View>
          )
        ) : (
          <>
            {timed.length ? (
              <View className="gap-2">
                <Overline>Planned</Overline>
                {timed.map((i) => (
                  <PlanRow key={i.plan.id} item={i} />
                ))}
              </View>
            ) : null}
            {anytime.length ? (
              <View className="gap-2">
                <Overline>Anytime</Overline>
                {anytime.map((i) => (
                  <PlanRow key={i.plan.id} item={i} />
                ))}
              </View>
            ) : null}
            {planned.length > limit ? (
              <Text className="font-body text-caption text-muted">
                More than your {limit} for a day. Leave some room for the unexpected.
              </Text>
            ) : null}
            <Pressable onPress={addToday} accessibilityRole="button" className="flex-row items-center gap-2 py-1">
              <Plus size={18} color={p.textMuted} strokeWidth={ICON_STROKE} />
              <Text className="font-body-semibold text-label text-muted">Add to today</Text>
            </Pressable>
            {done.length ? (
              <View className="gap-2">
                <Overline>Done</Overline>
                {done.map((i) => (
                  <PlanRow key={i.plan.id} item={i} />
                ))}
              </View>
            ) : null}
            {skipped.length ? (
              <View className="gap-2">
                <Overline>Not today</Overline>
                {skipped.map((i) => (
                  <PlanRow key={i.plan.id} item={i} />
                ))}
              </View>
            ) : null}
          </>
        )}

        {hasIdentities ? (
          <Button kind="dashed" label="Plan tomorrow" onPress={() => router.push({ pathname: '/plan/[day]', params: { day: tomorrow } })} />
        ) : null}
      </ScrollView>
    </View>
  );
}
