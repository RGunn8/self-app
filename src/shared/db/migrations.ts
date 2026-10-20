// Ordered schema migrations, applied by PRAGMA user_version. Append only; never edit a shipped entry.
// Keep in step with schema.ts.
const base = `id TEXT PRIMARY KEY NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, deleted_at INTEGER`;

export const migrations: string[] = [
  `
  CREATE TABLE identities (${base}, name TEXT NOT NULL, description TEXT, priority TEXT NOT NULL,
    marker TEXT NOT NULL, accent TEXT NOT NULL, archived_at INTEGER);
  CREATE TABLE identity_priority_history (${base}, identity_id TEXT NOT NULL, priority TEXT NOT NULL, from_date TEXT NOT NULL);
  CREATE TABLE pauses (${base}, identity_id TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT, reason TEXT);
  CREATE TABLE metrics (${base}, name TEXT NOT NULL, aggregation TEXT NOT NULL, unit TEXT NOT NULL, target REAL NOT NULL,
    period TEXT NOT NULL, direction TEXT NOT NULL, source TEXT NOT NULL, default_amount REAL NOT NULL, step REAL NOT NULL);
  CREATE TABLE identity_metrics (${base}, identity_id TEXT NOT NULL, metric_id TEXT NOT NULL, weight INTEGER NOT NULL);
  CREATE TABLE entries (${base}, metric_id TEXT NOT NULL, value REAL NOT NULL, logged_at INTEGER NOT NULL,
    source TEXT NOT NULL, system_completion_id TEXT);
  CREATE TABLE systems (${base}, name TEXT NOT NULL, description TEXT, cue TEXT NOT NULL, frequency TEXT NOT NULL,
    times_per_week INTEGER NOT NULL);
  CREATE TABLE system_steps (${base}, system_id TEXT NOT NULL, name TEXT NOT NULL, position INTEGER NOT NULL, metric_id TEXT);
  CREATE TABLE system_identities (${base}, system_id TEXT NOT NULL, identity_id TEXT NOT NULL);
  CREATE TABLE system_completions (${base}, system_id TEXT NOT NULL, date TEXT NOT NULL);
  CREATE TABLE settings (id TEXT PRIMARY KEY NOT NULL, onboarded_at INTEGER, user_name TEXT,
    distance_unit TEXT NOT NULL, checkin_enabled INTEGER NOT NULL, checkin_day INTEGER NOT NULL,
    checkin_time TEXT NOT NULL, score_display TEXT NOT NULL, appearance TEXT NOT NULL, updated_at INTEGER NOT NULL);
  CREATE INDEX entries_metric_logged ON entries (metric_id, logged_at);
  CREATE INDEX identity_metrics_identity ON identity_metrics (identity_id);
  CREATE INDEX identity_metrics_metric ON identity_metrics (metric_id);
  CREATE INDEX system_completions_system ON system_completions (system_id, date);
  `,
  // 2: Restart an identity. Identity-level numbers count from this day; history is kept.
  `ALTER TABLE identities ADD COLUMN restarted_at TEXT;`,
  // 3: Planning. Plans expire with their day; reminders are opt-in.
  `
  CREATE TABLE plans (${base}, day TEXT NOT NULL, time TEXT, kind TEXT NOT NULL, system_id TEXT, identity_id TEXT,
    title TEXT, metric_id TEXT, amount REAL, status TEXT NOT NULL, entry_id TEXT, position INTEGER NOT NULL);
  CREATE INDEX plans_day ON plans (day);
  ALTER TABLE settings ADD COLUMN plan_reminders INTEGER NOT NULL DEFAULT 0;
  `,
  // 4: Which tab the app opens on. Identities by default; planners can start on Today.
  `ALTER TABLE settings ADD COLUMN start_tab TEXT NOT NULL DEFAULT 'identities';`,
  // 5: Planning is optional. Off hides Today, prompts and reminders; plans are kept.
  `ALTER TABLE settings ADD COLUMN planning_enabled INTEGER NOT NULL DEFAULT 1;`,
  // 6: How many plans make a full day. Past it, a gentle hint; never a block.
  `ALTER TABLE settings ADD COLUMN day_plan_limit INTEGER NOT NULL DEFAULT 6;`,
  // 7: The optional day score. Off for existing users; asked during onboarding.
  `ALTER TABLE settings ADD COLUMN day_score_enabled INTEGER NOT NULL DEFAULT 0;`,
];
