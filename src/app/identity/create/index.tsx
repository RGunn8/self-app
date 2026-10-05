import { router } from 'expo-router';
import { useRef } from 'react';
import { type TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button, HeaderAction, Input, KEYBOARD_OFFSET, KeyboardBar, NavHeader, T } from '@/components/ui';
import { useCreateDraft } from '@/stores/createDraft';
import { layout, space, useTheme } from '@/theme';

/** Step 1 of 3. The wording matters: "who do you want to become", never "what habits". */
export default function CreateName() {
  const p = useTheme();
  const { name, description, patch } = useCreateDraft();
  const descRef = useRef<TextInput>(null);
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <NavHeader left={<HeaderAction label="Cancel" onPress={() => router.back()} />} title="1 of 3" right={<View />} />
      <KeyboardAwareScrollView bottomOffset={KEYBOARD_OFFSET} contentContainerStyle={{ padding: layout.screenGutter, gap: space.xl }}>
        <View style={{ gap: space.sm }}>
          <T v="label" muted>
            Create an identity
          </T>
          <T v="displayMd">Who do you want to become?</T>
        </View>
        <Input
          value={name}
          onChangeText={(t) => patch({ name: t })}
          placeholder="A better runner"
          autoFocus
          returnKeyType="next"
          onSubmitEditing={() => descRef.current?.focus()}
          accessibilityLabel="Identity name"
        />
        <Input
          ref={descRef}
          value={description}
          onChangeText={(t) => patch({ description: t })}
          placeholder="Optional description"
          multiline
          style={{ minHeight: 110 }}
          accessibilityLabel="Description"
        />
        <Button label="Continue →" disabled={!name.trim()} onPress={() => router.push('/identity/create/priority')} />
      </KeyboardAwareScrollView>
      <KeyboardBar />
    </View>
  );
}
