// Opt-in reminders at the times you planned. Off by default; the weekly check-in is separate.
import * as Notifications from 'expo-notifications';
import Storage from 'expo-sqlite/kv-store';
import { Alert } from 'react-native';

import { remindersToSchedule } from '@/features/planning/domain';
import { planDataOf } from '@/features/planning/views';
import { settingsRepo } from '@/features/settings/repo';
import { requestCheckinPermission } from '@/features/week/notifications';
import { useData } from '@/shared/store/data';

const PREFIX = 'plan:';

async function cancelAll() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled.filter((n) => n.identifier.startsWith(PREFIX)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

let running: Promise<void> | null = null;
let again = false;

/** Re-schedule every plan reminder from the current snapshot. Calls during a sync collapse into one more run. */
export function syncPlanReminders(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await cancelAll();
      const s = useData.getState();
      if (!s.settings.planningEnabled || !s.settings.planReminders) continue;
      const perm = await Notifications.getPermissionsAsync();
      if (!perm.granted) continue;
      for (const r of remindersToSchedule(planDataOf(s), new Date())) {
        await Notifications.scheduleNotificationAsync({
          identifier: `${PREFIX}${r.planId}`,
          content: { title: r.title, body: r.body, data: { url: '/today' } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
        });
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Keep reminders in step with plans, completions and the setting. */
export function startPlanReminderSync() {
  syncPlanReminders().catch(() => {});
  return useData.subscribe((s, prev) => {
    if (s.plans !== prev.plans || s.completions !== prev.completions || s.settings !== prev.settings || s.systems !== prev.systems) {
      syncPlanReminders().catch(() => {});
    }
  });
}

/** Turn plan reminders on (asking for permission first) or off. Returns whether they're on. */
export async function setPlanReminders(on: boolean): Promise<boolean> {
  if (on && !(await requestCheckinPermission())) {
    Alert.alert('Notifications are off', 'Turn on notifications for this app in iOS Settings to get reminders at planned times.');
    return false;
  }
  settingsRepo.update({ planReminders: on });
  return on;
}

const OFFERED_KEY = 'planning:offered-reminders';

/** The first time a plan gets a time, offer reminders once. Never asks again. */
export async function offerRemindersOnce() {
  if (useData.getState().settings.planReminders) return;
  if (await Storage.getItem(OFFERED_KEY).catch(() => null)) return;
  await Storage.setItem(OFFERED_KEY, '1').catch(() => {});
  Alert.alert('Remind you at planned times?', 'A quiet notification at the time you chose. Only for plans with a time, and you can turn it off in Settings.', [
    { text: 'Not now', style: 'cancel' },
    { text: 'Remind me', onPress: () => setPlanReminders(true).catch(() => {}) },
  ]);
}
