import { router } from 'expo-router';

import { AccentPicker, MarkerPicker, PriorityRadio } from '@/components/pickers';
import { Button, Field, NavHeader, Screen, T } from '@/components/ui';
import { useCreateDraft } from '@/stores/createDraft';
import { accentFor, useTheme } from '@/theme';

/** Step 2 of 3. Priority decides grouping on Home and bar thickness on Balance. */
export default function CreatePriority() {
  const p = useTheme();
  const { name, priority, marker, accent, patch } = useCreateDraft();
  const label = name.trim() || 'this identity';
  return (
    <Screen header={<NavHeader title="2 of 3" right={null} />}>
      <T v="displayMd">How important is {label} in your life right now?</T>
      <PriorityRadio value={priority} onChange={(v) => patch({ priority: v })} name={label} />
      <T v="caption" muted>
        You can change this any time. Priorities shift; the identity stays.
      </T>
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
