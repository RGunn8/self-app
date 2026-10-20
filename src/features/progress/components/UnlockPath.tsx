import { Check, Lock } from 'lucide-react-native';
import { Text, View } from 'react-native';

import type { StepKey, UnlockStep } from '@/features/progress/domain';
import { Bar } from '@/shared/components/charts';
import { Card, ICON_STROKE, Row } from '@/shared/components/ui';
import { fmt } from '@/shared/lib/dates';
import { useTheme } from '@/shared/theme';

const COPY: Record<StepKey, { label: string; detail: string }> = {
  first: { label: 'First entry', detail: 'Log anything you track for this identity to begin.' },
  alignment: { label: 'Alignment score', detail: 'See how closely your weeks match who you want to be.' },
  insights: { label: 'Insights', detail: 'Patterns across your identities, in plain words.' },
  year: { label: 'Your first year', detail: 'Compare this year with the last on your journey.' },
};

/** What this identity unlocks as it gathers data. No streaks: days only ever add up. */
export function UnlockPath({ name, steps, accent }: { name: string; steps: UnlockStep[]; accent: { base: string; tint: string; deep: string } }) {
  const p = useTheme();
  return (
    <Card>
      <Text className="font-body-bold text-overline uppercase text-muted">Getting started</Text>
      <Text className="font-heading text-heading-card text-ink">Getting to know you as {name}</Text>
      <View className="gap-4 pt-1">
        {steps.map((s) => {
          const copy = COPY[s.key];
          const active = s.state === 'active';
          return (
            <Row key={s.key} className="items-start gap-3" accessibilityLabel={`${copy.label}, ${s.state === 'done' ? 'unlocked' : active ? `${s.days} of ${s.of} days` : 'locked'}`}>
              <View
                className="h-7 w-7 items-center justify-center rounded-full"
                style={{ backgroundColor: s.state === 'done' ? accent.base : active ? accent.tint : p.chip }}>
                {s.state === 'done' ? (
                  <Check size={16} color={p.onAccent} strokeWidth={ICON_STROKE} />
                ) : s.state === 'locked' ? (
                  <Lock size={13} color={p.textMuted} strokeWidth={ICON_STROKE} />
                ) : (
                  <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent.base }} />
                )}
              </View>
              <View className="flex-1 gap-1">
                <Row className="justify-between">
                  <Text className={s.state === 'locked' ? 'font-body-semibold text-label text-muted' : 'font-body-bold text-label text-ink'}>{copy.label}</Text>
                  <Text className="font-body text-caption text-muted">
                    {s.state === 'done'
                      ? 'Unlocked'
                      : active && s.key !== 'first' && s.key !== 'year'
                        ? `${s.days} of ${s.of} days`
                        : s.unlocksOn
                          ? (s.key === 'year' ? fmt.long : fmt.short)(s.unlocksOn)
                          : ''}
                  </Text>
                </Row>
                {s.state !== 'done' ? <Text className="font-body text-caption text-muted">{copy.detail}</Text> : null}
                {active && s.key !== 'first' ? <Bar ratio={s.progress} color={accent.base} track={accent.tint} thickness={6} label={`${copy.label} progress`} /> : null}
              </View>
            </Row>
          );
        })}
      </View>
    </Card>
  );
}
