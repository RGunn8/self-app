import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { pausesRepo } from '@/features/identities/repo';
import { useIdentityView } from '@/features/identities/views';
import { Button, Chip, Field, Row } from '@/shared/components/ui';
import { addDays, fmt, today } from '@/shared/lib/dates';

const DURATIONS = [
  { key: '1w', label: '1 week', days: 7 },
  { key: '2w', label: '2 weeks', days: 14 },
  { key: '1m', label: '1 month', days: 30 },
  { key: 'open', label: 'Until I resume', days: null },
] as const;
const REASONS = ['Injury', 'Travel', 'Busy season', 'Other'];

export default function PauseSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
    <ScrollView contentContainerClassName="p-gutter pt-6 gap-5">
      <Text className="font-heading text-display-sm text-ink">Pause {view.identity.name}</Text>
      <Text className="font-body text-body-md text-muted">
        While paused, {view.identity.name} isn’t scored and paused days are left out of its trends. You can keep logging.
      </Text>
      <Field label="How long?">
        <Row className="flex-wrap">
          {DURATIONS.map((o) => (
            <Chip key={o.key} label={o.label} selected={o.key === duration} onPress={() => setDuration(o.key)} />
          ))}
        </Row>
      </Field>
      <Row className="gap-3">
        {[
          ['Starts', `Today, ${fmt.short(start)}`],
          ['Ends', end ? fmt.dowShort(end) : 'When you resume'],
        ].map(([k, v]) => (
          <View key={k} className="flex-1 p-4 rounded-md bg-card">
            <Text className="font-body text-caption text-muted">
              {k}
            </Text>
            <Text className="font-body-semibold text-label text-ink">{v}</Text>
          </View>
        ))}
      </Row>
      <Field label="Reason (optional, only you see it)">
        <Row className="flex-wrap">
          {REASONS.map((r) => (
            <Chip key={r} label={r} selected={r === reason} onPress={() => setReason(r === reason ? null : r)} />
          ))}
        </Row>
      </Field>
      <Button label={`Pause ${view.identity.name}`} onPress={pause} />
    </ScrollView>
  );
}
