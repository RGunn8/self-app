// Full backup and restore as one JSON file: every row of every table, soft-deleted rows included,
// so a restore is an exact copy. Raw column names keep it independent of the TypeScript models.
import { z } from 'zod';

import { migrations } from '@/shared/db/migrations';

export const APP_ID = 'identity-dashboard';

/** Every table that holds user data, in an order that restores cleanly. */
export const DATA_TABLES = [
  'identities',
  'identity_priority_history',
  'pauses',
  'metrics',
  'identity_metrics',
  'entries',
  'systems',
  'system_steps',
  'system_identities',
  'system_completions',
  'plans',
] as const;
export const BACKUP_TABLES = [...DATA_TABLES, 'settings'] as const;

/** The schema version this build writes and reads (PRAGMA user_version after migrating). */
export const SCHEMA_VERSION = migrations.length;

type Cell = string | number | null;
export type Row = Record<string, Cell>;

export interface Backup {
  app: typeof APP_ID;
  schema: number;
  exportedAt: number;
  tables: Record<string, Row[]>;
}

const cell = z.union([z.string(), z.number(), z.null()]);
const column = z.string().regex(/^[a-z_]+$/);
const backupSchema = z.object({
  app: z.literal(APP_ID),
  schema: z.number().int().positive(),
  exportedAt: z.number(),
  tables: z.partialRecord(z.enum(BACKUP_TABLES), z.array(z.record(column, cell))),
});

export function buildBackup(tables: Record<string, Row[]>, now = Date.now()): Backup {
  return { app: APP_ID, schema: SCHEMA_VERSION, exportedAt: now, tables };
}

export type ParsedBackup = { ok: true; backup: Backup; counts: { identities: number; entries: number } } | { ok: false; reason: string };

/** Check a backup file before anything is replaced. Newer backups need a newer app. */
export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'That file isn’t a backup from this app.' };
  }
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) return { ok: false, reason: 'That file isn’t a backup from this app, or it’s damaged.' };
  const backup = parsed.data as Backup;
  if (backup.schema > SCHEMA_VERSION) return { ok: false, reason: 'This backup is from a newer version of the app. Update the app, then restore.' };
  const live = (t: string) => (backup.tables[t] ?? []).filter((r) => r.deleted_at === null || r.deleted_at === undefined).length;
  return { ok: true, backup, counts: { identities: live('identities'), entries: live('entries') } };
}
