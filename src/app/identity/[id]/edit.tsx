import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { AccentPicker, MarkerPicker } from '@/components/pickers';
import { Button, Field, HeaderAction, Input, KEYBOARD_OFFSET, KeyboardBar, ListRow, NavHeader, Overline, Segmented, T } from '@/components/ui';
import type { Priority } from '@/db/schema';
import { identitiesRepo } from '@/repos';
import { useIdentityView } from '@/stores/derived';
import { accentFor, type AccentKey, layout, space, useTheme } from '@/theme';

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
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavHeader
        left={<HeaderAction label="Cancel" onPress={() => router.back()} />}
        right={<HeaderAction label="Save" bold onPress={save} />}
      />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_OFFSET}
        contentContainerStyle={{ padding: layout.screenGutter, gap: layout.sectionGap, paddingBottom: 60 }}>
        <T v="displayMd">Edit identity</T>
        <Field label="Name">
          <Input value={name} onChangeText={setName} />
        </Field>
        <Field label="Description">
          <Input value={description} onChangeText={setDescription} multiline style={{ minHeight: 96 }} />
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
        <View style={{ gap: space.sm }}>
          <Overline>Take a break</Overline>
          <ListRow
            title={view.pause ? `${identity.name} is paused` : `Pause ${identity.name}`}
            sub="Not scored while paused. Your data is kept."
            onPress={view.pause ? undefined : () => router.push(`/identity/${identity.id}/pause`)}
          />
        </View>
        <View style={{ gap: space.sm }}>
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
        <T v="caption" muted style={{ textAlign: 'center', marginTop: -space.md }}>
          Removes the identity. Metrics used elsewhere stay.
        </T>
      </KeyboardAwareScrollView>
      <KeyboardBar />
    </View>
  );
}
