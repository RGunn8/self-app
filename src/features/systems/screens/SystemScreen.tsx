import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { scoreOf, alignment } from '@/features/identities/domain';
import { identityPoints, linksFor } from '@/features/identities/views';
import { formatTime } from '@/features/planning/domain';
import { celebrate } from '@/features/progress/components/MomentCard';
import { afterLog } from '@/features/progress/views';
import { HealthTag } from '@/features/systems/components/SystemCard';
import { setDayDraft, useDayDraft } from '@/features/systems/dayDraft';
import { cadenceLabel } from '@/features/systems/domain';
import { systemsRepo } from '@/features/systems/repo';
import { useSystemViews } from '@/features/systems/views';
import { DotGrid } from '@/shared/components/charts';
import { toast } from '@/shared/components/toast';
import { Avatar, Button, Card, HeaderAction, ICON_STROKE, ListRow, NavHeader, Overline, Pill, Row, Screen } from '@/shared/components/ui';
import { today } from '@/shared/lib/dates';
import { useData } from '@/shared/store/data';
import { accentFor, useTheme } from '@/shared/theme';

/** The checklist. Tap steps as you go, then Mark done. Only checked steps log. */
export default function SystemScreen() {
  const { id, fromIdentityId } = useLocalSearchParams<{ id: string; fromIdentityId?: string }>();
  const p = useTheme();
  const s = useData();
  const view = useSystemViews().find((v) => v.system.id === id);
  const checked = useDayDraft(id);
  if (!view) return <Screen header={<NavHeader />} />;

  const { system, steps, adherence, todayCompletion } = view;
  const identities = s.identities.filter((i) => view.identityIds.includes(i.id));
  const host = identities.find((i) => i.id === fromIdentityId) ?? identities[0];
  const acc = accentFor(p, host?.accent);
  const metricName = (mid: string | null) => s.metrics.find((m) => m.id === mid)?.name;
  const done = !!todayCompletion;
  const planned = s.plans.find((x) => x.kind === 'system' && x.systemId === system.id && x.day === today() && x.status === 'planned');

  const toggle = (stepId: string) => {
    if (done) return;
    Haptics.selectionAsync();
    setDayDraft(id, checked.includes(stepId) ? checked.filter((x) => x !== stepId) : [...checked, stepId]);
  };

  const markDone = () => {
    const before = useData.getState();
    const { completionId, logged } = systemsRepo.markDone(system.id, today(), checked);
    setDayDraft(id, []);
    const names = logged.map((m) => s.metrics.find((x) => x.id === m)?.name).filter(Boolean);
    const undo = { label: 'Undo', onPress: () => systemsRepo.undo(completionId) };
    const { moment, line } = afterLog(
      before,
      { kind: 'system', systemId: system.id, day: today() },
      names.length ? `Done. Logged ${names.join(', ')}` : `${system.name} done for today`,
    );
    if (moment) {
      celebrate(moment, undo);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      toast(line, undo);
    }
  };

  return (
    <Screen
      header={
        <NavHeader
          right={<HeaderAction label="Edit" onPress={() => router.push({ pathname: '/system-form', params: { systemId: system.id } })} />}
        />
      }
      bottomInset={80}>
      <View className="gap-2">
        <Row>
          {host ? <Avatar marker={host.marker} tint={acc.tint} size={40} /> : null}
          <Pill label={`System · ${cadenceLabel(system.frequency, system.timesPerWeek)}`} bg={acc.tint} fg={acc.deep} />
          {planned && !done && s.settings.planningEnabled ? <Pill label={planned.time ? `Planned · ${formatTime(planned.time)}` : 'Planned today'} bg={p.chip} fg={p.text} /> : null}
        </Row>
        <Text className="font-heading text-display-xl text-ink">{system.name}</Text>
        <Text className="font-body text-body-md text-muted">
          {system.cue}
        </Text>
      </View>

      <Card>
        <Row className="justify-between">
          <Text className="font-body-bold text-overline uppercase text-muted">
            Today
          </Text>
          <Text className="font-body-semibold text-label text-muted">
            {done ? steps.length : checked.length} of {steps.length}
          </Text>
        </Row>
        {steps.map((st) => {
          const on = done || checked.includes(st.id);
          const logs = metricName(st.metricId);
          return (
            <Pressable
              key={st.id}
              onPress={() => toggle(st.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled: done }}
              className="flex-row items-center gap-3 py-2">
              <View
                className="h-7 w-7 items-center justify-center rounded-full border-2" style={{ borderColor: on ? acc.base : p.neutral[400], backgroundColor: on ? acc.base : 'transparent' }}>
                {on ? <Check size={16} color={p.neutral[100]} strokeWidth={ICON_STROKE} /> : null}
              </View>
              <View className="flex-1">
                <Text className="font-body-semibold text-ink text-[15px]">
                  {st.name}
                </Text>
                {logs ? (
                  <Text className="font-body text-caption text-muted">
                    Counts toward {logs}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </Card>

      {done ? (
        <Card tint={acc.tint}>
          <Text style={{ color: acc.deep }} className="font-heading text-heading-card">
            Done for today
          </Text>
          <Button kind="secondary" label="Undo" onPress={() => systemsRepo.undo(todayCompletion!.id)} />
        </Card>
      ) : (
        <View className="gap-2">
          <Button label="Mark done for today" disabled={checked.length === 0} onPress={markDone} />
          <Text className="font-body text-caption text-muted text-center">
            Check off what you did. Only checked steps log.
          </Text>
        </View>
      )}

      <Card>
        <Row className="justify-between">
          <Text className="font-body-bold text-overline uppercase text-muted">
            Last 4 weeks
          </Text>
          <HealthTag view={view} tint={acc.tint} deep={acc.deep} />
        </Row>
        <DotGrid days={adherence.days} color={acc.base} track={acc.tint} />
        <Text className="font-body text-body-sm text-muted">
          {adherence.expected === null
            ? `Done ${adherence.completed} times in the last 4 weeks`
            : `Followed ${Math.min(adherence.completed, adherence.expected)} of ${adherence.expected} planned times in the last 4 weeks`}
        </Text>
      </Card>

      <View className="gap-2">
        <Overline>Supports</Overline>
        {identities.map((i) => {
          const a = accentFor(p, i.accent);
          const links = linksFor(s, i.id);
          const score = scoreOf(alignment(links, identityPoints(s, links, i.restartedAt), s.pauses.filter((x) => x.identityId === i.id), today()));
          return (
            <ListRow
              key={i.id}
              left={<Avatar marker={i.marker} tint={a.tint} size={32} />}
              title={i.name}
              sub={score !== null ? `${score}% aligned` : undefined}
              onPress={() => router.navigate(`/identity/${i.id}`)}
            />
          );
        })}
        <View className="p-3 rounded-md">
          <Text className="font-body text-caption text-muted">
            Systems don’t count toward alignment. The metrics their steps log do.
          </Text>
        </View>
      </View>
    </Screen>
  );
}
