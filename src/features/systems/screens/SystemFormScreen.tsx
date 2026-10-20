import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import type { Frequency } from '@/features/systems/model';
import { systemsRepo } from '@/features/systems/repo';
import { Button, Chip, Field, HeaderAction, ICON_STROKE, Input, KEYBOARD_OFFSET, KeyboardBar, NavHeader, Note, Row, Segmented } from '@/shared/components/ui';
import { useData } from '@/shared/store/data';
import { useTheme } from '@/shared/theme';

interface StepDraft {
  key: string;
  id?: string;
  name: string;
  metricId: string | null;
}

/** Create and edit. Steps can log to any metric in the identities picked. */
export default function SystemForm() {
  const { systemId, identityId } = useLocalSearchParams<{ systemId?: string; identityId?: string }>();
  const p = useTheme();
  const s = useData();
  const existing = s.systems.find((x) => x.id === systemId);
  const [name, setName] = useState(existing?.name ?? '');
  const [cue, setCue] = useState(existing?.cue ?? '');
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'weekly');
  const [times, setTimes] = useState(existing?.timesPerWeek && existing.frequency === 'weekly' ? existing.timesPerWeek : 3);
  const [steps, setSteps] = useState<StepDraft[]>(() => {
    const current = s.steps.filter((x) => x.systemId === systemId);
    return current.length
      ? current.map((x) => ({ key: x.id, id: x.id, name: x.name, metricId: x.metricId }))
      : [{ key: 'new-0', name: '', metricId: null }];
  });
  const [ids, setIds] = useState<string[]>(() =>
    existing ? s.systemIdentities.filter((x) => x.systemId === systemId).map((x) => x.identityId) : identityId ? [identityId] : [],
  );

  const metricOptions = useMemo(() => {
    const mids = new Set(s.links.filter((l) => ids.includes(l.identityId)).map((l) => l.metricId));
    return s.metrics.filter((m) => mids.has(m.id));
  }, [s.links, s.metrics, ids]);

  const valid = name.trim() && cue.trim() && ids.length > 0 && steps.some((x) => x.name.trim());

  const toggleIdentity = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    setIds(next);
    // Deselecting an identity clears steps that pointed at its metrics.
    const allowed = new Set(s.links.filter((l) => next.includes(l.identityId)).map((l) => l.metricId));
    setSteps((st) => st.map((x) => (x.metricId && !allowed.has(x.metricId) ? { ...x, metricId: null } : x)));
  };

  const pickMetric = (key: string) => {
    const options = ['Doesn’t log anything', ...metricOptions.map((m) => `Logs to ${m.name}`), 'Cancel'];
    const apply = (i: number) => {
      if (i === options.length - 1) return;
      const metricId = i === 0 ? null : metricOptions[i - 1].id;
      setSteps((st) => st.map((x) => (x.key === key ? { ...x, metricId } : x)));
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ options, cancelButtonIndex: options.length - 1 }, apply);
    } else {
      Alert.alert('Log to', undefined, options.slice(0, -1).map((text, i) => ({ text, onPress: () => apply(i) })));
    }
  };

  const save = () => {
    systemsRepo.save(
      {
        name,
        cue,
        frequency,
        timesPerWeek: times,
        identityIds: ids,
        steps: steps.filter((x) => x.name.trim()).map((x) => ({ id: x.id, name: x.name, metricId: x.metricId })),
      },
      existing?.id,
    );
    router.back();
  };

  const remove = () =>
    Alert.alert(`Delete ${existing!.name}?`, 'Entries it already logged are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          systemsRepo.remove(existing!.id);
          router.dismissTo('/');
        },
      },
    ]);

  return (
    <View className="flex-1 bg-bg">
      <NavHeader left={<HeaderAction label="Cancel" onPress={() => router.back()} />} right={<View />} />
      <KeyboardAwareScrollView bottomOffset={KEYBOARD_OFFSET} contentContainerClassName="p-gutter gap-5 pb-[60px]">
        <Text className="font-heading text-display-md text-ink">{existing ? 'Edit system' : 'Build a system'}</Text>
        <Note>A system supports your identities. It doesn’t change alignment on its own; the metrics its steps log do.</Note>
        <Field label="Name">
          <Input value={name} onChangeText={setName} placeholder="Wind-down" />
        </Field>
        <Field label="When does it start?" help="A cue ties the routine to something that already happens.">
          <Input value={cue} onChangeText={setCue} placeholder="After dinner, when the 9:30 alarm goes off" />
        </Field>
        <Field label="How often?">
          <Segmented
            options={[
              { key: 'daily', label: 'Daily' },
              { key: 'weekly', label: 'Weekly' },
              { key: 'asNeeded', label: 'As needed' },
            ]}
            value={frequency}
            onChange={setFrequency}
          />
          {frequency === 'weekly' ? (
            <Row className="p-1.5 pl-[18px] rounded-pill bg-card">
              <Text className="text-ink flex-1 text-[15px] font-body-bold">
                {times} {times === 1 ? 'time' : 'times'} a week
              </Text>
              {[
                ['−', -1, 'Fewer'],
                ['+', 1, 'More'],
              ].map(([l, d, a]) => (
                <Pressable
                  key={a as string}
                  accessibilityLabel={a as string}
                  onPress={() => setTimes((t) => Math.max(1, Math.min(7, t + (d as number))))}
                  className="w-[38px] h-[38px] rounded-[19px] bg-chip items-center justify-center">
                  <Text className="font-body-bold text-ink text-[18px]">
                    {l}
                  </Text>
                </Pressable>
              ))}
            </Row>
          ) : null}
        </Field>
        <Field label="Steps">
          {steps.map((st, i) => (
            <View key={st.key} className="gap-2 p-3 rounded-lg bg-card">
              <Row>
                <View className="w-[26px] h-[26px] rounded-[13px] bg-chip items-center justify-center">
                  <Text className="text-caption text-ink font-body-bold">
                    {i + 1}
                  </Text>
                </View>
                <TextInput
                  value={st.name}
                  onChangeText={(t) => setSteps((all) => all.map((x) => (x.key === st.key ? { ...x, name: t } : x)))}
                  placeholder="Describe the step"
                  placeholderTextColor={p.neutral[500]}
                  className="flex-1 h-[38px] text-ink font-body-semibold text-[15px]"
                />
                {steps.length > 1 ? (
                  <Pressable accessibilityLabel="Remove step" hitSlop={8} onPress={() => setSteps((all) => all.filter((x) => x.key !== st.key))}>
                    <X size={16} color={p.textMuted} strokeWidth={ICON_STROKE} />
                  </Pressable>
                ) : null}
              </Row>
              <Pressable
                onPress={() => pickMetric(st.key)}
                className="h-[38px] px-3.5 rounded-pill bg-chip justify-center">
                <Text className="font-body-semibold text-ink text-[13px]">
                  {st.metricId ? `Logs to ${s.metrics.find((m) => m.id === st.metricId)?.name}` : 'Doesn’t log anything'}
                </Text>
              </Pressable>
            </View>
          ))}
          <Button kind="dashed" label="+ Add a step" onPress={() => setSteps((all) => [...all, { key: `new-${Date.now()}`, name: '', metricId: null }])} />
        </Field>
        <Field label="Which identities does it support?" help="Steps can log to any metric in the identities you pick.">
          <Row className="flex-wrap">
            {s.identities
              .filter((i) => i.archivedAt === null)
              .map((i) => (
                <Chip key={i.id} label={i.name} selected={ids.includes(i.id)} onPress={() => toggleIdentity(i.id)} />
              ))}
          </Row>
        </Field>
        <Button label={existing ? 'Save system' : 'Add system'} disabled={!valid} onPress={save} />
        {existing ? (
          <>
            <Button kind="secondary" label="Delete system" onPress={remove} />
            <Text className="font-body text-caption text-muted -mt-3 text-center">
              Entries it already logged are kept.
            </Text>
          </>
        ) : null}
      </KeyboardAwareScrollView>
      <KeyboardBar />
    </View>
  );
}
