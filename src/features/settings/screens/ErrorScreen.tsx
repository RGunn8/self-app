import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { shareBackup } from '@/features/settings/backup';
import { Button } from '@/shared/components/ui';

/**
 * Shown when the app can't start (a failed migration) or a screen crashes. Data lives only on
 * this phone, so the first thing offered after "try again" is a way to save it.
 */
export function ErrorScreen({ title, detail, onRetry }: { title: string; detail?: string; onRetry: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 justify-center gap-4 bg-bg px-gutter" style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <Text className="font-heading text-display-sm text-ink">{title}</Text>
      <Text className="font-body text-body-md text-muted">
        Your data is still on this phone. Try again, or save a backup first so nothing can be lost.
      </Text>
      {detail ? (
        <Text selectable className="font-body text-caption text-muted">
          {detail}
        </Text>
      ) : null}
      <Button label="Try again" onPress={onRetry} />
      <Button kind="secondary" label="Save a backup" onPress={() => shareBackup().catch(() => {})} />
    </View>
  );
}
