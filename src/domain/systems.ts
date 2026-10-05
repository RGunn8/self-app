import type { Frequency } from '@/db/schema';
import { addDays, daysBetween } from '@/lib/dates';

export type HealthTag = 'onTrack' | 'slipping' | 'reset' | 'asNeeded';

export const HEALTH_LABEL: Record<HealthTag, string> = {
  onTrack: 'On track',
  slipping: 'Slipping',
  reset: 'Needs a reset',
  asNeeded: 'As needed',
};

export interface Adherence {
  tag: HealthTag;
  completed: number;
  /** null for as-needed systems, which show a count only. */
  expected: number | null;
  /** 28 booleans, oldest first, for the 7 × 4 dot grid. */
  days: { day: string; done: boolean }[];
}

export function expectedIn28(frequency: Frequency, timesPerWeek: number): number | null {
  if (frequency === 'daily') return 28;
  if (frequency === 'weekly') return timesPerWeek * 4;
  return null;
}

/**
 * Completions over the last 28 days vs. what the cadence expects.
 * ≥75% On track, ≥45% Slipping, else Needs a reset. No streaks, by design.
 */
export function adherence(
  system: { frequency: Frequency; timesPerWeek: number },
  completionDays: string[],
  asOf: string,
): Adherence {
  const from = addDays(asOf, -27);
  const doneSet = new Set(completionDays.filter((d) => d >= from && d <= asOf));
  const days = daysBetween(from, asOf).map((day) => ({ day, done: doneSet.has(day) }));
  const completed = doneSet.size;
  const expected = expectedIn28(system.frequency, system.timesPerWeek);
  if (expected === null) return { tag: 'asNeeded', completed, expected, days };
  const ratio = completed / expected;
  const tag: HealthTag = ratio >= 0.75 ? 'onTrack' : ratio >= 0.45 ? 'slipping' : 'reset';
  return { tag, completed, expected, days };
}

export function cadenceLabel(frequency: Frequency, timesPerWeek: number): string {
  if (frequency === 'daily') return 'Daily';
  if (frequency === 'asNeeded') return 'As needed';
  return `${timesPerWeek}× a week`;
}

/** "This week 0 of 2" style status for weekly systems. */
export function weekProgress(completionDays: string[], weekStartKey: string, asOf: string): number {
  return completionDays.filter((d) => d >= weekStartKey && d <= asOf).length;
}
