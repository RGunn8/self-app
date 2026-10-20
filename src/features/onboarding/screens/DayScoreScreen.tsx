import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { DayRing } from '@/features/progress/components/DayRing';
import { settingsRepo } from '@/features/settings/repo';
import { Button, NavHeader, Screen } from '@/shared/components/ui';
import { loadSnapshot } from '@/shared/store/data';

/** The last onboarding step: an optional daily read, offered with a preview and an easy no. */
export default function DayScoreOnboarding() {
  const finish = (dayScoreEnabled: boolean) => () => {
    settingsRepo.update({ onboardedAt: Date.now(), dayScoreEnabled });
    loadSnapshot(['settings']);
    router.replace('/');
  };

  return (
    <Screen header={<NavHeader />}>
      <Text className="font-heading text-display-lg text-ink">A daily read?</Text>
      <Text className="font-body text-body-lg text-muted">
        A ring that fills as you act on your identities through the day. It uses words, not grades, and compares each day with your own usual.
      </Text>
      <View className="gap-3 rounded-lg bg-card p-4">
        <DayRing score={{ state: 'scored', fill: 0.6, band: 'steady', kept: 3, planned: 4, extras: 1, votes: 4, usual: 3 }} />
        <Text className="font-body text-body-sm text-muted">It only fills. Rest days and quiet days are never counted against you.</Text>
      </View>
      <Button label="Yes, show me" onPress={finish(true)} />
      <Button kind="ghost" label="Not for me" onPress={finish(false)} />
      <Text className="font-body text-caption text-muted text-center">You can change this any time in Settings.</Text>
    </Screen>
  );
}
