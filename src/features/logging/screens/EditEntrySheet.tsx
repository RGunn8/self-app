import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { supportersOf } from '@/features/identities/views';
import { DateTimeCard } from '@/features/logging/components/DateTimeCard';
import { entriesRepo } from '@/features/logging/repo';
import { toast } from '@/shared/components/toast';
import { Button, KEYBOARD_OFFSET, KeyboardBar, Stepper } from '@/shared/components/ui';
import { useData } from '@/shared/store/data';

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
    <View className="flex-1">
      <KeyboardAwareScrollView bottomOffset={KEYBOARD_OFFSET} keyboardShouldPersistTaps="handled" contentContainerClassName="p-gutter pt-6 gap-5">
        <View className="gap-1">
          <Text className="font-heading text-display-sm text-ink">Edit entry</Text>
          <Text className="font-body-semibold text-label text-muted">
            {metric.name}
            {supporters.length ? ` · counts toward ${supporters.join(', ')}` : ''}
          </Text>
        </View>
        <Stepper value={value} onChange={setValue} step={metric.step} unit={metric.unit} />
        <DateTimeCard value={when} onChange={setWhen} />
        <Text className="font-body text-caption text-muted text-center">
          {entry.systemCompletionId ? 'Logged by a system' : 'Logged by you'}
          {edited ? ' · edited' : ''}
        </Text>
        <Button label="Save changes" disabled={!(value.trim() !== '' && Number.isFinite(n) && n >= 0)} onPress={save} />
        <Button kind="secondary" label="Delete entry" onPress={remove} />
      </KeyboardAwareScrollView>
      <KeyboardBar />
    </View>
  );
}
