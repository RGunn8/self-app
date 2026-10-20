import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { settingsRepo } from '@/features/settings/repo';
import { Button, NavHeader, Row, Screen } from '@/shared/components/ui';
import { loadSnapshot } from '@/shared/store/data';
import { useTheme } from '@/shared/theme';

/** Planning is optional, so it's a choice from day one. It can be changed in Settings. */
export default function PlanningOnboarding() {
  const p = useTheme();

  const choose = (planningEnabled: boolean) => () => {
    settingsRepo.update({ planningEnabled });
    loadSnapshot(['settings']);
    router.push('/onboarding/day');
  };

  const preview = [
    { time: '7:00 AM', title: 'Long run', who: 'Runner', color: p.accents.runner.base },
    { time: 'Anytime', title: 'Call mom', who: 'Present parent', color: p.accents.parent.base },
  ];

  return (
    <Screen header={<NavHeader />}>
      <Text className="font-heading text-display-lg text-ink">Plan when you’ll act?</Text>
      <Text className="font-body text-body-lg text-muted">
        Choose days and times for your routines, and small intentions for who you want to be. Deciding when makes it far more likely to happen.
      </Text>
      <View className="gap-2 rounded-lg bg-card p-4">
        <Text className="font-body-bold text-overline uppercase text-muted">Today</Text>
        {preview.map((x) => (
          <Row key={x.title} className="gap-3 py-1">
            <View className="h-6 w-6 rounded-full border-2" style={{ borderColor: x.color }} />
            <View className="flex-1">
              <Text className="font-body-bold text-[15px] text-ink">{x.title}</Text>
              <Text className="font-body text-caption text-muted">
                {x.time} · {x.who}
              </Text>
            </View>
          </Row>
        ))}
      </View>
      <Text className="font-body text-body-sm text-muted">No to-do lists: plans belong to an identity and simply expire at the end of the day.</Text>
      <Button label="Yes, I’d like to plan" onPress={choose(true)} />
      <Button kind="ghost" label="Not for me" onPress={choose(false)} />
      <Text className="font-body text-caption text-muted text-center">You can change this any time in Settings.</Text>
    </Screen>
  );
}
