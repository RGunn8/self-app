import { router } from 'expo-router';
import { useRef } from 'react';
import { Text, type TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { useCreateDraft } from '@/features/identities/createDraft';
import { Button, HeaderAction, Input, KEYBOARD_OFFSET, KeyboardBar, NavHeader } from '@/shared/components/ui';

/** Step 1 of 3. The wording matters: "who do you want to become", never "what habits". */
export default function CreateName() {
  const { name, description, patch } = useCreateDraft();
  const descRef = useRef<TextInput>(null);
  return (
    <View className="flex-1 bg-bg">
      <NavHeader left={<HeaderAction label="Cancel" onPress={() => router.back()} />} title="1 of 3" right={<View />} />
      <KeyboardAwareScrollView bottomOffset={KEYBOARD_OFFSET} contentContainerClassName="p-gutter gap-5">
        <View className="gap-2">
          <Text className="font-body-semibold text-label text-muted">
            Create an identity
          </Text>
          <Text className="font-heading text-display-md text-ink">Who do you want to become?</Text>
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
          className="min-h-[110px]"
          accessibilityLabel="Description"
        />
        <Button label="Continue →" disabled={!name.trim()} onPress={() => router.push('/identity/create/priority')} />
      </KeyboardAwareScrollView>
      <KeyboardBar />
    </View>
  );
}
