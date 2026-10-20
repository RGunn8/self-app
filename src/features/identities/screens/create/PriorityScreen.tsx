import { router } from 'expo-router';
import { Text } from 'react-native';

import { AccentPicker, MarkerPicker, PriorityRadio } from '@/features/identities/components/pickers';
import { useCreateDraft } from '@/features/identities/createDraft';
import { Button, Field, NavHeader, Screen } from '@/shared/components/ui';
import { accentFor, useTheme } from '@/shared/theme';

/** Step 2 of 3. Priority decides grouping on Home and bar thickness on Balance. */
export default function CreatePriority() {
  const p = useTheme();
  const { name, priority, marker, accent, patch } = useCreateDraft();
  const label = name.trim() || 'this identity';
  return (
    <Screen header={<NavHeader title="2 of 3" right={null} />}>
      <Text className="font-heading text-display-md text-ink">How important is {label} in your life right now?</Text>
      <PriorityRadio value={priority} onChange={(v) => patch({ priority: v })} name={label} />
      <Text className="font-body text-caption text-muted">
        You can change this any time. Priorities shift; the identity stays.
      </Text>
      <Field label="Marker">
        <MarkerPicker value={marker} onChange={(m) => patch({ marker: m })} tint={accentFor(p, accent).tint} />
      </Field>
      <Field label="Accent">
        <AccentPicker value={accent} onChange={(a) => patch({ accent: a })} />
      </Field>
      <Button label="Continue →" onPress={() => router.push('/identity/create/metrics')} />
    </Screen>
  );
}
