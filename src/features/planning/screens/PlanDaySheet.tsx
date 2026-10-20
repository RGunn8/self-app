import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { TimeChoice } from '@/features/planning/components/TimeChoice';
import { dayPlan, formatTime, suggestionsFor } from '@/features/planning/domain';
import { offerRemindersOnce } from '@/features/planning/reminders';
import { plansRepo } from '@/features/planning/repo';
import { usePlanData } from '@/features/planning/views';
import { cadenceLabel } from '@/features/systems/domain';
import { Button, Chip, Field, Input, Overline, Row } from '@/shared/components/ui';
import { addDays, fmt, today } from '@/shared/lib/dates';
import { useData } from '@/shared/store/data';
import { accentFor, useTheme } from '@/shared/theme';

function dayTitle(day: string) {
  const t = today();
  if (day === t) return 'Plan today';
  if (day === addDays(t, 1)) return 'Plan tomorrow';
  return `Plan ${fmt.dowShort(day)}`;
}

/** Decide what you'll do on a day, and when: system sessions and identity intentions. */
export default function PlanDaySheet() {
  const { day } = useLocalSearchParams<{ day: string }>();
  const p = useTheme();
  const data = usePlanData();
  const metrics = useData((s) => s.metrics);
  const links = useData((s) => s.links);
  const limit = useData((s) => s.settings.dayPlanLimit);
  const identities = data.identities.filter((i) => i.archivedAt === null);
  const already = useMemo(() => dayPlan(day, data).filter((i) => i.status !== 'skipped'), [day, data]);
  const suggestions = useMemo(() => suggestionsFor(day, data), [day, data]);

  // Sessions picked from the suggestions, with their times.
  const [picked, setPicked] = useState<Record<string, string | null>>({});
  // A new intention.
  const [title, setTitle] = useState('');
  const [identityId, setIdentityId] = useState<string | null>(identities.length === 1 ? identities[0].id : null);
  const [time, setTime] = useState<string | null>(null);
  const [metricId, setMetricId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');

  const identityMetrics = useMemo(() => {
    const ids = new Set(links.filter((l) => l.identityId === identityId).map((l) => l.metricId));
    return metrics.filter((m) => ids.has(m.id));
  }, [links, metrics, identityId]);
  const metric = identityMetrics.find((m) => m.id === metricId);
  const amountValue = Number(amount);
  const intentionReady = title.trim() !== '' && identityId !== null && (!metric || (amount.trim() !== '' && Number.isFinite(amountValue) && amountValue >= 0));
  const intentionStarted = title.trim() !== '';
  const pickedIds = Object.keys(picked);
  const canSave = pickedIds.length > 0 || intentionReady;

  const toggle = (systemId: string, time: string | null) =>
    setPicked((cur) => {
      const next = { ...cur };
      if (systemId in next) delete next[systemId];
      else next[systemId] = time;
      return next;
    });

  const save = () => {
    for (const id of pickedIds) plansRepo.addSession(id, day, picked[id]);
    if (intentionReady) {
      plansRepo.addIntention({ day, time, identityId: identityId!, title, metricId: metric?.id ?? null, amount: metric ? amountValue : null });
    }
    router.back();
    if (Object.values(picked).some((t) => t !== null) || (intentionReady && time !== null)) offerRemindersOnce().catch(() => {});
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="p-gutter pt-6 gap-5 pb-10">
      <View className="gap-1">
        <Text className="font-heading text-display-sm text-ink">{dayTitle(day)}</Text>
        <Text className="font-body text-body-md text-muted">
          {already.length
            ? `Already planned: ${already.map((i) => (i.time ? `${i.title} ${formatTime(i.time)}` : i.title)).join(' · ')}`
            : 'Pick a few things that matter. Leave room for the day to happen.'}
        </Text>
      </View>

      {suggestions.length ? (
        <View className="gap-2">
          <Overline>Systems</Overline>
          {suggestions.map((s) => {
            const on = s.system.id in picked;
            const host = data.identities.find((i) => i.id === s.identityIds[0]);
            const acc = accentFor(p, host?.accent);
            return (
              <View key={s.system.id} className="gap-3 rounded-md bg-card px-4 py-3">
                <Pressable onPress={() => toggle(s.system.id, s.time)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} className="flex-row items-center gap-3">
                  <View className="h-6 w-6 rounded-full border-2" style={{ borderColor: acc.base, backgroundColor: on ? acc.base : 'transparent' }} />
                  <View className="flex-1">
                    <Text className="font-body-bold text-[15px] text-ink">{s.system.name}</Text>
                    <Text className="font-body text-caption text-muted">
                      {cadenceLabel(s.system.frequency, s.system.timesPerWeek)}
                      {s.remaining !== null ? ` · ${s.remaining} left this week` : ''}
                    </Text>
                  </View>
                </Pressable>
                {on ? <TimeChoice value={picked[s.system.id]} onChange={(v) => setPicked((cur) => ({ ...cur, [s.system.id]: v }))} fallback={s.time ?? '09:00'} /> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      <View className="gap-3">
        <Overline>An intention</Overline>
        <Input value={title} onChangeText={setTitle} placeholder="Call mom after lunch, read before bed…" returnKeyType="done" />
        {intentionStarted ? (
          <>
            <Field label="For who you want to be">
              <Row className="flex-wrap">
                {identities.map((i) => (
                  <Chip
                    key={i.id}
                    label={i.name}
                    selected={identityId === i.id}
                    onPress={() => {
                      setIdentityId(i.id);
                      setMetricId(null);
                    }}
                  />
                ))}
              </Row>
            </Field>
            <Field label="When">
              <TimeChoice value={time} onChange={setTime} />
            </Field>
            {identityMetrics.length ? (
              <Field label="Log it when done (optional)">
                <Row className="flex-wrap">
                  <Chip label="Don’t log" selected={metricId === null} onPress={() => setMetricId(null)} />
                  {identityMetrics.map((m) => (
                    <Chip
                      key={m.id}
                      label={m.name}
                      selected={metricId === m.id}
                      onPress={() => {
                        setMetricId(m.id);
                        setAmount(String(m.defaultAmount));
                      }}
                    />
                  ))}
                </Row>
                {metric ? (
                  <Row className="gap-2">
                    <View className="flex-1">
                      <Input value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount" />
                    </View>
                    <Text className="font-body-semibold text-label text-muted">{metric.unit}</Text>
                  </Row>
                ) : null}
              </Field>
            ) : null}
          </>
        ) : null}
      </View>

      {already.filter((i) => i.status === 'planned').length + pickedIds.length + (intentionReady ? 1 : 0) > limit ? (
        <Text className="font-body text-caption text-muted">That’s more than your {limit} for a day. You can still add it.</Text>
      ) : null}
      <Button label={canSave ? 'Add to plan' : 'Pick something to plan'} disabled={!canSave} onPress={save} />
    </ScrollView>
  );
}
