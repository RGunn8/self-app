import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { aggregate, calendarMonths, formatAmount } from '@/features/metrics/domain';
import { type DayMark, MonthCalendar } from '@/shared/components/calendar';
import { Card, Chip, NavHeader, Row, Screen } from '@/shared/components/ui';
import { dayKey, fmt, monthStart, today } from '@/shared/lib/dates';
import { pointsOf, useData } from '@/shared/store/data';
import { accentFor, useTheme } from '@/shared/theme';

/** A metric's whole history as a calendar; pick a day to see what was tracked. */
export default function MetricCalendarScreen() {
  const { id, fromIdentityId } = useLocalSearchParams<{ id: string; fromIdentityId?: string }>();
  const p = useTheme();
  const s = useData();
  const t = today();
  const [month, setMonth] = useState(monthStart(t));
  const [selected, setSelected] = useState(t);
  const metric = s.metrics.find((m) => m.id === id);
  const from = s.identities.find((i) => i.id === fromIdentityId);
  const color = from ? accentFor(p, from.accent).base : p.neutral[700];

  const mine = pointsOf(s, id);
  const cal = useMemo(() => (metric ? calendarMonths(metric, mine, t) : null), [metric, mine, t]);
  const marks = useMemo(() => {
    const out = new Map<string, DayMark>();
    if (!cal) return out;
    for (const m of cal.months) {
      for (const d of m.days) {
        if (d.value === null) continue;
        const ratio = cal.max > 0 ? Math.max(0, Math.min(1, d.value / cal.max)) : 1;
        out.set(d.day, { fill: { color, opacity: 0.3 + 0.7 * ratio } });
      }
    }
    return out;
  }, [cal, color]);
  const dayEntries = useMemo(
    () => s.entries.filter((e) => e.metricId === id && dayKey(e.loggedAt) === selected).sort((a, b) => a.loggedAt - b.loggedAt),
    [s.entries, id, selected],
  );

  if (!metric || !cal) return <Screen header={<NavHeader />} />;

  const first = mine.length ? mine[mine.length - 1].day : null;
  const shownMonth = cal.months.find((m) => m.key === month);
  const dayValue = aggregate(
    dayEntries.map((e) => e.value),
    metric.aggregation,
  );
  const log = () => router.push({ pathname: '/log', params: { metricId: metric.id } });

  return (
    <Screen header={<NavHeader backLabel={metric.name} />} bottomInset={80}>
      <View className="gap-1">
        <Text className="font-heading text-display-lg text-ink">History</Text>
        <Text className="font-body text-body-sm text-muted">
          {mine.length} {mine.length === 1 ? 'entry' : 'entries'}
          {first ? ` since ${fmt.long(first)}` : ''}
        </Text>
      </View>

      <Card>
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          minMonth={first ? monthStart(first) : monthStart(t)}
          maxMonth={monthStart(t)}
          selected={selected}
          onSelect={setSelected}
          marks={marks}
        />
        {shownMonth?.value !== null && shownMonth?.value !== undefined ? (
          <Text className="font-body text-caption text-muted">
            {fmt.month(month)} · {formatAmount(shownMonth.value, metric.unit)}
          </Text>
        ) : null}
      </Card>

      <View className="gap-2">
        <Text className="font-body-semibold text-label text-muted">
          {fmt.dowShort(selected)}
          {dayEntries.length ? ` · ${formatAmount(dayValue, metric.unit)}` : ''}
        </Text>
        {dayEntries.length ? (
          dayEntries.map((e) => (
            <Pressable key={e.id} onPress={() => router.push(`/entry/${e.id}`)} className="flex-row items-center p-4 rounded-md bg-card">
              <View className="flex-1">
                <Text className="font-body-bold text-ink text-[18px] leading-[22px]">
                  {formatAmount(e.value, metric.unit)}
                </Text>
                <Text className="font-body text-caption text-muted">
                  {e.systemCompletionId ? 'System' : 'Manual'} · {fmt.time(e.loggedAt)}
                </Text>
              </View>
            </Pressable>
          ))
        ) : (
          <Row className="p-4 rounded-md border-[1.5px] border-dashed border-field-border">
            <View className="flex-1">
              <Text className="font-body-semibold text-label text-ink">Nothing tracked this day</Text>
              <Text className="font-body text-caption text-muted">No {metric.name.toLowerCase()} logged</Text>
            </View>
            <Chip label="Log" onPress={log} />
          </Row>
        )}
      </View>
    </Screen>
  );
}
