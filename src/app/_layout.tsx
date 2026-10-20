import '../../global.css';
import '@/shared/lib/nativewind';

import { Caprasimo_400Regular } from '@expo-google-fonts/caprasimo';
import { Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold, useFonts } from '@expo-google-fonts/figtree';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, type ErrorBoundaryProps, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { colorScheme } from 'nativewind';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';

import { LogFAB } from '@/features/logging/components/LogFAB';
import { startPlanReminderSync } from '@/features/planning/reminders';
import { MomentCard } from '@/features/progress/components/MomentCard';
import { settingsRepo } from '@/features/settings/repo';
import { ErrorScreen } from '@/features/settings/screens/ErrorScreen';
import { scheduleWeeklyCheckin } from '@/features/week/notifications';
import { Toast } from '@/shared/components/toast';
import { migrate } from '@/shared/db/client';
import { seedDemo } from '@/shared/db/seed';
import { startDataSync, useData } from '@/shared/store/data';
import { radius, useTheme } from '@/shared/theme';

SplashScreen.preventAutoHideAsync();

/** Any screen that throws lands here instead of a blank app. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <ErrorScreen title="Something went wrong" detail={error.message} onRetry={retry} />;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Caprasimo_400Regular, Figtree_400Regular, Figtree_600SemiBold, Figtree_700Bold });
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const p = useTheme();
  const ready = useData((s) => s.ready);
  const appearance = useData((s) => s.settings.appearance);

  // Drives the dark: variant and the CSS variables in global.css.
  useEffect(() => colorScheme.set(appearance), [appearance]);

  useEffect(() => {
    migrate()
      .then(() => {
        // Dev convenience: `EXPO_PUBLIC_SEED_DEMO=1 npx expo start` loads Maya's demo data on an empty database.
        if (__DEV__ && process.env.EXPO_PUBLIC_SEED_DEMO === '1' && settingsRepo.get().onboardedAt === null) {
          seedDemo();
          settingsRepo.update({ onboardedAt: Date.now(), userName: 'Maya' });
        }
        startDataSync();
        startPlanReminderSync();
        setDbReady(true);
        scheduleWeeklyCheckin().catch(() => {});
      })
      .catch((e) => {
        console.error('Migration failed', e);
        setDbError(e instanceof Error ? e.message : String(e));
        SplashScreen.hideAsync();
      });
  }, [attempt]);

  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    const url = response?.notification.request.content.data?.url;
    if (ready && typeof url === 'string') router.push(url as never);
  }, [response, ready]);

  // Start on Today when the person chose to (Identities is the default home). Once per launch,
  // and never over a notification that's opening somewhere specific.
  const startedOn = useRef(false);
  useEffect(() => {
    if (startedOn.current || !fontsLoaded || !dbReady || !ready) return;
    startedOn.current = true;
    const s = useData.getState().settings;
    if (s.onboardedAt !== null && s.planningEnabled && s.startTab === 'today' && !response) router.navigate('/today');
  }, [fontsLoaded, dbReady, ready, response]);

  useEffect(() => {
    if (fontsLoaded && dbReady && ready) SplashScreen.hideAsync();
    // Dev convenience for screenshots: `EXPO_PUBLIC_DEV_ROUTE=/settings npx expo start` opens that route at launch.
    const devRoute = process.env.EXPO_PUBLIC_DEV_ROUTE;
    if (__DEV__ && devRoute && fontsLoaded && dbReady && ready) setTimeout(() => router.push(devRoute as never), 300);
  }, [fontsLoaded, dbReady, ready]);

  if (dbError) {
    return (
      <ErrorScreen
        title="The app couldn’t start"
        detail={dbError}
        onRetry={() => {
          setDbError(null);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }
  if (!fontsLoaded || !dbReady || !ready) return null;

  const navTheme = p.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const sheet = {
    presentation: 'formSheet' as const,
    sheetGrabberVisible: true,
    sheetCornerRadius: radius.sheet,
    contentStyle: { backgroundColor: p.bg },
  };

  return (
    <GestureHandlerRootView className="flex-1">
      <KeyboardProvider>
        <ThemeProvider value={{ ...navTheme, colors: { ...navTheme.colors, background: p.bg, card: p.bg, text: p.text } }}>
          <StatusBar style={p.scheme === 'dark' ? 'light' : 'dark'} />
          <View className="flex-1 bg-bg">
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: p.bg } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
              <Stack.Screen name="identity/create" options={{ presentation: 'modal' }} />
              <Stack.Screen name="identity/[id]/edit" options={{ presentation: 'modal' }} />
              <Stack.Screen name="identity/[id]/pause" options={{ ...sheet, sheetAllowedDetents: [0.75] }} />
              <Stack.Screen name="identity/[id]/actions" options={{ ...sheet, sheetAllowedDetents: 'fitToContents' }} />
              <Stack.Screen name="plan/[day]" options={{ ...sheet, sheetAllowedDetents: [0.75, 0.95] }} />
              <Stack.Screen name="plan/edit/[id]" options={{ ...sheet, sheetAllowedDetents: 'fitToContents' }} />
              <Stack.Screen name="plan/week/[weekStart]" options={{ presentation: 'modal' }} />
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
            <MomentCard />
          </View>
        </ThemeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
