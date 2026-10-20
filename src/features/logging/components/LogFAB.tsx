import { router, useSegments } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ICON_STROKE } from '@/shared/components/ui';
import { useData } from '@/shared/store/data';
import { elevation, layout, space, useTheme } from '@/shared/theme';

const HIDE_FAB_ON = new Set(['onboarding', 'log', 'metric-form', 'add-tracker', 'create', 'edit', 'pause', 'system-form', 'settings', 'entry', 'week', 'plan', 'actions', 'history', 'calendar']);

/** The floating Log button. Reachable from everywhere except forms. Hidden until a metric exists. */
export function LogFAB() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  const hasMetrics = useData((s) => s.metrics.length > 0);
  const inTabs = segments[0] === '(tabs)';
  if (!hasMetrics || segments.some((s) => HIDE_FAB_ON.has(s))) return null;
  return (
    <Pressable
      onPress={() => router.push('/log')}
      accessibilityRole="button"
      accessibilityLabel="Log"
      className="absolute right-gutter h-fab flex-row items-center gap-2 rounded-pill bg-accent px-6 active:bg-accent-pressed"
      style={[{ bottom: insets.bottom + (inTabs ? layout.tabBarHeight + space.md : space.xl) }, elevation.lg]}>
      <Plus size={20} color={p.onAccent} strokeWidth={ICON_STROKE} />
      <Text className="font-heading text-heading-button text-on-accent">
        Log
      </Text>
    </Pressable>
  );
}
