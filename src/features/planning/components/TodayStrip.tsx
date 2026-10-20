import { router } from 'expo-router';
import { ChevronRight, X } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useDismissal } from '@/features/planning/dismissals';
import { dayPlan, formatTime, nextUp, planningPrompt, type PlanningPrompt } from '@/features/planning/domain';
import { usePlanData } from '@/features/planning/views';
import { HeaderAction, ICON_STROKE } from '@/shared/components/ui';
import { today } from '@/shared/lib/dates';
import { useData } from '@/shared/store/data';
import { accentFor, useTheme } from '@/shared/theme';

/** The invitation to plan: weekly for everyone, daily only for people who've been planning. */
function PlanPrompt({ prompt, today: t, onDismiss }: { prompt: PlanningPrompt; today: string; onDismiss: () => void }) {
  const p = useTheme();
  const plan = () =>
    prompt.kind === 'week'
      ? router.push({ pathname: '/plan/week/[weekStart]', params: { weekStart: prompt.weekStart } })
      : router.push({ pathname: '/plan/[day]', params: { day: t } });
  return (
    <View className="mt-3 flex-row items-center gap-3 rounded-md border-[1.5px] border-dashed border-field-border px-4 py-3">
      <Pressable onPress={plan} accessibilityRole="button" className="flex-1">
        <Text className="font-body-bold text-[15px] text-ink">{prompt.kind === 'week' ? 'Plan your week' : 'Nothing planned today'}</Text>
        <Text className="font-body text-caption text-muted">
          {prompt.kind === 'week'
            ? `Choose days for your ${prompt.systems} ${prompt.systems === 1 ? 'system' : 'systems'}`
            : 'Decide when you’ll act, if you like'}
        </Text>
      </Pressable>
      <HeaderAction label="Plan" bold onPress={plan} />
      <Pressable onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel={prompt.kind === 'week' ? 'Not this week' : 'Not today'}>
        <X size={18} color={p.textMuted} strokeWidth={ICON_STROKE} />
      </Pressable>
    </View>
  );
}

/**
 * The top of Identities: what's next today, or a gentle invitation to plan when it makes sense.
 * Nothing at all when planning is off, or when someone doesn't plan and it isn't the start of a week.
 */
export function TodayStrip() {
  const p = useTheme();
  const data = usePlanData();
  const t = today();
  const enabled = useData((s) => s.settings.planningEnabled);
  const items = useMemo(() => dayPlan(t, data), [t, data]);
  const prompt = useMemo(() => planningPrompt(t, data), [t, data]);
  const promptKey = prompt ? (prompt.kind === 'week' ? `week:${prompt.weekStart}` : `day:${t}`) : null;
  const [dismissed, dismiss] = useDismissal(promptKey);
  const open = items.filter((i) => i.status === 'planned');
  if (!enabled) return null;
  if (open.length === 0) return prompt && !dismissed ? <PlanPrompt prompt={prompt} today={t} onDismiss={dismiss} /> : null;
  const now = new Date();
  const up = nextUp(open, `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)!;
  const next = up.item;
  const identity = data.identities.find((i) => i.id === next.identityIds[0]);
  const acc = accentFor(p, identity?.accent);
  const rest = open.length - 1;
  const doneCount = items.filter((i) => i.status === 'done').length;

  return (
    <Pressable
      onPress={() => router.navigate('/today')}
      accessibilityRole="button"
      accessibilityLabel={`Today: ${up.earlier ? 'from earlier' : 'next'} ${next.title}${next.time ? ` at ${formatTime(next.time)}` : ''}, ${rest} more planned`}
      className="mt-3 flex-row items-center gap-3 rounded-md bg-card px-4 py-3 active:bg-chip">
      <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: acc.base }} />
      <View className="flex-1">
        <Text numberOfLines={1} className="font-body-bold text-[15px] text-ink">
          {next.title}
          {next.time ? <Text className="font-body-semibold text-muted"> · {up.earlier ? `from ${formatTime(next.time)}` : formatTime(next.time)}</Text> : null}
        </Text>
        <Text className="font-body text-caption text-muted">
          Today
          {rest > 0 ? ` · ${rest} more planned` : ''}
          {doneCount > 0 ? ` · ${doneCount} done` : ''}
        </Text>
      </View>
      <ChevronRight size={18} color={p.textMuted} strokeWidth={ICON_STROKE} />
    </Pressable>
  );
}
