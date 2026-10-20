import { Stack } from 'expo-router';

import { useTheme } from '@/shared/theme';

export default function OnboardingLayout() {
  const p = useTheme();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }} />;
}
