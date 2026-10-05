import { Caprasimo_400Regular } from '@expo-google-fonts/caprasimo';
import { Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold, useFonts } from '@expo-google-fonts/figtree';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { LogFAB, Toast } from '@/components/overlay';
import { migrate } from '@/db/client';
import { seedDemo } from '@/db/seed';
import { settingsRepo } from '@/repos';
import { scheduleWeeklyCheckin } from '@/lib/notifications';
import { startDataSync, useData } from '@/stores/data';
import { radius, useTheme } from '@/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Caprasimo_400Regular, Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold });
  const [dbReady, setDbReady] = useState(false);
  const p = useTheme();
  const ready = useData((s) => s.ready);

  useEffect(() => {
    migrate()
      .then(() => {
        // Dev convenience: `EXPO_PUBLIC_SEED_DEMO=1 npx expo start` loads Maya's demo data on an empty database.
        if (__DEV__ && process.env.EXPO_PUBLIC_SEED_DEMO === '1' && settingsRepo.get().onboardedAt === null) {
          seedDemo();
          settingsRepo.update({ onboardedAt: Date.now(), userName: 'Maya' });
        }
        startDataSync();
        setDbReady(true);
        scheduleWeeklyCheckin().catch(() => {});
      })
      .catch((e) => console.error('Migration failed', e));
  }, []);

  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (ready && typeof url === 'string') router.push(url as never);
  }, [response, ready]);

  useEffect(() => {
    if (fontsLoaded && dbReady && ready) SplashScreen.hideAsync();
    // Dev convenience for screenshots: `EXPO_PUBLIC_DEV_ROUTE=/settings npx expo start` opens that route at launch.
    const devRoute = process.env.EXPO_PUBLIC_DEV_ROUTE;
    if (__DEV__ && devRoute && fontsLoaded && dbReady && ready) setTimeout(() => router.push(devRoute as never), 300);
  }, [fontsLoaded, dbReady, ready]);

  if (!fontsLoaded || !dbReady || !ready) return null;

  const navTheme = p.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const sheet = {
    presentation: 'formSheet' as const,
    sheetGrabberVisible: true,
    sheetCornerRadius: radius.sheet,
    contentStyle: { backgroundColor: p.bg },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <ThemeProvider value={{ ...navTheme, colors: { ...navTheme.colors, background: p.bg, card: p.bg, text: p.text } }}>
          <StatusBar style={p.scheme === 'dark' ? 'light' : 'dark'} />
          <View style={{ flex: 1, backgroundColor: p.bg }}>
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
              <Stack.Screen name="identity/create" options={{ presentation: 'modal' }} />
              <Stack.Screen name="identity/[id]/edit" options={{ presentation: 'modal' }} />
              <Stack.Screen name="identity/[id]/pause" options={{ ...sheet, sheetAllowedDetents: [0.75] }} />
              <Stack.Screen name="metric-form" options={{ presentation: 'modal' }} />
              <Stack.Screen name="system-form" options={{ presentation: 'modal' }} />
              <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
              <Stack.Screen name="week/[weekStart]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="log" options={{ ...sheet, sheetAllowedDetents: [0.62, 0.92] }} />
              <Stack.Screen name="add-tracker" options={{ ...sheet, sheetAllowedDetents: [0.62, 0.92] }} />
              <Stack.Screen name="entry/[id]" options={{ ...sheet, sheetAllowedDetents: [0.7] }} />
            </Stack>
            <LogFAB />
            <Toast />
          </View>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
