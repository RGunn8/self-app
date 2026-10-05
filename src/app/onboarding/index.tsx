import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Input, KEYBOARD_OFFSET, T } from '@/components/ui';
import { settingsRepo } from '@/repos';
import { layout, space, useTheme } from '@/theme';

/** One screen, one idea. No account in V1; data lives on the device. */
export default function Welcome() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  return (
    <KeyboardAwareScrollView
      bottomOffset={KEYBOARD_OFFSET}
      keyboardShouldPersistTaps="handled"
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl, paddingHorizontal: layout.screenGutter }}>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.xl }}>
        <View style={{ height: 200 }}>
          <View style={{ position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: p.accents.runner.tint, left: 0, top: 10 }} />
          <View style={{ position: 'absolute', width: 110, height: 110, borderRadius: 55, backgroundColor: p.accents.parent.tint, left: 130, top: 70 }} />
          <View style={{ position: 'absolute', width: 64, height: 64, borderRadius: 32, backgroundColor: p.accents.writer.tint, left: 200, top: 0 }} />
        </View>
        <T v="label" muted>
          Identity Dashboard
        </T>
        <T v="displayXl">Track who you’re becoming.</T>
        <T v="bodyLg" muted>
          Define the people you want to be, choose what each one means to you, and see how your life lines up with them over time.
        </T>
        <Input value={name} onChangeText={setName} placeholder="Your first name (optional)" returnKeyType="done" accessibilityLabel="Your first name" />
      </View>
      <Button
        label="Get started"
        onPress={() => {
          if (name.trim()) settingsRepo.update({ userName: name.trim() });
          router.push('/onboarding/checkin');
        }}
      />
    </KeyboardAwareScrollView>
  );
}
