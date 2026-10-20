import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(), // always 'me'
  onboardedAt: integer('onboarded_at'),
  userName: text('user_name'),
  distanceUnit: text('distance_unit').$type<'mi' | 'km'>().notNull(),
  checkinEnabled: integer('checkin_enabled', { mode: 'boolean' }).notNull(),
  checkinDay: integer('checkin_day').notNull(), // 0 = Sunday
  checkinTime: text('checkin_time').notNull(), // HH:mm
  scoreDisplay: text('score_display').$type<'badge' | 'bar' | 'hidden'>().notNull(),
  appearance: text('appearance').$type<'system' | 'light' | 'dark'>().notNull(),
  /** Opt-in: notify at the times you planned. */
  planReminders: integer('plan_reminders', { mode: 'boolean' }).notNull(),
  /** Planning is optional. Off hides Today, plan prompts and reminders; plans are kept. */
  planningEnabled: integer('planning_enabled', { mode: 'boolean' }).notNull(),
  /** How many plans make a full day. Past it, Today suggests leaving room; it never blocks. */
  dayPlanLimit: integer('day_plan_limit').notNull(),
  /** A gentle daily read on how you're doing. Optional. */
  dayScoreEnabled: integer('day_score_enabled', { mode: 'boolean' }).notNull(),
  /** The tab the app opens on. */
  startTab: text('start_tab').$type<'identities' | 'today'>().notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export type Settings = typeof settings.$inferSelect;
