import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { DateTimeCard } from '@/components/entryEditor';
import { toast } from '@/components/overlay';
import { Button, KEYBOARD_OFFSET, KeyboardBar, Stepper, T } from '@/components/ui';
import { entriesRepo } from '@/repos';
import { useData } from '@/stores/data';
import { supportersOf } from '@/stores/derived';
import { layout, space } from '@/theme';

/** Same controls as Log, plus Delete. */
export default function EditEntrySheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const s = useData();
  const entry = s.entries.find((e) => e.id === id);
  const metric = s.metrics.find((m) => m.id === entry?.metricId);
  const [value, setValue] = useState(entry ? String(entry.value) : '');
  const [when, setWhen] = useState(entry ? new Date(entry.loggedAt) : new Date());
  if (!entry || !metric) return null;
  const supporters = supportersOf(s, metric.id).map((i) => i.name);
  const n = Number(value);
  const edited = entry.updatedAt - entry.createdAt > 1000;

  const save = () => {
    entriesRepo.update(entry.id, n, when.getTime());
    router.back();
  };
  const remove = () => {
    entriesRepo.remove(entry.id);
    router.back();
    toast('Entry deleted', { label: 'Undo', onPress: () => entriesRepo.restore(entry.id) });
  };

  return (
    <View style={{ flex: 1 }}>
      <KeyboardAwareScrollView bottomOffset={KEYBOARD_OFFSET} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: layout.screenGutter, paddingTop: space.xxl, gap: space.xl }}>
        <View style={{ gap: space.xs }}>
          <T v="displaySm">Edit entry</T>
          <T v="label" muted>
            {metric.name}
            {supporters.length ? ` · counts toward ${supporters.join(', ')}` : ''}
          </T>
        </View>
        <Stepper value={value} onChange={setValue} step={metric.step} unit={metric.unit} />
        <DateTimeCard value={when} onChange={setWhen} />
        <T v="caption" muted style={{ textAlign: 'center' }}>
          {entry.systemCompletionId ? 'Logged by a system' : 'Logged by you'}
          {edited ? ' · edited' : ''}
        </T>
        <Button label="Save changes" disabled={!(value.trim() !== '' && Number.isFinite(n) && n >= 0)} onPress={save} />
        <Button kind="secondary" label="Delete entry" onPress={remove} />
      </KeyboardAwareScrollView>
      <KeyboardBar />
    </View>
  );
}
