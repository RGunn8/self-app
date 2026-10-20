import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Alert, Pressable, Switch, Text, View } from 'react-native';

import { identitiesRepo } from '@/features/identities/repo';
import { DAY_LIMIT_MAX, DAY_LIMIT_MIN } from '@/features/planning/domain';
import { setPlanReminders } from '@/features/planning/reminders';
import { pickAndRestore, shareBackup } from '@/features/settings/backup';
import { settingsRepo } from '@/features/settings/repo';
import { CheckinSchedule } from '@/features/week/components/CheckinSchedule';
import { requestCheckinPermission, scheduleWeeklyCheckin } from '@/features/week/notifications';
import { toast } from '@/shared/components/toast';
import { HeaderAction, ListRow, NavHeader, Overline, Row, Screen, Segmented } from '@/shared/components/ui';
import { clearAll, seedDemo } from '@/shared/db/seed';
import { dayKey } from '@/shared/lib/dates';
import { loadSnapshot, useData } from '@/shared/store/data';
import { useTheme } from '@/shared/theme';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Overline>{title}</Overline>
      {children}
    </View>
  );
}

function csvCell(v: unknown) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function SettingsScreen() {
  const p = useTheme();
  const s = useData();
  const st = s.settings;
  const archived = s.identities.filter((i) => i.archivedAt !== null);

  const update = (patch: Parameters<typeof settingsRepo.update>[0]) => {
    settingsRepo.update(patch);
    loadSnapshot();
    if ('checkinEnabled' in patch || 'checkinDay' in patch || 'checkinTime' in patch) scheduleWeeklyCheckin().catch(() => {});
  };

  const toggleCheckin = async (on: boolean) => {
    if (on && !(await requestCheckinPermission())) {
      Alert.alert('Notifications are off', 'Turn on notifications for this app in iOS Settings to get the weekly check-in.');
      return;
    }
    update({ checkinEnabled: on });
  };

  const exportCsv = async () => {
    const metrics = new Map(s.metrics.map((m) => [m.id, m]));
    const rows = [['date', 'time', 'metric', 'value', 'unit', 'identities', 'source']];
    for (const e of s.entries) {
      const m = metrics.get(e.metricId);
      const ids = s.links.filter((l) => l.metricId === e.metricId).map((l) => s.identities.find((i) => i.id === l.identityId)?.name);
      rows.push([dayKey(e.loggedAt), new Date(e.loggedAt).toTimeString().slice(0, 5), m?.name ?? '', String(e.value), m?.unit ?? '', ids.filter(Boolean).join('; '), e.systemCompletionId ? 'system' : e.source]);
    }
    const file = new File(Paths.cache, `identity-dashboard-${dayKey(Date.now())}.csv`);
    file.create({ overwrite: true });
    file.write(rows.map((r) => r.map(csvCell).join(',')).join('\n'));
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv' });
  };

  return (
    <Screen header={<NavHeader title="Settings" back={false} right={<HeaderAction label="Done" bold onPress={() => router.back()} />} />}>
      <Text className="font-heading text-display-lg text-ink">Settings</Text>

      <Group title="Data sources">
        <ListRow title="Apple Health" sub="Coming in a later version. Everything is manual for now." />
      </Group>

      <Group title="Weekly check-in">
        <ListRow
          title="Weekly check-in"
          sub="One notification a week, nothing daily"
          right={<Switch value={st.checkinEnabled} onValueChange={toggleCheckin} trackColor={{ true: p.accent }} />}
        />
        {st.checkinEnabled ? <CheckinSchedule day={st.checkinDay} time={st.checkinTime} onChange={update} /> : null}
        <ListRow title="See last week" onPress={() => router.push('/week/latest')} />
      </Group>

      <Group title="Planning">
        <ListRow
          title="Plan when you’ll act"
          sub="A Today tab and weekly planning for your systems. Turning it off hides them; your plans are kept."
          right={
            <Switch
              value={st.planningEnabled}
              onValueChange={(on) => update(on ? { planningEnabled: true } : { planningEnabled: false, startTab: 'identities' })}
              trackColor={{ true: p.accent }}
            />
          }
        />
        {st.planningEnabled ? (
          <ListRow
            title="A full day"
            sub="How many plans feel like plenty. Past it, Today suggests leaving room; it never stops you."
            right={
              <Row className="gap-2">
                <Pressable
                  onPress={() => update({ dayPlanLimit: Math.max(DAY_LIMIT_MIN, st.dayPlanLimit - 1) })}
                  disabled={st.dayPlanLimit <= DAY_LIMIT_MIN}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Fewer plans"
                  className="h-9 w-9 items-center justify-center rounded-full bg-chip"
                  style={{ opacity: st.dayPlanLimit <= DAY_LIMIT_MIN ? 0.4 : 1 }}>
                  <Text className="font-body-bold text-[18px] text-ink">−</Text>
                </Pressable>
                <Text accessibilityLabel={`${st.dayPlanLimit} plans`} className="w-7 text-center font-body-bold text-[17px] text-ink">
                  {st.dayPlanLimit}
                </Text>
                <Pressable
                  onPress={() => update({ dayPlanLimit: Math.min(DAY_LIMIT_MAX, st.dayPlanLimit + 1) })}
                  disabled={st.dayPlanLimit >= DAY_LIMIT_MAX}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="More plans"
                  className="h-9 w-9 items-center justify-center rounded-full bg-chip"
                  style={{ opacity: st.dayPlanLimit >= DAY_LIMIT_MAX ? 0.4 : 1 }}>
                  <Text className="font-body-bold text-[18px] text-ink">+</Text>
                </Pressable>
              </Row>
            }
          />
        ) : null}
        {st.planningEnabled ? (
          <ListRow
            title="Remind me at planned times"
            sub="Only for plans you gave a time. Off unless you turn it on."
            right={
              <Switch
                value={st.planReminders}
                onValueChange={(on) => setPlanReminders(on).then(() => loadSnapshot(['settings']))}
                trackColor={{ true: p.accent }}
              />
            }
          />
        ) : null}
      </Group>

      <Group title="Dashboard">
        <ListRow
          title="Day score"
          sub="A daily read on how you’re doing. It only fills; quiet days aren’t counted against you."
          right={<Switch value={st.dayScoreEnabled} onValueChange={(on) => update({ dayScoreEnabled: on })} trackColor={{ true: p.accent }} />}
        />
        {st.planningEnabled ? (
          <>
            <Text className="font-body-semibold text-label text-muted">
              Open the app on
            </Text>
            <Segmented
              options={[
                { key: 'identities', label: 'Identities' },
                { key: 'today', label: 'Today' },
              ]}
              value={st.startTab}
              onChange={(v) => update({ startTab: v })}
            />
          </>
        ) : null}
        <Text className="font-body-semibold text-label text-muted">
          Alignment score
        </Text>
        <Segmented
          options={[
            { key: 'badge', label: 'Badge' },
            { key: 'bar', label: 'Bar' },
            { key: 'hidden', label: 'Hidden' },
          ]}
          value={st.scoreDisplay}
          onChange={(v) => update({ scoreDisplay: v })}
        />
      </Group>

      <Group title="Appearance">
        <Segmented
          options={[
            { key: 'system', label: 'System' },
            { key: 'light', label: 'Light' },
            { key: 'dark', label: 'Dark' },
          ]}
          value={st.appearance}
          onChange={(v) => update({ appearance: v })}
        />
      </Group>

      <Group title="Your data">
        {archived.length ? (
          archived.map((i) => (
            <ListRow
              key={i.id}
              title={i.name}
              sub="Archived · tap to restore"
              onPress={() => {
                identitiesRepo.archive(i.id, false);
                toast(`${i.name} is back on your dashboard`);
              }}
            />
          ))
        ) : (
          <ListRow title="Archived identities" right={<Text className="font-body-semibold text-label text-ink">0</Text>} />
        )}
        <ListRow title="Back up" sub="Save everything to one file you can keep in Files or iCloud Drive" onPress={() => shareBackup().catch(() => toast('Couldn’t create the backup'))} />
        <ListRow title="Restore from backup" sub="Replaces the data on this phone with a backup file" onPress={() => pickAndRestore().catch(() => toast('Couldn’t open that file'))} />
        <ListRow title="Export data" sub="Every entry, identity and metric as CSV, for spreadsheets" onPress={exportCsv} />
      </Group>

      <Group title="About">
        <ListRow
          title="How alignment works"
          sub="Weighted average of each metric’s progress toward its goal over the last 28 days. Progress caps at 100%. Skipped and paused days are left out. Systems never count directly."
        />
      </Group>

      {__DEV__ ? (
        <Group title="Developer">
          <ListRow
            title="Load demo data"
            sub="Replaces everything with Maya's sample identities"
            onPress={() =>
              Alert.alert('Load demo data?', 'This replaces all identities, metrics and entries.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Load', style: 'destructive', onPress: () => { seedDemo(); settingsRepo.update({ userName: 'Maya' }); loadSnapshot(); } },
              ])
            }
          />
          <ListRow
            title="Erase everything"
            onPress={() =>
              Alert.alert('Erase everything?', 'This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Erase', style: 'destructive', onPress: () => { clearAll(); loadSnapshot(); } },
              ])
            }
          />
        </Group>
      ) : null}
    </Screen>
  );
}
