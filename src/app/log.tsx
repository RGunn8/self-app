import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { DateTimeCard } from '@/components/entryEditor';
import { toast } from '@/components/overlay';
import { Button, Chip, ICON_STROKE, KEYBOARD_OFFSET, KeyboardBar, Overline, Row, Stepper, T } from '@/components/ui';
import type { Metric } from '@/db/schema';
import { today } from '@/lib/dates';
import { entriesRepo } from '@/repos';
import { useData } from '@/stores/data';
import { supportersOf } from '@/stores/derived';
import { layout, radius, space, useTheme } from '@/theme';

/** Step 1: pick a metric. Step 2: value, date, time. Defaults keep it to two or three taps. */
export default function LogSheet() {
  const params = useLocalSearchParams<{ metricId?: string }>();
  const p = useTheme();
  const s = useData();
  const [metricId, setMetricId] = useState<string | undefined>(params.metricId);
  const metric = s.metrics.find((m) => m.id === metricId);
  return (
    <View style={{ flex: 1 }}>
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
    <KeyboardAwareScrollView bottomOffset={KEYBOARD_OFFSET} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: layout.screenGutter, paddingTop: space.xxl, gap: space.lg }}>
      <T v="displaySm">What did you do?</T>
      {runnable.length ? (
        <View style={{ gap: space.sm }}>
          <Overline>Run a system</Overline>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
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
      <Row style={{ height: 46, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: p.card }}>
        <Search size={18} color={p.textMuted} strokeWidth={ICON_STROKE} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search metrics…"
          placeholderTextColor={p.neutral[500]}
          style={{ flex: 1, color: p.text, fontFamily: 'Figtree_600SemiBold', fontSize: 15 }}
        />
      </Row>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {items.map(({ m, sub }) => (
          <Pressable
            key={m.id}
            onPress={() => onPick(m.id)}
            accessibilityRole="button"
            style={({ pressed }) => ({
              width: '48.5%',
              minHeight: 76,
              padding: space.lg,
              borderRadius: radius.md,
              backgroundColor: pressed ? p.chip : p.card,
              gap: 2,
            })}>
            <T v="label" style={{ fontSize: 15, fontFamily: 'Figtree_700Bold' }}>
              {m.name}
            </T>
            <T v="caption" muted numberOfLines={1}>
              {sub}
            </T>
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
    try {
      entriesRepo.add(metric.id, n, when.getTime());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
      toast(`Logged ${metric.name}${supporters.length ? `. Counts toward ${supporters.join(', ')}` : ''}`);
    } catch {
      // Rare local write failure: keep the value so nothing has to be re-entered.
      setError(true);
    }
  };

  return (
    <KeyboardAwareScrollView bottomOffset={KEYBOARD_OFFSET} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: layout.screenGutter, paddingTop: space.xl, gap: space.xl }}>
      <Row style={{ justifyContent: 'space-between' }}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ChevronLeft size={20} color={p.text} strokeWidth={ICON_STROKE} />
            <T v="label">All</T>
          </Pressable>
        ) : (
          <View />
        )}
        <T v="headingCard">{metric.name}</T>
        <View style={{ width: 40 }} />
      </Row>
      <Stepper value={value} onChange={setValue} step={metric.step} unit={metric.unit} />
      <DateTimeCard value={when} onChange={setWhen} />
      {supporters.length ? (
        <T v="label" muted style={{ textAlign: 'center' }}>
          Counts toward {supporters.join(', ')}
        </T>
      ) : null}
      {error ? (
        <View style={{ padding: space.lg, borderRadius: radius.md, backgroundColor: p.chip }}>
          <T v="bodySm">Couldn’t save that entry. It’s still here, so try again.</T>
        </View>
      ) : null}
      <Button label={error ? 'Try again' : 'Add'} disabled={!valid} onPress={add} />
    </KeyboardAwareScrollView>
  );
}
