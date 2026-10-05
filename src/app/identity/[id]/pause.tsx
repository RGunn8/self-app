import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Chip, Field, Row, T } from '@/components/ui';
import { addDays, fmt, today } from '@/lib/dates';
import { pausesRepo } from '@/repos';
import { useIdentityView } from '@/stores/derived';
import { layout, radius, space, useTheme } from '@/theme';

const DURATIONS = [
  { key: '1w', label: '1 week', days: 7 },
  { key: '2w', label: '2 weeks', days: 14 },
  { key: '1m', label: '1 month', days: 30 },
  { key: 'open', label: 'Until I resume', days: null },
] as const;
const REASONS = ['Injury', 'Travel', 'Busy season', 'Other'];

export default function PauseSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useTheme();
  const view = useIdentityView(id);
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]['key']>('2w');
  const [reason, setReason] = useState<string | null>(null);
  if (!view) return null;
  const start = today();
  const d = DURATIONS.find((x) => x.key === duration)!;
  const end = d.days === null ? null : addDays(start, d.days - 1);

  const pause = () => {
    pausesRepo.create(view.identity.id, start, end, reason);
    router.dismissTo(`/identity/${view.identity.id}`);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: layout.screenGutter, paddingTop: space.xxl, gap: space.xl }}>
      <T v="displaySm">Pause {view.identity.name}</T>
      <T v="bodyMd" muted>
        While paused, {view.identity.name} isn’t scored and paused days are left out of its trends. You can keep logging.
      </T>
      <Field label="How long?">
        <Row style={{ flexWrap: 'wrap' }}>
          {DURATIONS.map((o) => (
            <Chip key={o.key} label={o.label} selected={o.key === duration} onPress={() => setDuration(o.key)} />
          ))}
        </Row>
      </Field>
      <Row style={{ gap: space.md }}>
        {[
          ['Starts', `Today, ${fmt.short(start)}`],
          ['Ends', end ? fmt.dowShort(end) : 'When you resume'],
        ].map(([k, v]) => (
          <View key={k} style={{ flex: 1, padding: space.lg, borderRadius: radius.md, backgroundColor: p.card }}>
            <T v="caption" muted>
              {k}
            </T>
            <T v="label">{v}</T>
          </View>
        ))}
      </Row>
      <Field label="Reason (optional, only you see it)">
        <Row style={{ flexWrap: 'wrap' }}>
          {REASONS.map((r) => (
            <Chip key={r} label={r} selected={r === reason} onPress={() => setReason(r === reason ? null : r)} />
          ))}
        </Row>
      </Field>
      <Button label={`Pause ${view.identity.name}`} onPress={pause} />
    </ScrollView>
  );
}
