import type { Aggregation, Direction, Period } from '@/db/schema';
import { addDays, dayKey, daysBetween } from '@/lib/dates';

export interface MetricDef {
  id: string;
  name: string;
  aggregation: Aggregation;
  unit: string;
  target: number;
  period: Period;
  direction: Direction;
}

export interface EntryPoint {
  metricId: string;
  value: number;
  /** Local day key (YYYY-MM-DD). */
  day: string;
}

export interface Window {
  from: string;
  to: string;
}

export const PERIOD_DAYS: Record<Period, number> = { day: 1, week: 7, month: 30 };
export const SCORE_WINDOW_DAYS = 28;

export function windowEnding(to: string, days: number): Window {
  return { from: addDays(to, -(days - 1)), to };
}

export function toEntryPoint(e: { metricId: string; value: number; loggedAt: number }): EntryPoint {
  return { metricId: e.metricId, value: e.value, day: dayKey(e.loggedAt) };
}

export function aggregate(values: number[], agg: Aggregation): number | null {
  if (agg === 'count') return values.length;
  if (agg === 'total') return values.reduce((a, b) => a + b, 0);
  if (values.length === 0) return null;
  if (agg === 'average') return values.reduce((a, b) => a + b, 0) / values.length;
  if (agg === 'max') return Math.max(...values);
  return Math.min(...values);
}

/** Additive aggregations scale with time; the others describe a typical value. */
const isAdditive = (agg: Aggregation) => agg === 'total' || agg === 'count';

/** Daily metrics: one value per logged day. Unlogged days are skipped, never zero. */
export function dailyValues(
  metric: MetricDef,
  entries: EntryPoint[],
  w: Window,
  excluded: Set<string> = new Set(),
): { day: string; value: number }[] {
  const byDay = new Map<string, number[]>();
  for (const e of entries) {
    if (e.metricId !== metric.id || e.day < w.from || e.day > w.to || excluded.has(e.day)) continue;
    const list = byDay.get(e.day) ?? [];
    list.push(e.value);
    byDay.set(e.day, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([day, vals]) => ({ day, value: aggregate(vals, metric.aggregation) ?? 0 }));
}

/**
 * The metric's typical value per its own period over a window, e.g. "12.6 mi / wk · 4-week avg".
 * Daily metrics average logged days only. Weekly/monthly additive metrics are scaled to one
 * period from the active (non-paused) days. Returns null when there is nothing to say.
 */
export function periodValue(
  metric: MetricDef,
  entries: EntryPoint[],
  w: Window,
  excluded: Set<string> = new Set(),
): number | null {
  if (metric.period === 'day') {
    const days = dailyValues(metric, entries, w, excluded);
    if (days.length === 0) return null;
    return days.reduce((a, d) => a + d.value, 0) / days.length;
  }
  const activeDays = daysBetween(w.from, w.to).filter((d) => !excluded.has(d)).length;
  if (activeDays === 0) return null;
  const vals = entries
    .filter((e) => e.metricId === metric.id && e.day >= w.from && e.day <= w.to && !excluded.has(e.day))
    .map((e) => e.value);
  const v = aggregate(vals, metric.aggregation);
  if (v === null) return null;
  return isAdditive(metric.aggregation) ? (v * PERIOD_DAYS[metric.period]) / activeDays : v;
}

/** 0..1, capped. "At most" turns the target into a limit. */
export function progress(value: number, target: number, direction: Direction): number {
  if (direction === 'atLeast') {
    if (target <= 0) return 1;
    return Math.max(0, Math.min(1, value / target));
  }
  if (value <= target) return 1;
  if (value <= 0) return 1;
  return Math.max(0, Math.min(1, target / value));
}

export type TrendStatus = 'improving' | 'steady' | 'below';

export interface Trend {
  current: number | null;
  previous: number | null;
  /** Fractional change, e.g. 0.18 for +18%. */
  change: number | null;
  status: TrendStatus;
}

const STEADY_BAND = 0.03;

export function trendFor(
  metric: MetricDef,
  entries: EntryPoint[],
  asOf: string,
  excluded: Set<string> = new Set(),
  days = SCORE_WINDOW_DAYS,
): Trend {
  const current = periodValue(metric, entries, windowEnding(asOf, days), excluded);
  const previous = periodValue(metric, entries, windowEnding(addDays(asOf, -days), days), excluded);
  if (current === null || previous === null || previous === 0) {
    return { current, previous, change: null, status: 'steady' };
  }
  const change = (current - previous) / Math.abs(previous);
  if (Math.abs(change) < STEADY_BAND) return { current, previous, change, status: 'steady' };
  const towardGoal = metric.direction === 'atLeast' ? change > 0 : change < 0;
  return { current, previous, change, status: towardGoal ? 'improving' : 'below' };
}

/** 12 weekly values ending at asOf, oldest first. null = no data that week. */
export function weeklySeries(
  metric: MetricDef,
  entries: EntryPoint[],
  asOf: string,
  weeks = 12,
  excluded: Set<string> = new Set(),
): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const w = windowEnding(addDays(asOf, -7 * i), 7);
    const hasData = entries.some((e) => e.metricId === metric.id && e.day >= w.from && e.day <= w.to);
    out.push(hasData || isAdditive(metric.aggregation) ? periodValue(metric, entries, w, excluded) : null);
  }
  return out;
}

export interface SeriesPoint {
  key: string;
  value: number | null;
}

export type RangeKey = '1M' | '3M' | '6M' | '1Y' | 'ALL';
export const RANGE_DAYS: Record<Exclude<RangeKey, 'ALL'>, number> = { '1M': 30, '3M': 91, '6M': 182, '1Y': 365 };

/**
 * Chart series. Daily metrics on 1M plot each day (null on skipped days so the line breaks);
 * everything else plots one point per week (its period value over that week).
 */
export function chartSeries(
  metric: MetricDef,
  entries: EntryPoint[],
  asOf: string,
  range: RangeKey,
  excluded: Set<string> = new Set(),
): SeriesPoint[] {
  const mine = entries.filter((e) => e.metricId === metric.id);
  let days: number;
  if (range === 'ALL') {
    const first = mine.reduce<string | null>((m, e) => (m === null || e.day < m ? e.day : m), null);
    if (!first) return [];
    days = Math.max(7, daysBetween(first, asOf).length);
  } else {
    days = RANGE_DAYS[range];
  }
  if (metric.period === 'day' && range === '1M') {
    const vals = new Map(dailyValues(metric, mine, windowEnding(asOf, days), excluded).map((d) => [d.day, d.value]));
    return daysBetween(addDays(asOf, -(days - 1)), asOf).map((key) => ({ key, value: vals.get(key) ?? null }));
  }
  const weeks = Math.ceil(days / 7);
  const series = weeklySeries(metric, mine, asOf, weeks, excluded);
  return series.map((value, i) => ({ key: addDays(asOf, -7 * (weeks - 1 - i)), value }));
}

/** Yearly averages of the period value, oldest first. The current year is year-to-date. */
export function yearlyAverages(
  metric: MetricDef,
  entries: EntryPoint[],
  asOf: string,
): { year: number; value: number; ytd: boolean }[] {
  const mine = entries.filter((e) => e.metricId === metric.id);
  if (mine.length === 0) return [];
  const first = mine.reduce((m, e) => (e.day < m ? e.day : m), mine[0].day);
  const firstYear = Number(first.slice(0, 4));
  const lastYear = Number(asOf.slice(0, 4));
  const out: { year: number; value: number; ytd: boolean }[] = [];
  for (let y = firstYear; y <= lastYear; y++) {
    const from = y === firstYear ? first : `${y}-01-01`;
    const to = y === lastYear ? asOf : `${y}-12-31`;
    const v = periodValue(metric, mine, { from, to });
    if (v !== null) out.push({ year: y, value: v, ytd: y === lastYear });
  }
  return out;
}

export function periodLabel(metric: Pick<MetricDef, 'period' | 'unit'>): string {
  const per = metric.period === 'day' ? 'day' : metric.period === 'week' ? 'wk' : 'mo';
  return `${metric.unit} / ${per}`;
}

export function formatValue(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '–';
  const abs = Math.abs(v);
  if (abs >= 1000) return Math.round(v).toLocaleString('en-US');
  if (abs >= 100) return String(Math.round(v));
  return (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, abs >= 10 ? '' : '.0');
}

export function formatChange(change: number | null): string {
  if (change === null) return '→ steady';
  const pct = Math.round(Math.abs(change) * 100);
  if (pct < 3) return '→ steady';
  return `${change > 0 ? '↑' : '↓'} ${pct}%`;
}

export const STATUS_LABEL: Record<TrendStatus, string> = {
  improving: 'Improving',
  steady: 'Steady',
  below: 'A little below usual',
};
