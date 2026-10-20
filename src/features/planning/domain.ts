import { activePause, type PauseRange } from '@/features/identities/domain';
import type { Plan, PlanKind, PlanStatus } from '@/features/planning/model';
import type { System, SystemCompletion, SystemIdentity } from '@/features/systems/model';
import { addDays, daysBetween, dayKey, parseDay, weekStart } from '@/shared/lib/dates';

export interface PlanData {
  plans: Plan[];
  systems: System[];
  systemIdentities: SystemIdentity[];
  completions: SystemCompletion[];
  identities: { id: string; name: string; accent: string; archivedAt: number | null }[];
  pauses: (PauseRange & { identityId: string })[];
}

export interface PlanItem {
  plan: Plan;
  kind: PlanKind;
  title: string;
  identityIds: string[];
  time: string | null;
  status: PlanStatus;
}

/** The range people can set for a full day; past it, Today gently suggests leaving room. */
export const DAY_LIMIT_MIN = 1;
export const DAY_LIMIT_MAX = 15;
const HISTORY_WEEKS = 12;
const MAX_REMINDERS = 60;

const systemIdentityIds = (data: Pick<PlanData, 'systemIdentities'>, systemId: string) =>
  data.systemIdentities.filter((l) => l.systemId === systemId).map((l) => l.identityId);

const doneOn = (data: Pick<PlanData, 'completions'>, systemId: string, day: string) =>
  data.completions.some((c) => c.systemId === systemId && c.date === day);

/**
 * A plan as it stands. A system session is done when its system was completed that day, so
 * undoing the completion puts the plan back; intentions carry their own status.
 */
export function planItem(plan: Plan, data: PlanData): PlanItem | null {
  if (plan.kind === 'system') {
    const system = data.systems.find((s) => s.id === plan.systemId);
    if (!system) return null;
    const status: PlanStatus = doneOn(data, system.id, plan.day) ? 'done' : plan.status === 'skipped' ? 'skipped' : 'planned';
    return { plan, kind: 'system', title: system.name, identityIds: systemIdentityIds(data, system.id), time: plan.time, status };
  }
  const identity = data.identities.find((i) => i.id === plan.identityId);
  if (!identity) return null;
  return { plan, kind: 'intention', title: plan.title ?? '', identityIds: [identity.id], time: plan.time, status: plan.status };
}

/** The day's plans: timed ones by time, then anytime ones in the order they were added. */
export function dayPlan(day: string, data: PlanData): PlanItem[] {
  return data.plans
    .filter((p) => p.day === day)
    .map((p) => planItem(p, data))
    .filter((x): x is PlanItem => x !== null)
    .sort((a, b) => {
      if (a.time && b.time) return a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
      if (a.time) return -1;
      if (b.time) return 1;
      return a.plan.position - b.plan.position || a.plan.createdAt - b.plan.createdAt;
    });
}

/** Monday-first weekday index, 0 = Monday. */
export const weekdayIndex = (day: string) => (parseDay(day).getDay() + 6) % 7;

/** How often each system was done on each weekday over the last 12 weeks before `before`. */
function weekdayHistory(completions: SystemCompletion[], before: string): Map<string, number[]> {
  const from = addDays(before, -7 * HISTORY_WEEKS);
  const out = new Map<string, number[]>();
  for (const c of completions) {
    if (c.date < from || c.date >= before) continue;
    const counts: number[] = out.get(c.systemId) ?? new Array(7).fill(0);
    counts[weekdayIndex(c.date)]++;
    out.set(c.systemId, counts);
  }
  return out;
}

/** The time a system is usually planned for, from its earlier plans. */
export function usualTime(plans: Plan[], systemId: string): string | null {
  const counts = new Map<string, number>();
  for (const p of plans) if (p.kind === 'system' && p.systemId === systemId && p.time) counts.set(p.time, (counts.get(p.time) ?? 0) + 1);
  let best: string | null = null;
  for (const [t, n] of counts) if (best === null || n > counts.get(best)!) best = t;
  return best;
}

/** A system is on hold when every identity it serves is paused or archived that day. */
function onHold(data: PlanData, systemId: string, day: string): boolean {
  const ids = systemIdentityIds(data, systemId);
  if (ids.length === 0) return true;
  return ids.every((id) => {
    const identity = data.identities.find((i) => i.id === id);
    if (!identity || identity.archivedAt !== null) return true;
    return !!activePause(
      data.pauses.filter((p) => p.identityId === id),
      day,
    );
  });
}

export interface Suggestion {
  system: System;
  identityIds: string[];
  /** Weekly systems: sessions still to place this week. */
  remaining: number | null;
  time: string | null;
}

/**
 * Sessions worth planning on `day`: daily systems not yet planned or done, and weekly systems
 * with sessions still to place this week. The ones you usually do on this weekday come first.
 */
export function suggestionsFor(day: string, data: PlanData): Suggestion[] {
  const wk = weekStart(day);
  const weekDays = new Set(daysBetween(wk, addDays(wk, 6)));
  const history = weekdayHistory(data.completions, wk);
  const dow = weekdayIndex(day);
  const out: (Suggestion & { score: number })[] = [];
  for (const system of data.systems) {
    if (system.frequency === 'asNeeded' || onHold(data, system.id, day)) continue;
    const mine = data.plans.filter((p) => p.kind === 'system' && p.systemId === system.id && p.status !== 'skipped');
    if (mine.some((p) => p.day === day) || doneOn(data, system.id, day)) continue;
    let remaining: number | null = null;
    if (system.frequency === 'weekly') {
      const doneDays = new Set(data.completions.filter((c) => c.systemId === system.id && weekDays.has(c.date)).map((c) => c.date));
      const plannedDays = new Set(mine.filter((p) => weekDays.has(p.day) && !doneDays.has(p.day)).map((p) => p.day));
      remaining = system.timesPerWeek - doneDays.size - plannedDays.size;
      if (remaining <= 0) continue;
    }
    const score = (system.frequency === 'daily' ? 100 : 0) + (history.get(system.id)?.[dow] ?? 0);
    out.push({ system, identityIds: systemIdentityIds(data, system.id), remaining, time: usualTime(data.plans, system.id), score });
  }
  return out.sort((a, b) => b.score - a.score).map(({ score: _, ...s }) => s);
}

/** Evenly spread weekdays for n sessions with no history: 3× → Mon, Wed, Fri; 5× → weekdays. */
export function spreadDays(n: number): number[] {
  if (n >= 7) return [0, 1, 2, 3, 4, 5, 6];
  if (n >= 5) return Array.from({ length: n }, (_, i) => i);
  return Array.from({ length: n }, (_, i) => Math.floor((i * 7) / n));
}

/**
 * Default days for each system in a week (Monday-first indexes). Daily systems get every day;
 * weekly ones get the weekdays you've most often done them on, topped up with an even spread.
 */
export function suggestWeek(systems: System[], completions: SystemCompletion[], weekStartKey: string): Map<string, number[]> {
  const history = weekdayHistory(completions, weekStartKey);
  const out = new Map<string, number[]>();
  for (const s of systems) {
    if (s.frequency === 'daily') out.set(s.id, [0, 1, 2, 3, 4, 5, 6]);
    if (s.frequency !== 'weekly') continue;
    const n = Math.min(7, Math.max(0, s.timesPerWeek));
    const counts: number[] = history.get(s.id) ?? new Array(7).fill(0);
    const usual = counts
      .map((c, i) => ({ c, i }))
      .filter((x) => x.c > 0)
      .sort((a, b) => b.c - a.c || a.i - b.i)
      .map((x) => x.i);
    const days = usual.slice(0, n);
    for (const d of spreadDays(n)) if (days.length < n && !days.includes(d)) days.push(d);
    for (let d = 0; days.length < n && d < 7; d++) if (!days.includes(d)) days.push(d);
    out.set(s.id, days.sort((a, b) => a - b));
  }
  return out;
}

/** Plans kept that week, up to `asOf`. A "not today" is a decision, so it isn't counted against you. */
export function plansKept(weekStartKey: string, asOf: string, data: PlanData): { kept: number; total: number } {
  let kept = 0;
  let total = 0;
  for (const day of daysBetween(weekStartKey, addDays(weekStartKey, 6))) {
    if (day > asOf) break;
    for (const item of dayPlan(day, data)) {
      if (item.status === 'skipped') continue;
      total++;
      if (item.status === 'done') kept++;
    }
  }
  return { kept, total };
}

/** The plans from yesterday that didn't happen; the only carry-over there is. */
export function fromYesterday(today: string, data: PlanData): PlanItem[] {
  return dayPlan(addDays(today, -1), data).filter((i) => i.status === 'planned');
}

export interface Reminder {
  planId: string;
  at: Date;
  title: string;
  body: string;
}

/** Timed, still-planned items in the next 7 days, soonest first, within the OS's pending limit. */
export function remindersToSchedule(data: PlanData, now: Date): Reminder[] {
  const start = dayKey(now);
  const names = new Map(data.identities.map((i) => [i.id, i.name]));
  const out: Reminder[] = [];
  for (const day of daysBetween(start, addDays(start, 7))) {
    for (const item of dayPlan(day, data)) {
      if (!item.time || item.status !== 'planned') continue;
      const [h, m] = item.time.split(':').map(Number);
      const at = parseDay(day);
      at.setHours(h, m, 0, 0);
      if (at.getTime() <= now.getTime()) continue;
      const who = item.identityIds.map((id) => names.get(id)).filter(Boolean);
      out.push({ planId: item.plan.id, at, title: item.title, body: who.length ? `For ${who.join(' and ')}` : 'Planned for now' });
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX_REMINDERS);
}

/** "7:00 AM" from "07:00". */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Prompts appear for people who planned within this many days; they fade if planning stops. */
export const ACTIVE_PLANNER_DAYS = 10;

export type PlanningPrompt = { kind: 'week'; weekStart: string; systems: number } | { kind: 'day' };

/**
 * Whether to invite planning on the home screen. Never a daily nudge for everyone:
 * - "Plan your week" on Sunday and Monday when the coming week has nothing planned yet.
 * - "Nothing planned today" only for people who made plans in the last 10 days.
 */
export function planningPrompt(day: string, data: PlanData): PlanningPrompt | null {
  const live = data.plans.filter((p) => planItem(p, data) !== null);
  const dow = parseDay(day).getDay();
  if (dow === 0 || dow === 1) {
    const ws = dow === 0 ? addDays(day, 1) : weekStart(day);
    const we = addDays(ws, 6);
    const plannable = data.systems.filter((s) => s.frequency !== 'asNeeded' && !onHold(data, s.id, day)).length;
    if (plannable > 0 && !live.some((p) => p.day >= ws && p.day <= we)) return { kind: 'week', weekStart: ws, systems: plannable };
  }
  if (live.some((p) => p.day === day)) return null;
  const since = addDays(day, -ACTIVE_PLANNER_DAYS);
  return live.some((p) => p.day >= since && p.day < day) ? { kind: 'day' } : null;
}
