// The only notification the app sends: one weekly check-in. It's rescheduled on every app open.
import * as Notifications from 'expo-notifications';

import { useData } from '@/shared/store/data';

const CHECKIN_ID = 'weekly-checkin';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestCheckinPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/**
 * The repeating notification's text is fixed when it's scheduled, so it can't carry this week's
 * numbers without going stale. It names the identities instead; the review has the numbers.
 */
export function weeklyCheckinBody(): string {
  const names = useData
    .getState()
    .identities.filter((i) => i.archivedAt === null)
    .slice(0, 3)
    .map((i) => i.name);
  if (names.length === 0) return 'Your week is ready. Tap to see how it went.';
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `How did ${list} go this week? Tap to see your week.`;
}

export async function scheduleWeeklyCheckin() {
  await Notifications.cancelScheduledNotificationAsync(CHECKIN_ID).catch(() => {});
  const { settings } = useData.getState();
  if (!settings.checkinEnabled) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  const [hour, minute] = settings.checkinTime.split(':').map(Number);
  await Notifications.scheduleNotificationAsync({
    identifier: CHECKIN_ID,
    content: {
      title: 'Your week in identities',
      body: weeklyCheckinBody(),
      data: { url: '/week/latest' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: settings.checkinDay + 1, // expo: 1 = Sunday
      hour,
      minute,
    },
  });
}
