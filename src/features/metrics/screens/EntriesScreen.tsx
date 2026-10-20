import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Entry } from '@/features/logging/model';
import { entriesRepo } from '@/features/logging/repo';
import { formatValue } from '@/features/metrics/domain';
import { toast } from '@/shared/components/toast';
import { Button, Chip, EmptyState, NavHeader, Row } from '@/shared/components/ui';
import { addDays, dayKey, daysBetween, fmt, today } from '@/shared/lib/dates';
import { useData } from '@/shared/store/data';

type Item = { kind: 'entry'; entry: Entry } | { kind: 'skipped'; day: string };

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'manual', label: 'Manual' },
  { key: 'system', label: 'From systems' },
] as const;

export default function EntriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const s = useData();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const metric = s.metrics.find((m) => m.id === id);

  const sections = useMemo(() => {
    if (!metric) return [];
    const mine = s.entries.filter(
      (e) =>
        e.metricId === metric.id &&
        (filter === 'all' || (filter === 'manual' ? !e.systemCompletionId : !!e.systemCompletionId)),
    );
    const byDay = new Map<string, Entry[]>();
    for (const e of mine) {
      const k = dayKey(e.loggedAt);
      byDay.set(k, [...(byDay.get(k) ?? []), e]);
    }
    // Skipped rows are computed for daily metrics only (last 60 days); never stored.
    if (metric.period === 'day' && filter === 'all' && mine.length) {
      const first = dayKey(mine[mine.length - 1].loggedAt);
      const from = first > addDays(today(), -59) ? first : addDays(today(), -59);
      for (const d of daysBetween(from, today())) if (!byDay.has(d)) byDay.set(d, []);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([day, es]) => ({
        title: day,
        data: (es.length ? es.map((entry) => ({ kind: 'entry', entry })) : [{ kind: 'skipped', day }]) as Item[],
      }));
  }, [metric, s.entries, filter]);

  if (!metric) return null;
  const skippedCount = sections.filter((x) => x.data[0]?.kind === 'skipped' && x.title >= addDays(today(), -29)).length;
  const total = s.entries.filter((e) => e.metricId === metric.id).length;

  const remove = (e: Entry) => {
    entriesRepo.remove(e.id);
    toast('Entry deleted', { label: 'Undo', onPress: () => entriesRepo.restore(e.id) });
  };

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <NavHeader backLabel={metric.name} />
      <SectionList
        sections={sections}
        keyExtractor={(r) => (r.kind === 'entry' ? r.entry.id : `skip-${r.day}`)}
        stickySectionHeadersEnabled={false}
        contentContainerClassName="px-gutter gap-2" contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
        ListHeaderComponent={
          <View className="gap-3 pb-3">
            <Text className="font-heading text-display-lg text-ink">Entries</Text>
            <Text className="font-body text-body-sm text-muted">
              {total} {total === 1 ? 'entry' : 'entries'}
              {metric.period === 'day' ? ` · ${skippedCount} ${skippedCount === 1 ? 'day' : 'days'} skipped in the last 30. Skipped days are not counted.` : ''}
            </Text>
            <Row>
              {FILTERS.map((f) => (
                <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />
              ))}
            </Row>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No entries yet"
            body="Entries you log show up here."
            action={<Button label="Log one now" onPress={() => router.push({ pathname: '/log', params: { metricId: metric.id } })} />}
          />
        }
        renderSectionHeader={({ section }) => (
          <Text className="font-body-semibold text-label text-muted pt-3">
            {fmt.dowShort(section.title)}
          </Text>
        )}
        renderItem={({ item }) =>
          item.kind === 'skipped' ? (
            <Row className="p-4 rounded-md border-[1.5px] border-dashed border-field-border">
              <View className="flex-1">
                <Text className="font-body-semibold text-label text-ink">Skipped</Text>
                <Text className="font-body text-caption text-muted">
                  No data this day · not counted
                </Text>
              </View>
              <Chip
                label="Add"
                onPress={() => router.push({ pathname: '/log', params: { metricId: metric.id } })}
              />
            </Row>
          ) : (
            <ReanimatedSwipeable
              friction={2}
              rightThreshold={40}
              renderRightActions={() => (
                <Row className="gap-1 pl-2">
                  <Pressable
                    onPress={() => router.push(`/entry/${item.entry.id}`)}
                    className="h-full px-4 justify-center rounded-md bg-chip">
                    <Text className="font-body-semibold text-label text-ink">Edit</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => remove(item.entry)}
                    className="h-full px-4 justify-center rounded-md bg-selected">
                    <Text className="font-body-semibold text-label text-on-selected">
                      Delete
                    </Text>
                  </Pressable>
                </Row>
              )}>
              <Pressable
                onPress={() => router.push(`/entry/${item.entry.id}`)}
                className="flex-row items-center p-4 rounded-md bg-card">
                <View className="flex-1">
                  <Text className="font-body-bold text-ink text-[18px] leading-[22px]">
                    {formatValue(item.entry.value)} {metric.unit}
                  </Text>
                  <Text className="font-body text-caption text-muted">
                    {item.entry.systemCompletionId ? 'System' : 'Manual'} · {fmt.time(item.entry.loggedAt)}
                  </Text>
                </View>
              </Pressable>
            </ReanimatedSwipeable>
          )
        }
      />
    </View>
  );
}
