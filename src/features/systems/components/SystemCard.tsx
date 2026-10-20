import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { useDayDraft } from '@/features/systems/dayDraft';
import { cadenceLabel, HEALTH_LABEL, weekProgress } from '@/features/systems/domain';
import type { SystemView } from '@/features/systems/views';
import { Card, Pill, Row } from '@/shared/components/ui';
import { today, weekStart } from '@/shared/lib/dates';
import { useData } from '@/shared/store/data';
import { useTheme } from '@/shared/theme';

export function HealthTag({ view, tint, deep }: { view: SystemView; tint: string; deep: string }) {
  const p = useTheme();
  const tag = view.adherence.tag;
  if (tag === 'asNeeded') return null;
  const on = tag === 'onTrack';
  return <Pill label={HEALTH_LABEL[tag]} bg={on ? tint : p.chip} fg={on ? deep : p.textMuted} />;
}

export function StepProgress({ total, done, color, track }: { total: number; done: number; color: string; track: string }) {
  return (
    <Row className="gap-1">
      {Array.from({ length: total }, (_, i) => (
        <View key={i} className="flex-1 h-1.5 rounded-pill" style={{ backgroundColor: i < done ? color : track }} />
      ))}
    </Row>
  );
}

export function SystemCard({ view, accent, identityId }: { view: SystemView; accent: { base: string; tint: string; deep: string }; identityId: string }) {
  const identities = useData((s) => s.identities);
  const draft = useDayDraft(view.system.id);
  const t = today();
  const doneToday = !!view.todayCompletion;
  const checked = doneToday ? view.steps.length : draft.length;
  const { system, adherence } = view;
  let todayStatus: string;
  if (system.frequency === 'weekly' && !doneToday && checked === 0) {
    todayStatus = `This week ${weekProgress(view.completionDays, weekStart(t), t)} of ${system.timesPerWeek}`;
  } else if (doneToday) {
    todayStatus = 'Done today';
  } else if (checked === 0) {
    todayStatus = 'Not started today';
  } else {
    todayStatus = `${checked} of ${view.steps.length} steps today`;
  }
  const others = identities.filter((i) => i.id !== identityId && view.identityIds.includes(i.id)).map((i) => i.name);

  return (
    <Card onPress={() => router.push({ pathname: '/system/[id]', params: { id: system.id, fromIdentityId: identityId } })} className="gap-2">
      <Row className="justify-between items-start">
        <View className="flex-1 gap-0.5">
          <Text className="font-heading text-heading-card text-ink">{system.name}</Text>
          <Text className="font-body text-caption text-muted">
            {cadenceLabel(system.frequency, system.timesPerWeek)} · {system.cue}
          </Text>
        </View>
        <HealthTag view={view} tint={accent.tint} deep={accent.deep} />
      </Row>
      <StepProgress total={view.steps.length} done={checked} color={accent.base} track={accent.tint} />
      <Row className="justify-between">
        <Text className="font-body-semibold text-label text-ink">{todayStatus}</Text>
        <Text className="font-body text-caption text-muted">
          {adherence.expected === null
            ? `${adherence.completed} in 4 wks`
            : `${Math.min(adherence.completed, adherence.expected)} of ${adherence.expected} · 4 wks`}
        </Text>
      </Row>
      {others.length ? (
        <Text className="font-body text-caption text-muted">
          Also supports {others.join(', ')}
        </Text>
      ) : null}
    </Card>
  );
}
