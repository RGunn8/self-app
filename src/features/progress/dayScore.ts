// The day score: a gentle daily read, never a grade. It only fills, quiet days aren't failures,
// and it compares you with your own usual day rather than a fixed standard.
import { activePause } from '@/features/identities/domain';
import type { LogData } from '@/features/logging/domain';
import { dayPlan, type PlanData } from '@/features/planning/domain';
import { voteEntries } from '@/features/progress/domain';
import { addDays, daysBetween } from '@/shared/lib/dates';

export type DayData = LogData & PlanData;

export type DayBand = 'started' | 'steady' | 'strong' | 'full';

export const BAND_LABEL: Record<DayBand, string> = {
  started: 'Getting started',
  steady: 'Steady',
  strong: 'Strong',
  full: 'Full',
};

export interface DayScore {
  /** rest: nothing planned or done · paused: every identity paused · quiet: planned, nothing done yet. */
  state: 'rest' | 'paused' | 'quiet' | 'scored';
  /** 0..1 */
  fill: number;
  band: DayBand | null;
  kept: number;
  planned: number;
  extras: number;
  votes: number;
  usual: number;
}

const USUAL_WINDOW = 28;
const NO_HISTORY_USUAL = 2;
const FLOOR = 0.25;

/** Votes per day, by the same rule as votesFor: acting (not limits), once per metric a day; plus completions and intentions. */
export function votesByDay(data: Pick<LogData, 'entries' | 'metrics' | 'completions' | 'plans'>): Map<string, number> {
  const out = new Map<string, number>();
  const add = (day: string) => out.set(day, (out.get(day) ?? 0) + 1);
  for (const key of voteEntries(data)) add(key.slice(key.indexOf(':') + 1));
  for (const c of data.completions) add(c.date);
  for (const p of data.plans ?? []) if (p.kind === 'intention' && p.status === 'done' && p.entryId === null) add(p.day);
  return out;
}

/** Your usual day: the median of your active days over the four weeks before. */
export function usualDay(day: string, votes: Map<string, number>): number {
  const active = daysBetween(addDays(day, -USUAL_WINDOW), addDays(day, -1))
    .map((d) => votes.get(d) ?? 0)
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  if (active.length === 0) return NO_HISTORY_USUAL;
  const mid = Math.floor(active.length / 2);
  const median = active.length % 2 ? active[mid] : (active[mid - 1] + active[mid]) / 2;
  return Math.max(1, median);
}

export function bandOf(fill: number): DayBand {
  if (fill >= 1) return 'full';
  if (fill >= 0.67) return 'strong';
  if (fill >= 0.34) return 'steady';
  return 'started';
}

const pausedOn = (data: PlanData, identityId: string, day: string) =>
  !!activePause(
    data.pauses.filter((p) => p.identityId === identityId),
    day,
  );

/**
 * How the day is going. On planned days it's mostly plans kept, topped up by anything extra;
 * otherwise it's measured against your usual day. "Not today" and paused identities don't count.
 */
export function dayScore(day: string, data: DayData, planning: boolean, votes = votesByDay(data)): DayScore {
  const live = data.identities.filter((i) => i.archivedAt === null);
  const usual = usualDay(day, votes);
  const base = { kept: 0, planned: 0, extras: 0, votes: 0, usual, fill: 0, band: null };
  if (live.length > 0 && live.every((i) => pausedOn(data, i.id, day))) return { ...base, state: 'paused' };

  const items = planning
    ? dayPlan(day, data).filter((i) => i.status !== 'skipped' && !i.identityIds.every((id) => pausedOn(data, id, day)))
    : [];
  const planned = items.length;
  const kept = items.filter((i) => i.status === 'done').length;
  const v = votes.get(day) ?? 0;
  const extras = Math.max(0, v - kept);
  const counts = { kept, planned, extras, votes: v, usual };

  if (planned === 0 && v === 0) return { ...base, ...counts, state: 'rest' };
  if (v === 0 && kept === 0) return { ...base, ...counts, state: 'quiet' };

  let fill = planned > 0 ? kept / planned + (0.5 * extras) / Math.max(planned, usual) : v / usual;
  fill = Math.min(1, Math.max(FLOOR, fill));
  return { ...counts, state: 'scored', fill, band: bandOf(fill) };
}

/** The week's Strong and Full days, up to `asOf`. Never averages, never the low days. */
export function fullestDays(weekStartKey: string, asOf: string, data: DayData, planning: boolean): string[] {
  const votes = votesByDay(data);
  return daysBetween(weekStartKey, addDays(weekStartKey, 6)).filter((d) => {
    if (d > asOf) return false;
    const s = dayScore(d, data, planning, votes);
    return s.band === 'strong' || s.band === 'full';
  });
}
