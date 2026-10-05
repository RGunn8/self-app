import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { useCreateDraft } from '@/stores/createDraft';
import { useTheme } from '@/theme';

export default function CreateLayout() {
  const p = useTheme();
  useEffect(() => {
    useCreateDraft.getState().reset();
  }, []);
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }} />;
}
