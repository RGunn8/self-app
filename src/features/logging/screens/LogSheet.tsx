import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { supportersOf } from '@/features/identities/views';
import { DateTimeCard } from '@/features/logging/components/DateTimeCard';
import { entriesRepo } from '@/features/logging/repo';
import type { Metric } from '@/features/metrics/model';
import { celebrate } from '@/features/progress/components/MomentCard';
import { afterLog } from '@/features/progress/views';
import { toast } from '@/shared/components/toast';
import { Button, Chip, ICON_STROKE, KEYBOARD_OFFSET, KeyboardBar, Overline, Row, Stepper } from '@/shared/components/ui';
import { dayKey, today } from '@/shared/lib/dates';
import { useData } from '@/shared/store/data';
import { useTheme } from '@/shared/theme';

/** Step 1: pick a metric. Step 2: value, date, time. Defaults keep it to two or three taps. */
export default function LogSheet() {
  const params = useLocalSearchParams<{ metricId?: string }>();
  const p = useTheme();
  const s = useData();
  const [metricId, setMetricId] = useState<string | undefined>(params.metricId);
  const metric = s.metrics.find((m) => m.id === metricId);
  return (
    <View className="flex-1">
      {metric ? <ValueStep metric={metric} onBack={params.metricId ? undefined : () => setMetricId(undefined)} /> : <PickStep onPick={setMetricId} p={p} />}
      <KeyboardBar />
    </View>
  );
}

function PickStep({ onPick, p }: { onPick: (id: string) => void; p: ReturnType<typeof useTheme> }) {
  const s = useData();
  const [q, setQ] = useState('');
  const items = useMemo(
    () =>
      s.metrics
        .filter((m) => m.name.toLowerCase().includes(q.trim().toLowerCase()))
        .map((m) => ({ m, sub: supportersOf(s, m.id).map((i) => i.name).join(' · ') }))
        .filter((x) => x.sub),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.version, q],
  );
  const runnable = s.systems.filter((sys) => !s.completions.some((c) => c.systemId === sys.id && c.date === today()));

  return (
    <KeyboardAwareScrollView bottomOffset={KEYBOARD_OFFSET} keyboardShouldPersistTaps="handled" contentContainerClassName="p-gutter pt-6 gap-4">
      <Text className="font-heading text-display-sm text-ink">What did you do?</Text>
      {runnable.length ? (
        <View className="gap-2">
          <Overline>Run a system</Overline>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {runnable.map((sys) => (
              <Chip
                key={sys.id}
                label={sys.name}
                onPress={() => {
                  router.back();
                  router.push(`/system/${sys.id}`);
                }}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}
      <Row className="h-[46px] px-4 rounded-pill bg-card">
        <Search size={18} color={p.textMuted} strokeWidth={ICON_STROKE} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search metrics…"
          placeholderTextColor={p.neutral[500]}
          className="flex-1 text-ink font-body-semibold text-[15px]"
        />
      </Row>
      <View className="flex-row flex-wrap gap-2">
        {items.map(({ m, sub }) => (
          <Pressable
            key={m.id}
            onPress={() => onPick(m.id)}
            accessibilityRole="button"
            className="w-[48.5%] min-h-[76px] p-4 rounded-md bg-card active:bg-chip gap-0.5">
            <Text className="text-ink text-[15px] font-body-bold">
              {m.name}
            </Text>
            <Text numberOfLines={1} className="font-body text-caption text-muted">
              {sub}
            </Text>
          </Pressable>
        ))}
      </View>
    </KeyboardAwareScrollView>
  );
}

function ValueStep({ metric, onBack }: { metric: Metric; onBack?: () => void }) {
  const p = useTheme();
  const s = useData();
  const [value, setValue] = useState(String(metric.defaultAmount));
  const [when, setWhen] = useState(new Date());
  const [error, setError] = useState(false);
  const supporters = supportersOf(s, metric.id).map((i) => i.name);
  const n = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(n) && n >= 0;

  const add = () => {
    const before = useData.getState();
    try {
      entriesRepo.add(metric.id, n, when.getTime());
    } catch {
      // Rare local write failure: keep the value so nothing has to be re-entered.
      setError(true);
      return;
    }
    router.back();
    const { moment, line } = afterLog(before, { kind: 'entry', metricId: metric.id, value: n, day: dayKey(when) }, `Logged ${metric.name}`);
    if (moment) {
      celebrate(moment);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(line);
    }
  };

  return (
    <KeyboardAwareScrollView bottomOffset={KEYBOARD_OFFSET} keyboardShouldPersistTaps="handled" contentContainerClassName="p-gutter pt-5 gap-5">
      <Row className="justify-between">
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={8} className="flex-row items-center">
            <ChevronLeft size={20} color={p.text} strokeWidth={ICON_STROKE} />
            <Text className="font-body-semibold text-label text-ink">All</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Text className="font-heading text-heading-card text-ink">{metric.name}</Text>
        <View className="w-10" />
      </Row>
      <Stepper value={value} onChange={setValue} step={metric.step} unit={metric.unit} />
      <DateTimeCard value={when} onChange={setWhen} />
      {supporters.length ? (
        <Text className="font-body-semibold text-label text-muted text-center">
          Counts toward {supporters.join(', ')}
        </Text>
      ) : null}
      {error ? (
        <View className="p-4 rounded-md bg-chip">
          <Text className="font-body text-body-sm text-ink">Couldn’t save that entry. It’s still here, so try again.</Text>
        </View>
      ) : null}
      <Button label={error ? 'Try again' : 'Add'} disabled={!valid} onPress={add} />
    </KeyboardAwareScrollView>
  );
}
