import { router } from 'expo-router';
import { Check, ChevronRight } from 'lucide-react-native';
import { useRef } from 'react';
import { type GestureResponderEvent, Pressable, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { completeIntention, moveToTomorrow, openSession, removePlan, reopenIntention, skipPlan } from '@/features/planning/actions';
import { formatTime, type PlanItem } from '@/features/planning/domain';
import { ICON_STROKE, Row } from '@/shared/components/ui';
import { useData } from '@/shared/store/data';
import { accentFor, useTheme } from '@/shared/theme';

const TAP_SLOP = 8;

function SwipeAction({ label, onPress, strong }: { label: string; onPress: () => void; strong?: boolean }) {
  return (
    <Pressable onPress={onPress} className={strong ? 'h-full px-4 justify-center rounded-md bg-selected' : 'h-full px-4 justify-center rounded-md bg-chip'}>
      <Text className={strong ? 'font-body-semibold text-label text-on-selected' : 'font-body-semibold text-label text-ink'}>{label}</Text>
    </Pressable>
  );
}

/**
 * One plan. The circle does it: a session opens its system's checklist, an intention is marked
 * done. The row opens the plan to change its time or day. Swipe for Tomorrow, Not today, Remove.
 */
export function PlanRow({ item }: { item: PlanItem }) {
  const p = useTheme();
  const identities = useData((s) => s.identities);
  const metric = useData((s) => (item.plan.metricId ? s.metrics.find((m) => m.id === item.plan.metricId) : undefined));
  const who = item.identityIds.map((id) => identities.find((i) => i.id === id)).filter((i) => i !== undefined);
  const acc = accentFor(p, who[0]?.accent);
  const done = item.status === 'done';
  const skipped = item.status === 'skipped';

  // A swipe that starts on the circle must not complete the plan: only a still tap counts.
  const start = useRef({ x: 0, y: 0 });
  const moved = useRef(false);
  const onPressIn = (e: GestureResponderEvent) => {
    start.current = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
    moved.current = false;
  };
  const onPressOut = (e: GestureResponderEvent) => {
    moved.current = Math.hypot(e.nativeEvent.pageX - start.current.x, e.nativeEvent.pageY - start.current.y) > TAP_SLOP;
  };

  const toggle = () => {
    if (moved.current) return;
    if (item.kind === 'system') return openSession(item);
    if (done) return reopenIntention(item);
    completeIntention(item);
  };
  const sub = [
    item.time ? formatTime(item.time) : 'Anytime',
    who.map((i) => i.name).join(' · '),
    metric && item.plan.amount !== null ? `logs ${item.plan.amount} ${metric.unit}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ReanimatedSwipeable
      friction={2}
      rightThreshold={40}
      enabled={!done}
      renderRightActions={() => (
        <Row className="gap-1 pl-2">
          <SwipeAction label="Tomorrow" onPress={() => moveToTomorrow(item)} />
          {!skipped ? <SwipeAction label="Not today" onPress={() => skipPlan(item)} /> : null}
          <SwipeAction label="Remove" strong onPress={() => removePlan(item)} />
        </Row>
      )}>
      <Row className="gap-3 rounded-md bg-card px-4 py-3" style={skipped ? { opacity: 0.55 } : null}>
        <Pressable
          onPress={toggle}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          hitSlop={8}
          accessibilityRole={item.kind === 'system' ? 'button' : 'checkbox'}
          accessibilityLabel={item.kind === 'system' ? `Open ${item.title}` : item.title}
          accessibilityState={item.kind === 'system' ? undefined : { checked: done }}
          className="h-7 w-7 items-center justify-center rounded-full border-2"
          style={{ borderColor: done ? acc.base : acc.base, backgroundColor: done ? acc.base : 'transparent' }}>
          {done ? <Check size={16} color={p.onAccent} strokeWidth={ICON_STROKE} /> : null}
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/plan/edit/[id]', params: { id: item.plan.id } })}
          disabled={done}
          accessibilityRole="button"
          accessibilityHint="Change time or day"
          className="flex-1 flex-row items-center gap-2">
          <View className="flex-1 gap-0.5">
            <Text className={done ? 'font-body-bold text-[15px] text-muted line-through' : 'font-body-bold text-[15px] text-ink'}>{item.title}</Text>
            <Text numberOfLines={1} className="font-body text-caption text-muted">
              {sub}
            </Text>
          </View>
          {item.kind === 'system' && !done ? <ChevronRight size={18} color={p.textMuted} strokeWidth={ICON_STROKE} /> : null}
        </Pressable>
      </Row>
    </ReanimatedSwipeable>
  );
}
