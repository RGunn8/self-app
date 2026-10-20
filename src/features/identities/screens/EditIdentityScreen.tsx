import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { confirmRestart, restartedLabel, resumeIdentity, undoRestart } from '@/features/identities/actions';
import { AccentPicker, MarkerPicker } from '@/features/identities/components/pickers';
import type { Priority } from '@/features/identities/model';
import { identitiesRepo } from '@/features/identities/repo';
import { useIdentityView } from '@/features/identities/views';
import { Button, Field, HeaderAction, Input, KEYBOARD_OFFSET, KeyboardBar, ListRow, NavHeader, Overline, Segmented } from '@/shared/components/ui';
import { accentFor, type AccentKey, useTheme } from '@/shared/theme';

export default function EditIdentity() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useTheme();
  const view = useIdentityView(id);
  const [name, setName] = useState(view?.identity.name ?? '');
  const [description, setDescription] = useState(view?.identity.description ?? '');
  const [priority, setPriority] = useState<Priority>(view?.identity.priority ?? 'important');
  const [marker, setMarker] = useState(view?.identity.marker ?? '🌱');
  const [accent, setAccent] = useState<AccentKey>((view?.identity.accent as AccentKey) ?? 'runner');
  if (!view) return null;
  const identity = view.identity;

  const save = () => {
    if (!name.trim()) return;
    identitiesRepo.update(identity.id, { name, description, priority, marker, accent });
    router.back();
  };

  const remove = () =>
    Alert.alert(`Delete ${identity.name}?`, 'This removes the identity. Metrics used by other identities stay, with their history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          identitiesRepo.remove(identity.id);
          router.dismissTo('/');
        },
      },
    ]);

  return (
    <View className="flex-1 bg-bg">
      <NavHeader
        left={<HeaderAction label="Cancel" onPress={() => router.back()} />}
        right={<HeaderAction label="Save" bold onPress={save} />}
      />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_OFFSET}
        contentContainerClassName="p-gutter gap-section pb-[60px]">
        <Text className="font-heading text-display-md text-ink">Edit identity</Text>
        <Field label="Name">
          <Input value={name} onChangeText={setName} />
        </Field>
        <Field label="Description">
          <Input value={description} onChangeText={setDescription} multiline className="min-h-[96px]" />
        </Field>
        <Field label="Priority right now" help="Changes apply from today. Past weeks keep the priority they had.">
          <Segmented
            options={[
              { key: 'supporting', label: 'Supporting' },
              { key: 'important', label: 'Important' },
              { key: 'core', label: 'Core' },
            ]}
            value={priority}
            onChange={setPriority}
          />
        </Field>
        <Field label="Marker">
          <MarkerPicker value={marker} onChange={setMarker} tint={accentFor(p, accent).tint} />
        </Field>
        <Field label="Accent">
          <AccentPicker value={accent} onChange={setAccent} />
        </Field>
        <View className="gap-2">
          <Overline>Take a break or start fresh</Overline>
          <ListRow
            title={view.pause ? `Resume ${identity.name}` : `Pause ${identity.name}`}
            sub={view.pause ? 'It’s paused. Resume scoring from today.' : 'Not scored while paused. Your data is kept.'}
            onPress={view.pause ? () => resumeIdentity(identity, view.pause!) : () => router.push(`/identity/${identity.id}/pause`)}
          />
          <ListRow
            title={identity.restartedAt ? 'Undo restart' : `Restart ${identity.name}`}
            sub={
              identity.restartedAt
                ? `${restartedLabel(identity)}. Count all history again.`
                : 'A fresh start from today. Alignment and votes count from here; history is kept.'
            }
            onPress={() => (identity.restartedAt ? undoRestart(identity) : confirmRestart(identity))}
          />
        </View>
        <View className="gap-2">
          <Overline>Manage</Overline>
          <ListRow
            title={identity.archivedAt ? 'Unarchive' : 'Archive'}
            sub={identity.archivedAt ? 'Show it on the dashboard again.' : 'Hides it from the dashboard. History is kept.'}
            onPress={() => {
              identitiesRepo.archive(identity.id, !identity.archivedAt);
              router.dismissTo('/');
            }}
          />
        </View>
        <Button kind="secondary" label="Delete identity" onPress={remove} />
        <Text className="font-body text-caption text-muted -mt-3 text-center">
          Removes the identity. Metrics used elsewhere stay.
        </Text>
      </KeyboardAwareScrollView>
      <KeyboardBar />
    </View>
  );
}
