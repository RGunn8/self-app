import { Redirect, Tabs } from 'expo-router';
import { Lightbulb, Scale, UserRound } from 'lucide-react-native';

import { ICON_STROKE } from '@/components/ui';
import { useSettings } from '@/stores/settings';
import { useTheme } from '@/theme';

export default function TabLayout() {
  const p = useTheme();
  const onboarded = useSettings((s) => s.onboardedAt !== null);
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
