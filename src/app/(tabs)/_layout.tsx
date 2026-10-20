import { Redirect, Tabs } from 'expo-router';
import { Lightbulb, Scale, Sun, UserRound } from 'lucide-react-native';

import { useSettings } from '@/features/settings/useSettings';
import { ICON_STROKE } from '@/shared/components/ui';
import { useTheme } from '@/shared/theme';

export default function TabLayout() {
  const p = useTheme();
  const onboarded = useSettings((s) => s.onboardedAt !== null);
  const planning = useSettings((s) => s.planningEnabled);
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: p.text,
        tabBarInactiveTintColor: p.textMuted,
        tabBarStyle: { backgroundColor: p.bg, borderTopColor: p.divider },
        tabBarLabelStyle: { fontFamily: 'Figtree_600SemiBold', fontSize: 11 },
        sceneStyle: { backgroundColor: p.bg },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Identities', tabBarIcon: ({ color }) => <UserRound color={color} size={22} strokeWidth={ICON_STROKE} /> }}
      />
      <Tabs.Screen
        name="today"
        options={{ href: planning ? undefined : null, title: 'Today', tabBarIcon: ({ color }) => <Sun color={color} size={22} strokeWidth={ICON_STROKE} /> }}
      />
      <Tabs.Screen
        name="balance"
        options={{ title: 'Balance', tabBarIcon: ({ color }) => <Scale color={color} size={22} strokeWidth={ICON_STROKE} /> }}
      />
      <Tabs.Screen
        name="insights"
        options={{ title: 'Insights', tabBarIcon: ({ color }) => <Lightbulb color={color} size={22} strokeWidth={ICON_STROKE} /> }}
      />
    </Tabs>
  );
}
