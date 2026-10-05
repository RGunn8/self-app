import { router, useSegments } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { useData } from '@/stores/data';
import { colors, elevation, layout, radius, space, useTheme } from "@/theme";
import { ICON_STROKE, T } from './ui';

interface ToastState {
  message: string | null;
  action?: { label: string; onPress: () => void };
  key: number;
  show: (message: string, action?: ToastState['action']) => void;
  hide: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  key: 0,
  show: (message, action) => set((s) => ({ message, action, key: s.key + 1 })),
  hide: () => set({ message: null, action: undefined }),
}));

export const toast = (message: string, action?: ToastState['action']) => useToast.getState().show(message, action);

export function Toast() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { message, action, key, hide } = useToast();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, action ? 5000 : 3000);
    return () => clearTimeout(t);
  }, [key, message, action, hide]);
  if (!message) return null;
  return (
    <Animated.View
      key={key}
      entering={FadeInDown}
      exiting={FadeOutDown}
      pointerEvents="box-none"
      style={{ position: 'absolute', left: layout.screenGutter, right: layout.screenGutter, bottom: insets.bottom + 130 }}>
      <View
        accessibilityLiveRegion="polite"
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
            paddingVertical: space.md,
            paddingHorizontal: space.lg,
            borderRadius: radius.md,
            backgroundColor: p.scheme === 'light' ? p.neutral[900] : p.cardRaised,
          },
          elevation.lg,
        ]}>
        <T v="label" color={p.neutral[100]} style={{ flex: 1, fontFamily: 'Figtree_400Regular', fontSize: 14 }}>
          {message}
        </T>
        {action ? (
          <Pressable
            onPress={() => {
              action.onPress();
              hide();
            }}
            hitSlop={8}>
            <T v="label" color={colors.accentRamp[400]}>
              {action.label}
            </T>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const HIDE_FAB_ON = new Set(['onboarding', 'log', 'metric-form', 'add-tracker', 'create', 'edit', 'pause', 'system-form', 'settings', 'entry', 'week']);

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
      style={({ pressed }) => [
        {
          position: 'absolute',
          right: layout.screenGutter,
          bottom: insets.bottom + (inTabs ? layout.tabBarHeight + space.md : space.xl),
          height: layout.fabHeight,
          paddingHorizontal: space.xxl,
          borderRadius: radius.pill,
          backgroundColor: pressed ? p.accentPressed : p.accent,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
        },
        elevation.lg,
      ]}>
      <Plus size={20} color={p.onAccent} strokeWidth={ICON_STROKE} />
      <T v="headingButton" color={p.onAccent}>
        Log
      </T>
    </Pressable>
  );
}
