/// <reference types="jest" />
import { APP_ID, buildBackup, parseBackup, SCHEMA_VERSION } from '@/shared/db/backup';

jest.mock('@/shared/db/migrations', () => ({ migrations: ['one', 'two'] }));

const identity = (id: string, deleted: number | null = null) => ({ id, name: id, created_at: 1, updated_at: 1, deleted_at: deleted });

describe('backup', () => {
  it('round-trips through JSON and counts live rows', () => {
    const b = buildBackup({ identities: [identity('a'), identity('b', 5)], entries: [{ id: 'e', deleted_at: null }] }, 100);
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed).toMatchObject({ ok: true, counts: { identities: 1, entries: 1 } });
    expect(b).toMatchObject({ app: APP_ID, schema: SCHEMA_VERSION, exportedAt: 100 });
  });

  it('rejects files that aren’t backups', () => {
    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ hello: 'world' })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ app: 'other', schema: 1, exportedAt: 1, tables: {} })).ok).toBe(false);
  });

  it('rejects unknown tables and unsafe column names', () => {
    const base = { app: APP_ID, schema: 1, exportedAt: 1 };
    expect(parseBackup(JSON.stringify({ ...base, tables: { users: [] } })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...base, tables: { entries: [{ 'id); DROP TABLE x;--': 1 }] } })).ok).toBe(false);
  });

  it('refuses a backup from a newer schema', () => {
    const r = parseBackup(JSON.stringify({ app: APP_ID, schema: SCHEMA_VERSION + 1, exportedAt: 1, tables: {} }));
    expect(r).toMatchObject({ ok: false });
  });

  it('accepts an older schema', () => {
    expect(parseBackup(JSON.stringify({ app: APP_ID, schema: 1, exportedAt: 1, tables: { identities: [identity('a')] } })).ok).toBe(true);
  });
});

describe('backup tables', () => {
  it('include plans', () => {
    const { BACKUP_TABLES } = jest.requireActual('@/shared/db/backup');
    expect(BACKUP_TABLES).toContain('plans');
  });
});
