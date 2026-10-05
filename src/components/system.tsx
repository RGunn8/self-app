import { router } from 'expo-router';
import { View } from 'react-native';

import { cadenceLabel, HEALTH_LABEL, weekProgress } from '@/domain/systems';
import { today, weekStart } from '@/lib/dates';
import { useData } from '@/stores/data';
import type { SystemView } from '@/stores/derived';
import { useDayDraft } from '@/stores/systemDraft';
import { radius, space, useTheme } from '@/theme';
import { Card, Pill, Row, T } from './ui';

export function HealthTag({ view, tint, deep }: { view: SystemView; tint: string; deep: string }) {
  const p = useTheme();
  const tag = view.adherence.tag;
  if (tag === 'asNeeded') return null;
  const on = tag === 'onTrack';
  return <Pill label={HEALTH_LABEL[tag]} bg={on ? tint : p.chip} fg={on ? deep : p.textMuted} />;
}

export function StepProgress({ total, done, color, track }: { total: number; done: number; color: string; track: string }) {
  return (
    <Row style={{ gap: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 6, borderRadius: radius.pill, backgroundColor: i < done ? color : track }} />
      ))}
    </Row>
  );
}

export function SystemCard({ view, accent, identityId }: { view: SystemView; accent: { base: string; tint: string; deep: string }; identityId: string }) {
  const p = useTheme();
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
    <Card onPress={() => router.push({ pathname: '/system/[id]', params: { id: system.id, fromIdentityId: identityId } })} style={{ gap: space.sm }}>
      <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <T v="headingCard">{system.name}</T>
          <T v="caption" muted>
            {cadenceLabel(system.frequency, system.timesPerWeek)} · {system.cue}
          </T>
        </View>
        <HealthTag view={view} tint={accent.tint} deep={accent.deep} />
      </Row>
      <StepProgress total={view.steps.length} done={checked} color={accent.base} track={accent.tint} />
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="label">{todayStatus}</T>
        <T v="caption" muted>
          {adherence.expected === null
            ? `${adherence.completed} in 4 wks`
            : `${Math.min(adherence.completed, adherence.expected)} of ${adherence.expected} · 4 wks`}
        </T>
      </Row>
      {others.length ? (
        <T v="caption" color={p.textMuted}>
          Also supports {others.join(', ')}
        </T>
      ) : null}
    </Card>
  );
}
