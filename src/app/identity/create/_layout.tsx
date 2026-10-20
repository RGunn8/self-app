import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { useCreateDraft } from '@/features/identities/createDraft';
import { useTheme } from '@/shared/theme';

export default function CreateLayout() {
  const p = useTheme();
  useEffect(() => {
    useCreateDraft.getState().reset();
  }, []);
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }} />;
}
