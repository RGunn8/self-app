import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import type { Moment } from '@/features/progress/domain';
import { Avatar, Row } from '@/shared/components/ui';
import { useData } from '@/shared/store/data';
import { accentFor, elevation, layout, useTheme } from '@/shared/theme';

interface MomentState {
  moment: Moment | null;
  action?: { label: string; onPress: () => void };
  key: number;
  hide: () => void;
}

const useMoment = create<MomentState>((set) => ({
  moment: null,
  key: 0,
  hide: () => set({ moment: null, action: undefined }),
}));

/** Show a quiet celebration card in the identity's color, with one success haptic. */
export function celebrate(moment: Moment, action?: MomentState['action']) {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  useMoment.setState((s) => ({ moment, action, key: s.key + 1 }));
}

export function MomentCard() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { moment, action, key, hide } = useMoment();
  const identity = useData((s) => s.identities.find((i) => i.id === moment?.identityId));
  useEffect(() => {
    if (!moment) return;
    const t = setTimeout(hide, 6000);
    return () => clearTimeout(t);
  }, [key, moment, hide]);
  if (!moment) return null;
  const acc = accentFor(p, identity?.accent);

  return (
    <Animated.View
      key={key}
      entering={FadeInDown}
      exiting={FadeOutDown}
      pointerEvents="box-none"
      // Reanimated's Animated.View isn't mapped by NativeWind, so it keeps inline styles.
      style={{ position: 'absolute', left: layout.screenGutter, right: layout.screenGutter, bottom: insets.bottom + 120 }}>
      <View accessibilityLiveRegion="polite" className="gap-3 rounded-card p-4" style={[{ backgroundColor: acc.tint }, elevation.lg]}>
        <Row className="items-start gap-3">
          {identity ? <Avatar marker={identity.marker} tint={p.card} size={40} /> : null}
          <View className="flex-1 gap-1">
            <Text style={{ color: acc.deep }} className="font-heading text-heading-card">
              {moment.title}
            </Text>
            <Text style={{ color: acc.deep }} className="font-body text-body-sm">
              {moment.body}
            </Text>
          </View>
        </Row>
        <Row className="justify-end gap-4">
          {action ? (
            <Pressable
              onPress={() => {
                action.onPress();
                hide();
              }}
              hitSlop={8}
              accessibilityRole="button">
              <Text style={{ color: acc.deep }} className="font-body-semibold text-label">
                {action.label}
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={hide} hitSlop={8} accessibilityRole="button">
            <Text style={{ color: acc.deep }} className="font-body-bold text-label">
              Nice
            </Text>
          </Pressable>
        </Row>
      </View>
    </Animated.View>
  );
}
