import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { toast } from '@/components/overlay';
import { Button, Chip, EmptyState, NavHeader, Row, T } from '@/components/ui';
import type { Entry } from '@/db/schema';
import { formatValue } from '@/domain/metrics';
import { addDays, dayKey, daysBetween, fmt, today } from '@/lib/dates';
import { entriesRepo } from '@/repos';
import { useData } from '@/stores/data';
import { layout, radius, space, useTheme } from '@/theme';

type Item = { kind: 'entry'; entry: Entry } | { kind: 'skipped'; day: string };

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'manual', label: 'Manual' },
  { key: 'system', label: 'From systems' },
] as const;

export default function EntriesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useTheme();
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
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top }}>
      <NavHeader backLabel={metric.name} />
      <SectionList
        sections={sections}
        keyExtractor={(r) => (r.kind === 'entry' ? r.entry.id : `skip-${r.day}`)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: layout.screenGutter, paddingBottom: insets.bottom + 100, gap: space.sm }}
        ListHeaderComponent={
          <View style={{ gap: space.md, paddingBottom: space.md }}>
            <T v="displayLg">Entries</T>
            <T v="bodySm" muted>
              {total} {total === 1 ? 'entry' : 'entries'}
              {metric.period === 'day' ? ` · ${skippedCount} ${skippedCount === 1 ? 'day' : 'days'} skipped in the last 30. Skipped days are not counted.` : ''}
            </T>
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
          <T v="label" muted style={{ paddingTop: space.md }}>
            {fmt.dowShort(section.title)}
          </T>
        )}
        renderItem={({ item }) =>
          item.kind === 'skipped' ? (
            <Row style={{ padding: space.lg, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: p.fieldBorder }}>
              <View style={{ flex: 1 }}>
                <T v="label">Skipped</T>
                <T v="caption" muted>
                  No data this day · not counted
                </T>
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
                <Row style={{ gap: space.xs, paddingLeft: space.sm }}>
                  <Pressable
                    onPress={() => router.push(`/entry/${item.entry.id}`)}
                    style={{ height: '100%', paddingHorizontal: space.lg, justifyContent: 'center', borderRadius: radius.md, backgroundColor: p.chip }}>
                    <T v="label">Edit</T>
                  </Pressable>
                  <Pressable
                    onPress={() => remove(item.entry)}
                    style={{ height: '100%', paddingHorizontal: space.lg, justifyContent: 'center', borderRadius: radius.md, backgroundColor: p.selected }}>
                    <T v="label" color={p.onSelected}>
                      Delete
                    </T>
                  </Pressable>
                </Row>
              )}>
              <Pressable
                onPress={() => router.push(`/entry/${item.entry.id}`)}
                style={{ flexDirection: 'row', alignItems: 'center', padding: space.lg, borderRadius: radius.md, backgroundColor: p.card }}>
                <View style={{ flex: 1 }}>
                  <T v="metricSm" style={{ fontSize: 18, lineHeight: 22 }}>
                    {formatValue(item.entry.value)} {metric.unit}
                  </T>
                  <T v="caption" muted>
                    {item.entry.systemCompletionId ? 'System' : 'Manual'} · {fmt.time(item.entry.loggedAt)}
                  </T>
                </View>
              </Pressable>
            </ReanimatedSwipeable>
          )
        }
      />
    </View>
  );
}
