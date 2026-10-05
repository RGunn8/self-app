// The only notification the app sends: one weekly check-in. Content is rebuilt on every app open.
import * as Notifications from 'expo-notifications';

import { scoreOf, alignment } from '@/domain/alignment';
import { trendFor } from '@/domain/metrics';
import { identityInputs } from '@/stores/derived';
import { useData } from '@/stores/data';
import { today } from './dates';

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

/** "Runner 85% ↑ · Present parent 84% → · Writer 71% ↑" */
export function weeklySummaryLine(): string {
  const s = useData.getState();
  const t = today();
  const parts = identityInputs(s)
    .slice(0, 4)
    .map((i) => {
      const score = scoreOf(alignment(i.links, s.points, i.pauses, t));
      const top = i.links[0];
      const trend = top ? trendFor(top.metric, s.points, t) : null;
      const arrow = !trend || trend.status === 'steady' ? '→' : (trend.change ?? 0) > 0 ? '↑' : '↓';
      return score === null ? null : `${i.name} ${score}% ${arrow}`;
    })
    .filter(Boolean);
  return parts.length ? `${parts.join(' · ')}. Tap for the full week.` : 'See how your identities went this week.';
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
      body: weeklySummaryLine(),
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
