import { router } from 'expo-router';
import { CalendarDays, Settings as Gear } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IdentityCard } from '@/features/identities/components/IdentityCard';
import { PRIORITIES, useIdentityViews } from '@/features/identities/views';
import { TodayStrip } from '@/features/planning/components/TodayStrip';
import { formatValue } from '@/features/metrics/domain';
import { DayRing } from '@/features/progress/components/DayRing';
import { useDayScore } from '@/features/progress/views';
import { Button, Card, EmptyState, HeaderAction, ICON_STROKE, ListRow, Overline, Row } from '@/shared/components/ui';
import { fmt, greeting, today } from '@/shared/lib/dates';
import { useData } from '@/shared/store/data';
import { space, useTheme } from '@/shared/theme';

export default function IdentitiesTab() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const views = useIdentityViews();
  const userName = useData((s) => s.settings.userName);
  const score = useDayScore(today());
  const entries = useData((s) => s.entries);
  const metrics = useData((s) => s.metrics);

  const sections = useMemo(
    () =>
      PRIORITIES.map((pr) => ({ key: pr.key, title: pr.label, data: views.filter((v) => v.identity.priority === pr.key) })).filter(
        (s) => s.data.length > 0,
      ),
    [views],
  );

  const recent = useMemo(() => {
    const byId = new Map(metrics.map((m) => [m.id, m]));
    return entries
      .slice(0, 3)
      .map((e) => ({ e, m: byId.get(e.metricId) }))
      .filter((x) => x.m);
  }, [entries, metrics]);

  const header = (
    <View className="gap-1 pb-2">
      <Row className="justify-between">
        <Text className="font-body text-body-sm text-muted">
          {greeting()}
          {userName ? `, ${userName}` : ''} · {fmt.dowShort(today())}
        </Text>
        <Row className="gap-4">
          <Pressable onPress={() => router.push('/history')} hitSlop={10} accessibilityLabel="Log calendar" accessibilityRole="button">
            <CalendarDays size={22} color={p.textMuted} strokeWidth={ICON_STROKE} />
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} hitSlop={10} accessibilityLabel="Settings" accessibilityRole="button">
            <Gear size={22} color={p.textMuted} strokeWidth={ICON_STROKE} />
          </Pressable>
        </Row>
      </Row>
      {score && views.length ? <DayRing score={score} compact prefix="Today" /> : null}
      <Text className="font-heading text-display-lg text-ink">{views.length ? 'How are you living lately?' : 'Who do you want to become?'}</Text>
      {views.length ? <TodayStrip /> : null}
    </View>
  );

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top + space.md }}>
      <SectionList
        sections={sections}
        keyExtractor={(v) => v.identity.id}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="px-gutter pb-[120px] gap-3"
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => (
          <View className="pt-4">
            <Overline>{section.title}</Overline>
          </View>
        )}
        renderItem={({ item }) => <IdentityCard view={item} />}
        ListEmptyComponent={
          <EmptyState
            title="Start with one identity"
            body="You’ll decide what it means and what to track. For example: a runner, a present parent, a writer."
            action={<Button label="Create your first identity" onPress={() => router.push('/identity/create')} className="self-stretch" />}
          />
        }
        ListFooterComponent={
          views.length ? (
            <View className="gap-3 pt-6">
              {recent.length ? (
                <>
                  <Row className="justify-between">
                    <Overline>Recently logged</Overline>
                    <HeaderAction label="See all" onPress={() => router.push('/history')} />
                  </Row>
                  <Card className="p-1 gap-0">
                    {recent.map(({ e, m }) => (
                      <ListRow
                        key={e.id}
                        title={m!.name}
                        sub={`${e.source === 'manual' ? 'Logged' : 'Apple Health'} · ${fmt.time(e.loggedAt)}`}
                        onPress={() => router.push(`/entry/${e.id}`)}
                        right={
                          <Text className="text-label text-ink font-body-bold">
                            {formatValue(e.value)} {m!.unit}
                          </Text>
                        }
                      />
                    ))}
                  </Card>
                </>
              ) : null}
              <Button kind="dashed" label="+ New identity" onPress={() => router.push('/identity/create')} />
            </View>
          ) : null
        }
      />
    </View>
  );
}
