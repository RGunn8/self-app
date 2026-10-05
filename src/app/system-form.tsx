import { router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button, Chip, Field, HeaderAction, ICON_STROKE, Input, KEYBOARD_OFFSET, KeyboardBar, NavHeader, Note, Row, Segmented, T } from '@/components/ui';
import type { Frequency } from '@/db/schema';
import { systemsRepo } from '@/repos';
import { useData } from '@/stores/data';
import { layout, radius, space, useTheme } from '@/theme';

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
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavHeader left={<HeaderAction label="Cancel" onPress={() => router.back()} />} right={<View />} />
      <KeyboardAwareScrollView bottomOffset={KEYBOARD_OFFSET} contentContainerStyle={{ padding: layout.screenGutter, gap: space.xl, paddingBottom: 60 }}>
        <T v="displayMd">{existing ? 'Edit system' : 'Build a system'}</T>
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
            <Row style={{ padding: 6, paddingLeft: 18, borderRadius: radius.pill, backgroundColor: p.card }}>
              <T v="label" style={{ flex: 1, fontSize: 15, fontFamily: 'Figtree_700Bold' }}>
                {times} {times === 1 ? 'time' : 'times'} a week
              </T>
              {[
                ['−', -1, 'Fewer'],
                ['+', 1, 'More'],
              ].map(([l, d, a]) => (
                <Pressable
                  key={a as string}
                  accessibilityLabel={a as string}
                  onPress={() => setTimes((t) => Math.max(1, Math.min(7, t + (d as number))))}
                  style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: p.chip, alignItems: 'center', justifyContent: 'center' }}>
                  <T v="metricSm" style={{ fontSize: 18 }}>
                    {l}
                  </T>
                </Pressable>
              ))}
            </Row>
          ) : null}
        </Field>
        <Field label="Steps">
          {steps.map((st, i) => (
            <View key={st.key} style={{ gap: space.sm, padding: space.md, borderRadius: radius.lg, backgroundColor: p.card }}>
              <Row>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: p.chip, alignItems: 'center', justifyContent: 'center' }}>
                  <T v="caption" style={{ fontFamily: 'Figtree_700Bold' }}>
                    {i + 1}
                  </T>
                </View>
                <TextInput
                  value={st.name}
                  onChangeText={(t) => setSteps((all) => all.map((x) => (x.key === st.key ? { ...x, name: t } : x)))}
                  placeholder="Describe the step"
                  placeholderTextColor={p.neutral[500]}
                  style={{ flex: 1, height: 38, color: p.text, fontFamily: 'Figtree_600SemiBold', fontSize: 15 }}
                />
                {steps.length > 1 ? (
                  <Pressable accessibilityLabel="Remove step" hitSlop={8} onPress={() => setSteps((all) => all.filter((x) => x.key !== st.key))}>
                    <X size={16} color={p.textMuted} strokeWidth={ICON_STROKE} />
                  </Pressable>
                ) : null}
              </Row>
              <Pressable
                onPress={() => pickMetric(st.key)}
                style={{ height: 38, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: p.chip, justifyContent: 'center' }}>
                <T v="label" style={{ fontSize: 13 }}>
                  {st.metricId ? `Logs to ${s.metrics.find((m) => m.id === st.metricId)?.name}` : 'Doesn’t log anything'}
                </T>
              </Pressable>
            </View>
          ))}
          <Button kind="dashed" label="+ Add a step" onPress={() => setSteps((all) => [...all, { key: `new-${Date.now()}`, name: '', metricId: null }])} />
        </Field>
        <Field label="Which identities does it support?" help="Steps can log to any metric in the identities you pick.">
          <Row style={{ flexWrap: 'wrap' }}>
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
            <T v="caption" muted style={{ textAlign: 'center', marginTop: -space.md }}>
              Entries it already logged are kept.
            </T>
          </>
        ) : null}
      </KeyboardAwareScrollView>
      <KeyboardBar />
    </View>
  );
}
