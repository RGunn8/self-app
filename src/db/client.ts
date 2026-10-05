import { drizzle } from 'drizzle-orm/expo-sqlite';
import { addDatabaseChangeListener, openDatabaseSync } from 'expo-sqlite';

import { migrations } from './migrations';
import * as schema from './schema';

export const DB_NAME = 'identity.db';

export const sqlite = openDatabaseSync(DB_NAME, { enableChangeListener: true });
export const db = drizzle(sqlite, { schema });
export type DB = typeof db;

export async function migrate() {
  const row = await sqlite.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < migrations.length) {
    const sql = migrations[version];
    await sqlite.withExclusiveTransactionAsync(async (tx) => {
      await tx.execAsync(sql);
      await tx.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
    version++;
  }
}

/** Subscribe to any write. Used to re-run derived queries. */
export function onDatabaseChange(cb: () => void) {
  const sub = addDatabaseChangeListener(cb);
  return () => sub.remove();
}
