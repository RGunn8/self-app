// Back up to a JSON file and restore from one. Restoring replaces everything, after saving a
// copy of the current data so a wrong file can't lose anything.
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

import { scheduleWeeklyCheckin } from '@/features/week/notifications';
import { toast } from '@/shared/components/toast';
import { type Backup, BACKUP_TABLES, buildBackup, parseBackup, type Row } from '@/shared/db/backup';
import { sqlite } from '@/shared/db/client';
import { dayKey } from '@/shared/lib/dates';
import { loadSnapshot } from '@/shared/store/data';

function readAll(): Backup {
  const tables: Record<string, Row[]> = {};
  for (const t of BACKUP_TABLES) tables[t] = sqlite.getAllSync<Row>(`SELECT * FROM ${t}`);
  return buildBackup(tables);
}

function writeFile(dir: typeof Paths.cache, name: string, backup: Backup): File {
  const file = new File(dir, name);
  file.create({ overwrite: true });
  file.write(JSON.stringify(backup));
  return file;
}

export async function shareBackup() {
  const file = writeFile(Paths.cache, `identity-dashboard-backup-${dayKey(Date.now())}.json`, readAll());
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json' });
}

function replaceAll(backup: Backup) {
  sqlite.withTransactionSync(() => {
    for (const t of BACKUP_TABLES) sqlite.runSync(`DELETE FROM ${t}`);
    for (const t of BACKUP_TABLES) {
      for (const row of backup.tables[t] ?? []) {
        const cols = Object.keys(row);
        if (cols.length === 0) continue;
        sqlite.runSync(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, cols.map((c) => row[c]));
      }
    }
  });
}

export async function pickAndRestore() {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'public.json', '*/*'] });
  if (picked.canceled) return;
  const result = parseBackup(await picked.result.text());
  if (!result.ok) {
    Alert.alert('Can’t restore', result.reason);
    return;
  }
  const { backup, counts } = result;
  Alert.alert(
    'Replace all data?',
    `This backup from ${new Date(backup.exportedAt).toLocaleDateString()} has ${counts.identities} identities and ${counts.entries} entries. ` +
      'Everything on this phone is replaced. A copy of your current data is saved first.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Replace',
        style: 'destructive',
        onPress: () => {
          try {
            writeFile(Paths.document, `before-restore-${Date.now()}.json`, readAll());
            replaceAll(backup);
          } catch {
            Alert.alert('Restore failed', 'Nothing was changed.');
            return;
          }
          loadSnapshot();
          scheduleWeeklyCheckin().catch(() => {});
          toast('Backup restored');
        },
      },
    ],
  );
}
