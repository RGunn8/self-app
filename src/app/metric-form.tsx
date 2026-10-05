import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { z } from 'zod';

import { AGG_LABEL } from '@/components/metric';
import { Button, Chip, Field, HeaderAction, Input, KEYBOARD_OFFSET, KeyboardBar, NavHeader, Note, Row, Segmented, T } from '@/components/ui';
import type { Aggregation, Direction, Period, Weight } from '@/db/schema';
import { metricsRepo } from '@/repos';
import { useCreateDraft } from '@/stores/createDraft';
import { useData } from '@/stores/data';
import { layout, radius, space, useTheme } from '@/theme';

const AGG_HELP: Record<Aggregation, string> = {
  total: 'Adds up everything in the period, like miles per week.',
  average: 'The typical value per entry, like hours of sleep a night.',
  count: 'How many times you logged it, like runs per week.',
  max: 'The biggest single entry in the period, like your longest run.',
  min: 'The smallest single entry in the period.',
};

const schema = z.object({
  name: z.string().trim().min(1),
  unit: z.string().trim().min(1),
  target: z.coerce.number().positive(),
});

type Params = { kind: 'create' | 'add' | 'edit'; identityId?: string; metricId?: string };

/** One form, three contexts: creating an identity, adding to an identity, and editing. */
export default function MetricForm() {
  const { kind, identityId, metricId } = useLocalSearchParams<Params>();
  const p = useTheme();
  const s = useData();
  const draftName = useCreateDraft((d) => d.name);
  const existing = s.metrics.find((m) => m.id === metricId);
  const link = s.links.find((l) => l.metricId === metricId && l.identityId === identityId);
  const identity = s.identities.find((i) => i.id === identityId);
  const forName = kind === 'create' ? draftName.trim() || 'this identity' : (identity?.name ?? 'this identity');
  const sharedCount = existing ? new Set(s.links.filter((l) => l.metricId === existing.id).map((l) => l.identityId)).size : 0;

  const [name, setName] = useState(existing?.name ?? '');
  const [aggregation, setAggregation] = useState<Aggregation>(existing?.aggregation ?? 'total');
  const [unit, setUnit] = useState(existing?.unit ?? '');
  const [target, setTarget] = useState(existing ? String(existing.target) : '');
  const [period, setPeriod] = useState<Period>(existing?.period ?? 'week');
  const [direction, setDirection] = useState<Direction>(existing?.direction ?? 'atLeast');
  const [weight, setWeight] = useState<Weight>(link?.weight ?? 2);

  const parsed = schema.safeParse({ name, unit, target });
  const valid = parsed.success;

  const save = () => {
    if (!parsed.success) return;
    const input = {
      name: parsed.data.name,
      unit: parsed.data.unit,
      target: parsed.data.target,
      aggregation,
      period,
      direction,
      source: 'manual' as const,
      defaultAmount: existing?.defaultAmount,
      step: existing?.step,
    };
    if (kind === 'create') {
      useCreateDraft.getState().addMetric({ ...input, tempId: `${Date.now()}`, weight });
    } else if (kind === 'edit' && existing) {
      metricsRepo.update(existing.id, input);
      if (identityId) metricsRepo.setWeight(identityId, existing.id, weight);
    } else if (identityId) {
      const id = metricsRepo.create(input);
      metricsRepo.link(identityId, id, weight);
    }
    router.back();
  };

  const remove = () =>
    Alert.alert(`Remove from ${forName}?`, 'Removing keeps the metric and its history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          metricsRepo.unlink(identityId!, existing!.id);
          router.dismissTo(`/identity/${identityId}`);
        },
      },
    ]);

  const sel = <K extends string>(opts: [K, string][]) => opts.map(([key, label]) => ({ key, label }));

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavHeader left={<HeaderAction label="Cancel" onPress={() => router.back()} />} title={forName} right={<View />} />
      <KeyboardAwareScrollView bottomOffset={KEYBOARD_OFFSET} contentContainerStyle={{ padding: layout.screenGutter, gap: space.xl, paddingBottom: 60 }}>
        <T v="displayMd">{kind === 'edit' ? `Edit ${existing?.name ?? 'metric'}` : 'What do you want to track?'}</T>
        {kind === 'edit' && sharedCount > 1 ? (
          <Note>
            Shared metric · supports {sharedCount} identities. Changes to how it’s measured apply everywhere. Weight only affects {forName}.
          </Note>
        ) : null}
        <Field label="Name">
          <Input value={name} onChangeText={setName} placeholder="Running distance" autoFocus={kind !== 'edit'} />
        </Field>
        <Field label="How should we measure it?" help={AGG_HELP[aggregation]}>
          <Row style={{ flexWrap: 'wrap', gap: 6 }}>
            {(Object.keys(AGG_LABEL) as Aggregation[]).map((k) => (
              <Chip key={k} label={AGG_LABEL[k]} selected={k === aggregation} onPress={() => setAggregation(k)} />
            ))}
          </Row>
        </Field>
        <Row style={{ gap: space.md, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Field label="Unit">
              <Input value={unit} onChangeText={setUnit} placeholder="Miles" autoCapitalize="none" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label={direction === 'atMost' ? 'Limit' : 'Target'}>
              <Input value={target} onChangeText={(t) => setTarget(t.replace(',', '.'))} placeholder="15" keyboardType="decimal-pad" />
            </Field>
          </View>
        </Row>
        <Field label="Time period">
          <Segmented options={sel<Period>([['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly']])} value={period} onChange={setPeriod} />
        </Field>
        <Field label="Goal direction" help="Reaching the target counts as fully aligned. “At most” turns Target into Limit.">
          <Segmented options={sel<Direction>([['atLeast', 'At least'], ['atMost', 'At most']])} value={direction} onChange={setDirection} />
        </Field>
        <Field label={`How much should this count toward ${forName}?`}>
          <Segmented
            options={[
              { key: '1', label: 'Low' },
              { key: '2', label: 'Normal' },
              { key: '4', label: 'High' },
            ]}
            value={String(weight) as '1' | '2' | '4'}
            onChange={(k) => setWeight(Number(k) as Weight)}
          />
        </Field>
        <Field label="Data source">
          {[
            { k: 'Manual', sub: 'You log it with + Log', on: true },
            { k: 'Apple Health', sub: 'Coming in a later version', on: false },
          ].map((o) => (
            <Pressable
              key={o.k}
              disabled={!o.on}
              accessibilityRole="radio"
              accessibilityState={{ checked: o.on, disabled: !o.on }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                paddingVertical: space.md,
                paddingHorizontal: space.lg,
                borderRadius: radius.md,
                backgroundColor: p.card,
                borderWidth: 2,
                borderColor: o.on ? p.selected : p.neutral[300],
                opacity: o.on ? 1 : 0.45,
              }}>
              <View
                style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: o.on ? p.selected : p.neutral[400], backgroundColor: o.on ? p.selected : 'transparent' }}
              />
              <View>
                <T v="label" style={{ fontFamily: 'Figtree_700Bold' }}>
                  {o.k}
                </T>
                <T v="caption" muted>
                  {o.sub}
                </T>
              </View>
            </Pressable>
          ))}
        </Field>
        <Button label={kind === 'edit' ? 'Save changes' : `Add to ${forName}`} disabled={!valid} onPress={save} />
        {kind === 'edit' && identityId && link ? (
          <>
            <Button kind="secondary" label={`Remove from ${forName}`} onPress={remove} />
            <T v="caption" muted style={{ textAlign: 'center', marginTop: -space.md }}>
              Removing keeps the metric and its history.
            </T>
          </>
        ) : null}
      </KeyboardAwareScrollView>
      <KeyboardBar />
    </View>
  );
}
