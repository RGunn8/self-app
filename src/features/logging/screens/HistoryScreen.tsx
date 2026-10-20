import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { dayIdentities, firstLogDay, logByDay } from '@/features/logging/domain';
import { formatAmount } from '@/features/metrics/domain';
import { DayRing } from '@/features/progress/components/DayRing';
import { useDayScore } from '@/features/progress/views';
import { type DayMark, MonthCalendar } from '@/shared/components/calendar';
import { Card, Chip, ListRow, NavHeader, Overline, Row, Screen } from '@/shared/components/ui';
import { fmt, monthStart, today } from '@/shared/lib/dates';
import { useData } from '@/shared/store/data';
import { accentFor, useTheme } from '@/shared/theme';

/** Everything logged across identities as a calendar; pick a day to see what was logged. */
export default function HistoryScreen() {
  const p = useTheme();
  const s = useData();
  const t = today();
  const [month, setMonth] = useState(monthStart(t));
  const [selected, setSelected] = useState(t);
  const [identityId, setIdentityId] = useState<string | null>(null);
  const dayScoreOf = useDayScore(selected);

  const colorOf = useMemo(() => new Map(s.identities.map((i) => [i.id, accentFor(p, i.accent).base])), [s.identities, p]);
  const order = useMemo(() => s.identities.map((i) => i.id), [s.identities]);
  const byDay = useMemo(
    () => logByDay({ entries: s.entries, metrics: s.metrics, links: s.links, completions: s.completions, systems: s.systems, systemIdentities: s.systemIdentities }, identityId),
    [s.entries, s.metrics, s.links, s.completions, s.systems, s.systemIdentities, identityId],
  );
  const marks = useMemo(() => {
    const out = new Map<string, DayMark>();
    for (const [day, log] of byDay) {
      const ids = dayIdentities(log, order, identityId);
      out.set(day, { dots: ids.length ? ids.map((id) => colorOf.get(id) ?? p.textMuted) : [p.textMuted] });
    }
    return out;
  }, [byDay, order, identityId, colorOf, p.textMuted]);

  const first = firstLogDay(s);
  const day = byDay.get(selected);
  const filtered = s.identities.find((i) => i.id === identityId);
  const dot = (ids: string[]) => {
    const c = colorOf.get(identityId ?? ids.find((id) => colorOf.has(id)) ?? '') ?? p.textMuted;
    return <View className="h-[10px] w-[10px] rounded-full" style={{ backgroundColor: c }} />;
  };

  return (
    <Screen header={<NavHeader />} bottomInset={80}>
      <Text className="font-heading text-display-lg text-ink">Log</Text>

      {s.identities.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          <Chip label="All" selected={identityId === null} onPress={() => setIdentityId(null)} />
          {s.identities.map((i) => (
            <Chip key={i.id} label={i.name} selected={identityId === i.id} onPress={() => setIdentityId(i.id)} />
          ))}
        </ScrollView>
      ) : null}

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
      </Card>

      <View className="gap-2">
        <Row className="justify-between">
          <Text className="font-body-semibold text-label text-muted">{fmt.dowShort(selected)}</Text>
          {dayScoreOf && !identityId ? <DayRing score={dayScoreOf} compact /> : null}
        </Row>
        {day ? (
          <>
            {day.entries.length ? (
              <>
                <Overline>Tracked</Overline>
                {day.entries.map(({ entry, metric, identityIds }) => (
                  <ListRow
                    key={entry.id}
                    left={dot(identityIds)}
                    title={metric.name}
                    sub={`${entry.systemCompletionId ? 'System' : 'Manual'} · ${fmt.time(entry.loggedAt)}`}
                    onPress={() => router.push(`/entry/${entry.id}`)}
                    right={
                      <Text className="text-label text-ink font-body-bold">
                        {formatAmount(entry.value, metric.unit)}
                      </Text>
                    }
                  />
                ))}
              </>
            ) : null}
            {day.systems.length ? (
              <>
                <Overline>Systems</Overline>
                {day.systems.map(({ completion, system, identityIds }) => (
                  <ListRow
                    key={completion.id}
                    left={dot(identityIds)}
                    title={`✓ ${system.name}`}
                    sub="Done"
                    onPress={() => router.push(`/system/${system.id}`)}
                  />
                ))}
              </>
            ) : null}
          </>
        ) : (
          <View className="p-4 rounded-md border-[1.5px] border-dashed border-field-border">
            <Text className="font-body-semibold text-label text-ink">Nothing logged this day</Text>
            {filtered ? <Text className="font-body text-caption text-muted">for {filtered.name}</Text> : null}
          </View>
        )}
      </View>
    </Screen>
  );
}
