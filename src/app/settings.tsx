import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Alert, Switch, View } from 'react-native';

import { CheckinSchedule } from '@/components/checkin';
import { toast } from '@/components/overlay';
import { HeaderAction, ListRow, NavHeader, Overline, Screen, Segmented, T } from '@/components/ui';
import { clearAll, seedDemo } from '@/db/seed';
import { dayKey } from '@/lib/dates';
import { requestCheckinPermission, scheduleWeeklyCheckin } from '@/lib/notifications';
import { settingsRepo, identitiesRepo } from '@/repos';
import { loadSnapshot, useData } from '@/stores/data';
import { space, useTheme } from '@/theme';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.sm }}>
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
      <T v="displayLg">Settings</T>

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

      <Group title="Dashboard">
        <T v="label" muted>
          Alignment score
        </T>
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
          <ListRow title="Archived identities" right={<T v="label">0</T>} />
        )}
        <ListRow title="Export data" sub="Every entry, identity and metric as CSV" onPress={exportCsv} />
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
