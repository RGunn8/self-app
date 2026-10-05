import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { DotGrid } from '@/components/charts';
import { toast } from '@/components/overlay';
import { HealthTag } from '@/components/system';
import { Avatar, Button, Card, HeaderAction, ICON_STROKE, ListRow, NavHeader, Overline, Pill, Row, Screen, T } from '@/components/ui';
import { scoreOf, alignment } from '@/domain/alignment';
import { cadenceLabel } from '@/domain/systems';
import { today } from '@/lib/dates';
import { systemsRepo } from '@/repos';
import { useData } from '@/stores/data';
import { linksFor, useSystemViews } from '@/stores/derived';
import { setDayDraft, useDayDraft } from '@/stores/systemDraft';
import { accentFor, radius, space, useTheme } from '@/theme';

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

  const toggle = (stepId: string) => {
    if (done) return;
    Haptics.selectionAsync();
    setDayDraft(id, checked.includes(stepId) ? checked.filter((x) => x !== stepId) : [...checked, stepId]);
  };

  const markDone = () => {
    const { completionId, logged } = systemsRepo.markDone(system.id, today(), checked);
    setDayDraft(id, []);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const names = logged.map((m) => s.metrics.find((x) => x.id === m)?.name).filter(Boolean);
    toast(names.length ? `Done. Logged ${names.join(', ')}` : `${system.name} done for today`, {
      label: 'Undo',
      onPress: () => systemsRepo.undo(completionId),
    });
  };

  return (
    <Screen
      header={
        <NavHeader
          right={<HeaderAction label="Edit" onPress={() => router.push({ pathname: '/system-form', params: { systemId: system.id } })} />}
        />
      }
      bottomInset={80}>
      <View style={{ gap: space.sm }}>
        <Row>
          {host ? <Avatar marker={host.marker} tint={acc.tint} size={40} /> : null}
          <Pill label={`System · ${cadenceLabel(system.frequency, system.timesPerWeek)}`} bg={acc.tint} fg={acc.deep} />
        </Row>
        <T v="displayXl">{system.name}</T>
        <T v="bodyMd" muted>
          {system.cue}
        </T>
      </View>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="overline" muted>
            Today
          </T>
          <T v="label" muted>
            {done ? steps.length : checked.length} of {steps.length}
          </T>
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
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: on ? acc.base : p.neutral[400],
                  backgroundColor: on ? acc.base : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                {on ? <Check size={16} color={p.neutral[100]} strokeWidth={ICON_STROKE} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <T v="label" style={{ fontSize: 15 }}>
                  {st.name}
                </T>
                {logs ? (
                  <T v="caption" muted>
                    Counts toward {logs}
                  </T>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </Card>

      {done ? (
        <Card tint={acc.tint}>
          <T v="headingCard" color={acc.deep}>
            Done for today
          </T>
          <Button kind="secondary" label="Undo" onPress={() => systemsRepo.undo(todayCompletion!.id)} />
        </Card>
      ) : (
        <View style={{ gap: space.sm }}>
          <Button label="Mark done for today" disabled={checked.length === 0} onPress={markDone} />
          <T v="caption" muted style={{ textAlign: 'center' }}>
            Check off what you did. Only checked steps log.
          </T>
        </View>
      )}

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <T v="overline" muted>
            Last 4 weeks
          </T>
          <HealthTag view={view} tint={acc.tint} deep={acc.deep} />
        </Row>
        <DotGrid days={adherence.days} color={acc.base} track={acc.tint} />
        <T v="bodySm" muted>
          {adherence.expected === null
            ? `Done ${adherence.completed} times in the last 4 weeks`
            : `Followed ${Math.min(adherence.completed, adherence.expected)} of ${adherence.expected} planned times in the last 4 weeks`}
        </T>
      </Card>

      <View style={{ gap: space.sm }}>
        <Overline>Supports</Overline>
        {identities.map((i) => {
          const a = accentFor(p, i.accent);
          const score = scoreOf(alignment(linksFor(s, i.id), s.points, s.pauses.filter((x) => x.identityId === i.id), today()));
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
        <View style={{ padding: space.md, borderRadius: radius.md }}>
          <T v="caption" muted>
            Systems don’t count toward alignment. The metrics their steps log do.
          </T>
        </View>
      </View>
    </Screen>
  );
}
