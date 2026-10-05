import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { CheckinSchedule } from '@/components/checkin';
import { Button, HeaderAction, NavHeader, Screen, T } from '@/components/ui';
import { requestCheckinPermission, scheduleWeeklyCheckin } from '@/lib/notifications';
import { settingsRepo } from '@/repos';
import { loadSnapshot } from '@/stores/data';
import { radius, space, useTheme } from '@/theme';

/** The only notification the app sends. Asked for in context with a preview. */
export default function CheckinOnboarding() {
  const p = useTheme();
  const [day, setDay] = useState(0);
  const [time, setTime] = useState('18:00');

  const finish = (enable: boolean) => async () => {
    let on = false;
    if (enable) on = await requestCheckinPermission();
    settingsRepo.update({ onboardedAt: Date.now(), checkinEnabled: on, checkinDay: day, checkinTime: time });
    loadSnapshot();
    if (on) await scheduleWeeklyCheckin().catch(() => {});
    router.replace('/');
  };

  return (
    <Screen header={<NavHeader back={false} right={<HeaderAction label="Skip" onPress={finish(false)} />} />}>
      <T v="displayLg">A weekly check-in</T>
      <T v="bodyLg" muted>
        One notification a week with how your identities went. No daily nudges and no streaks.
      </T>
      <View style={{ padding: space.lg, borderRadius: radius.lg, backgroundColor: p.card, gap: space.xs }}>
        <T v="overline" muted>
          Identity Dashboard · Sun 6:00 PM
        </T>
        <T v="label" style={{ fontFamily: 'Figtree_700Bold', fontSize: 15 }}>
          Your week in identities
        </T>
        <T v="bodySm" muted>
          Runner 85% ↑ · Present parent 84% → · Writer 71% ↑. Tap for the full week.
        </T>
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
