import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { TimeChoice } from '@/features/planning/components/TimeChoice';
import { suggestWeek, usualTime } from '@/features/planning/domain';
import { offerRemindersOnce } from '@/features/planning/reminders';
import { plansRepo } from '@/features/planning/repo';
import { usePlanData } from '@/features/planning/views';
import { cadenceLabel } from '@/features/systems/domain';
import { Card, HeaderAction, ICON_STROKE, NavHeader, Row, Screen } from '@/shared/components/ui';
import { addDays, fmt, today, WEEKDAY_INITIALS, weekStart as mondayOf } from '@/shared/lib/dates';
import { accentFor, useTheme } from '@/shared/theme';

interface Draft {
  days: number[];
  time: string | null;
}

/**
 * Place each system's sessions on days this week. Days are prefilled from when you usually do
 * them; past days and sessions already done are left as they are.
 */
export default function PlanWeekScreen() {
  const params = useLocalSearchParams<{ weekStart: string }>();
  const p = useTheme();
  const data = usePlanData();
  const ws = mondayOf(/^\d{4}-\d{2}-\d{2}$/.test(params.weekStart) ? params.weekStart : today());
  const t = today();
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const systems = data.systems.filter((s) => s.frequency !== 'asNeeded' && data.systemIdentities.some((l) => l.systemId === s.id));
  const isDone = (systemId: string, day: string) => data.completions.some((c) => c.systemId === systemId && c.date === day);

  // Start from what's already planned this week; otherwise from the usual days.
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const suggested = suggestWeek(systems, data.completions, ws);
    const out: Record<string, Draft> = {};
    for (const s of systems) {
      const planned = data.plans.filter((x) => x.kind === 'system' && x.systemId === s.id && x.status !== 'skipped' && x.day >= ws && x.day <= days[6]);
      const doneDays = days.map((d, i) => (isDone(s.id, d) ? i : -1)).filter((i) => i >= 0);
      const plannedDays = planned.map((x) => days.indexOf(x.day)).filter((i) => i >= 0);
      const chosen = planned.length || doneDays.length ? [...new Set([...plannedDays, ...doneDays])] : (suggested.get(s.id) ?? []);
      out[s.id] = { days: chosen.sort((a, b) => a - b), time: planned.find((x) => x.time)?.time ?? usualTime(data.plans, s.id) };
    }
    return out;
  });

  const toggleDay = (systemId: string, i: number) =>
    setDrafts((cur) => {
      const d = cur[systemId];
      const next = d.days.includes(i) ? d.days.filter((x) => x !== i) : [...d.days, i].sort((a, b) => a - b);
      return { ...cur, [systemId]: { ...d, days: next } };
    });

  const save = () => {
    plansRepo.planWeek(
      ws,
      t,
      systems.map((s) => ({ systemId: s.id, days: drafts[s.id].days, time: drafts[s.id].time })),
      isDone,
    );
    router.back();
    if (systems.some((s) => drafts[s.id].time !== null && drafts[s.id].days.length)) offerRemindersOnce().catch(() => {});
  };

  return (
    <Screen
      header={
        <NavHeader back={false} left={<HeaderAction label="Cancel" onPress={() => router.back()} />} right={<HeaderAction label="Save" bold onPress={save} />} />
      }>
      <View className="gap-2">
        <Text className="font-body text-body-sm text-muted">
          Week of {fmt.short(ws)} – {fmt.short(days[6])}
        </Text>
        <Text className="font-heading text-display-lg text-ink">Plan the week</Text>
        <Text className="font-body text-body-md text-muted">Choose the days for each system. You can still change any day from Today.</Text>
      </View>

      {systems.length === 0 ? (
        <Card>
          <Text className="font-body text-body-md text-muted">
            Systems you do daily or a few times a week show up here. Add one from an identity.
          </Text>
        </Card>
      ) : (
        systems.map((s) => {
          const d = drafts[s.id] ?? { days: [], time: null };
          const host = data.identities.find((i) => data.systemIdentities.some((l) => l.systemId === s.id && l.identityId === i.id));
          const acc = accentFor(p, host?.accent);
          const target = s.frequency === 'daily' ? 7 : s.timesPerWeek;
          return (
            <Card key={s.id}>
              <Row className="justify-between">
                <View className="flex-1">
                  <Text className="font-heading text-heading-card text-ink">{s.name}</Text>
                  <Text className="font-body text-caption text-muted">
                    {cadenceLabel(s.frequency, s.timesPerWeek)}
                    {host ? ` · ${host.name}` : ''}
                  </Text>
                </View>
                <Text className="font-body-semibold text-label text-muted">
                  {d.days.length} of {target}
                </Text>
              </Row>
              <Row className="justify-between">
                {days.map((day, i) => {
                  const done = isDone(s.id, day);
                  const past = day < t;
                  const on = done || d.days.includes(i);
                  return (
                    <Pressable
                      key={day}
                      disabled={done || past}
                      onPress={() => toggleDay(s.id, i)}
                      accessibilityRole="checkbox"
                      accessibilityLabel={fmt.dowShort(day)}
                      accessibilityState={{ checked: on, disabled: done || past }}
                      className="items-center gap-1">
                      <View
                        className="h-9 w-9 items-center justify-center rounded-full"
                        style={{ backgroundColor: on ? acc.base : p.chip, opacity: past && !done ? 0.4 : 1 }}>
                        {done ? (
                          <Check size={16} color={p.onAccent} strokeWidth={ICON_STROKE} />
                        ) : (
                          <Text className="font-body-bold text-[13px]" style={{ color: on ? p.onAccent : p.textMuted }}>
                            {WEEKDAY_INITIALS[i]}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </Row>
              <TimeChoice value={d.time} onChange={(time) => setDrafts((cur) => ({ ...cur, [s.id]: { ...d, time } }))} />
            </Card>
          );
        })
      )}
    </Screen>
  );
}
