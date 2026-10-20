import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { settingsRepo } from '@/features/settings/repo';
import { CheckinSchedule } from '@/features/week/components/CheckinSchedule';
import { requestCheckinPermission, scheduleWeeklyCheckin } from '@/features/week/notifications';
import { Button, HeaderAction, NavHeader, Screen } from '@/shared/components/ui';
import { loadSnapshot } from '@/shared/store/data';

/** The only notification the app sends. Asked for in context with a preview. */
export default function CheckinOnboarding() {
  const [day, setDay] = useState(0);
  const [time, setTime] = useState('18:00');

  const finish = (enable: boolean) => async () => {
    let on = false;
    if (enable) on = await requestCheckinPermission();
    settingsRepo.update({ checkinEnabled: on, checkinDay: day, checkinTime: time });
    loadSnapshot(['settings']);
    if (on) await scheduleWeeklyCheckin().catch(() => {});
    router.push('/onboarding/planning');
  };

  return (
    <Screen header={<NavHeader back={false} right={<HeaderAction label="Skip" onPress={finish(false)} />} />}>
      <Text className="font-heading text-display-lg text-ink">A weekly check-in</Text>
      <Text className="font-body text-body-lg text-muted">
        One notification a week with how your identities went. No daily nudges and no streaks.
      </Text>
      <View className="p-4 rounded-lg bg-card gap-1">
        <Text className="font-body-bold text-overline uppercase text-muted">
          Identity Dashboard · Sun 6:00 PM
        </Text>
        <Text className="text-ink font-body-bold text-[15px]">
          Your week in identities
        </Text>
        <Text className="font-body text-body-sm text-muted">
          How did Runner, Present parent and Writer go this week? Tap to see your week.
        </Text>
      </View>
      <CheckinSchedule
        day={day}
        time={time}
        onChange={(x) => {
          if (x.checkinDay !== undefined) setDay(x.checkinDay);
          if (x.checkinTime) setTime(x.checkinTime);
        }}
      />
      <Button label="Turn on weekly check-in" onPress={finish(true)} />
      <Button kind="ghost" label="Not now" onPress={finish(false)} />
    </Screen>
  );
}
