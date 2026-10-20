import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { colors, elevation, layout } from '@/shared/theme';

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
      // Reanimated's Animated.View isn't mapped by NativeWind, so it keeps inline styles.
      style={{ position: 'absolute', left: layout.screenGutter, right: layout.screenGutter, bottom: insets.bottom + 130 }}>
      <View
        accessibilityLiveRegion="polite"
        className="flex-row items-center gap-3 rounded-md bg-neutral-900 px-4 py-3 dark:bg-card-raised"
        style={elevation.lg}>
        <Text className="text-neutral-100 flex-1 font-body text-[14px]">
          {message}
        </Text>
        {action ? (
          <Pressable
            onPress={() => {
              action.onPress();
              hide();
            }}
            hitSlop={8}>
            <Text style={{ color: colors.accentRamp[400] }} className="font-body-semibold text-label">
              {action.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}
