import type { Weight } from '@/features/metrics/model';
import { addDays, diffDays } from '@/shared/lib/dates';
import {
  type EntryPoint,
  type MetricDef,
  periodValue,
  progress,
  SCORE_WINDOW_DAYS,
  windowEnding,
} from '@/features/metrics/domain';

export const WEIGHT_VALUES: Weight[] = [1, 2, 4];
export const WEIGHT_LABEL: Record<Weight, string> = { 1: 'Low', 2: 'Normal', 4: 'High' };
export const BASELINE_DAYS = 7;

export interface PauseRange {
  startDate: string;
  endDate: string | null;
}

export interface BreakdownRow {
  metricId: string;
  name: string;
  weight: Weight;
  /** 0..100 */
  score: number;
  /** Contribution; the rows add up to the alignment score. */
  pts: number;
}

export type Alignment =
  | { status: 'scored'; score: number; breakdown: BreakdownRow[] }
  | { status: 'baseline'; daysToGo: number }
  | { status: 'paused' }
  | { status: 'empty' };

export function pausedDays(pauses: PauseRange[], from: string, to: string): Set<string> {
  const out = new Set<string>();
  for (const p of pauses) {
    const start = p.startDate > from ? p.startDate : from;
    const end = p.endDate === null || p.endDate > to ? to : p.endDate;
    for (let k = start; k <= end; k = addDays(k, 1)) out.add(k);
  }
  return out;
}

export function activePause<P extends PauseRange>(pauses: P[], day: string): P | undefined {
  return pauses.find((p) => p.startDate <= day && (p.endDate === null || p.endDate >= day));
}

/** Largest-remainder rounding so integer parts add up to round(sum). */
function apportion(values: number[]): number[] {
  const total = Math.round(values.reduce((a, b) => a + b, 0));
  const floors = values.map(Math.floor);
  let rest = total - floors.reduce((a, b) => a + b, 0);
  const order = values.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (rest <= 0) break;
    floors[i]++;
    rest--;
  }
  return floors;
}

/**
 * Weighted average of each metric's progress toward its goal over the last 28 days.
 * Progress caps at 100%. Daily metrics count logged days only. Paused days are left out.
 * Alignment is always derived, never stored.
 */
export function alignment(
  links: { metric: MetricDef; weight: Weight }[],
  entries: EntryPoint[],
  pauses: PauseRange[],
  asOf: string,
): Alignment {
  const w = windowEnding(asOf, SCORE_WINDOW_DAYS);
  if (activePause(pauses, asOf)) return { status: 'paused' };
  if (links.length === 0) return { status: 'empty' };

  const ids = new Set(links.map((l) => l.metric.id));
  const mine = entries.filter((e) => ids.has(e.metricId) && e.day <= asOf);
  if (mine.length === 0) return { status: 'empty' };
  const first = mine.reduce((m, e) => (e.day < m ? e.day : m), mine[0].day);
  const span = diffDays(asOf, first) + 1;
  if (span < BASELINE_DAYS) return { status: 'baseline', daysToGo: BASELINE_DAYS - span };

  const excluded = pausedDays(pauses, w.from, w.to);
  const scored = links
    .map(({ metric, weight }) => {
      const v = periodValue(metric, mine, w, excluded);
      return v === null ? null : { metric, weight, p: progress(v, metric.target, metric.direction) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  if (scored.length === 0) return { status: 'empty' };

  const totalW = scored.reduce((a, s) => a + s.weight, 0);
  const pts = apportion(scored.map((s) => ((s.weight * s.p) / totalW) * 100));
  const breakdown = scored.map((s, i) => ({
    metricId: s.metric.id,
    name: s.metric.name,
    weight: s.weight,
    score: Math.round(s.p * 100),
    pts: pts[i],
  }));
  return { status: 'scored', score: pts.reduce((a, b) => a + b, 0), breakdown };
}

/** Entries an identity counts after a restart: everything from `since` on (all of them when null). */
export function sinceRestart<E extends { day: string }>(entries: E[], since: string | null | undefined): E[] {
  return since ? entries.filter((e) => e.day >= since) : entries;
}

export function scoreOf(a: Alignment): number | null {
  return a.status === 'scored' ? a.score : null;
}

/** Alignment now vs. the previous 28 days, in percentage points. */
export function alignmentDelta(
  links: { metric: MetricDef; weight: Weight }[],
  entries: EntryPoint[],
  pauses: PauseRange[],
  asOf: string,
  days = SCORE_WINDOW_DAYS,
): { now: Alignment; before: Alignment; delta: number | null } {
  const now = alignment(links, entries, pauses, asOf);
  const before = alignment(links, entries, pauses, addDays(asOf, -days));
  const a = scoreOf(now);
  const b = scoreOf(before);
  return { now, before, delta: a !== null && b !== null ? a - b : null };
}

export function formatDelta(delta: number | null): string {
  if (delta === null || Math.abs(delta) < 1) return '→ steady';
  return `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)}%`;
}
