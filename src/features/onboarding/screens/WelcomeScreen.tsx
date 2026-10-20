import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { settingsRepo } from '@/features/settings/repo';
import { Button, Input, KEYBOARD_OFFSET } from '@/shared/components/ui';
import { space, useTheme } from '@/shared/theme';

/** One screen, one idea. No account in V1; data lives on the device. */
export default function Welcome() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  return (
    <KeyboardAwareScrollView
      bottomOffset={KEYBOARD_OFFSET}
      keyboardShouldPersistTaps="handled"
      className="bg-bg"
      contentContainerClassName="grow px-gutter" contentContainerStyle={{ paddingTop: insets.top + space.xxl, paddingBottom: insets.bottom + space.xl }}>
      <View className="flex-1 justify-center gap-5">
        <View className="h-[200px]">
          <View className="absolute w-[170px] h-[170px] rounded-[85px] left-0 top-2.5" style={{ backgroundColor: p.accents.runner.tint }} />
          <View className="absolute w-[110px] h-[110px] rounded-[55px] left-[130px] top-[70px]" style={{ backgroundColor: p.accents.parent.tint }} />
          <View className="absolute w-16 h-16 rounded-[32px] left-[200px] top-0" style={{ backgroundColor: p.accents.writer.tint }} />
        </View>
        <Text className="font-body-semibold text-label text-muted">
          Identity Dashboard
        </Text>
        <Text className="font-heading text-display-xl text-ink">Track who you’re becoming.</Text>
        <Text className="font-body text-body-lg text-muted">
          Define the people you want to be, choose what each one means to you, and see how your life lines up with them over time.
        </Text>
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
