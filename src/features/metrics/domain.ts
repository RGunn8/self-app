import type { Aggregation, Direction, Period } from '@/features/metrics/model';
import { addDays, addMonths, dayKey, daysBetween, monthEnd, monthStart, weekStart } from '@/shared/lib/dates';

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
  /** First day of the bar's bucket. */
  key: string;
  /** Last day of the bar's bucket. */
  to: string;
  value: number | null;
}

export type ChartPeriod = 'W' | 'M' | '3M' | 'All';
/** The periods drawn as a line; 'All' is a calendar. */
export type LinePeriod = Exclude<ChartPeriod, 'All'>;
export type Bucket = 'day' | 'week';

export const CHART_PERIODS: { key: ChartPeriod; label: string }[] = [
  { key: 'W', label: 'W' },
  { key: 'M', label: 'M' },
  { key: '3M', label: '3M' },
  { key: 'All', label: 'All' },
];

const BUCKET_OF: Record<LinePeriod, Bucket> = { W: 'day', M: 'day', '3M': 'week' };

/** First day of the goal period that contains `day`. */
export function periodStart(period: Period, day: string): string {
  if (period === 'week') return weekStart(day);
  if (period === 'month') return monthStart(day);
  return day;
}

/**
 * The calendar window a chart period covers, `offset` whole windows before the current one.
 * W is a Mon–Sun week, M a calendar month, 3M is 13 Monday weeks.
 */
export function chartWindow(period: LinePeriod, asOf: string, offset = 0): Window & { buckets: Window[] } {
  if (period === 'W') {
    const from = addDays(weekStart(asOf), -7 * offset);
    const to = addDays(from, 6);
    return { from, to, buckets: daysBetween(from, to).map((d) => ({ from: d, to: d })) };
  }
  if (period === 'M') {
    const from = addMonths(asOf, -offset);
    const to = monthEnd(from);
    return { from, to, buckets: daysBetween(from, to).map((d) => ({ from: d, to: d })) };
  }
  const weeks = 13;
  const lastWeek = addDays(weekStart(asOf), -7 * weeks * offset);
  const buckets = Array.from({ length: weeks }, (_, i) => {
    const from = addDays(lastWeek, -7 * (weeks - 1 - i));
    return { from, to: addDays(from, 6) };
  });
  return { from: buckets[0].from, to: buckets[weeks - 1].to, buckets };
}

export interface ChartSeries {
  points: SeriesPoint[];
  bucket: Bucket;
  from: string;
  to: string;
  /**
   * Set when the goal spans more than one point (a monthly total on daily points): each point
   * is then the running total since the start of its goal period, measured against the full goal.
   */
  cumulative: Period | null;
  /** Whether the metric has entries before this window. */
  hasEarlier: boolean;
}

/**
 * One point per bucket, ending at asOf (later points are null).
 * - Additive, goal period = bucket: the bucket's total.
 * - Additive, goal period longer than the bucket: running total since the goal period started.
 * - Additive, goal period shorter (a daily goal on weekly points): the per-day value over the week.
 * - Non-additive: the aggregation over the bucket's daily values; null when nothing was logged.
 */
export function chartSeries(
  metric: MetricDef,
  entries: EntryPoint[],
  period: LinePeriod,
  asOf: string,
  offset = 0,
  excluded: Set<string> = new Set(),
): ChartSeries {
  const bucket = BUCKET_OF[period];
  const w = chartWindow(period, asOf, offset);
  const mine = entries.filter((e) => e.metricId === metric.id);
  const additive = isAdditive(metric.aggregation);
  const cumulative = additive && PERIOD_DAYS[metric.period] > PERIOD_DAYS[bucket] ? metric.period : null;
  const sum = (from: string, to: string) =>
    aggregate(
      mine.filter((e) => e.day >= from && e.day <= to && !excluded.has(e.day)).map((e) => e.value),
      metric.aggregation,
    );
  const points = w.buckets.map((b): SeriesPoint => {
    if (b.from > asOf) return { key: b.from, to: b.to, value: null };
    const end = b.to < asOf ? b.to : asOf;
    let value: number | null;
    if (cumulative) value = sum(periodStart(cumulative, end), end);
    else if (additive && PERIOD_DAYS[metric.period] === PERIOD_DAYS[bucket]) value = sum(b.from, end);
    else if (additive) value = periodValue(metric, mine, { from: b.from, to: end }, excluded);
    else value = aggregate(dailyValues(metric, mine, { from: b.from, to: end }, excluded).map((d) => d.value), metric.aggregation);
    return { key: b.from, to: b.to, value };
  });
  const hasEarlier = mine.some((e) => e.day < w.from);
  return { points, bucket, from: w.from, to: w.to, cumulative, hasEarlier };
}

export interface CalendarMonth {
  /** First day of the month. */
  key: string;
  /** Every day of the month; value is null when nothing was logged (or the day is still ahead). */
  days: { day: string; value: number | null }[];
  /** The month's total for additive metrics, otherwise the aggregation over its days. */
  value: number | null;
}

/** Every month from the first entry to asOf, newest first, plus the largest day value for shading. */
export function calendarMonths(
  metric: MetricDef,
  entries: EntryPoint[],
  asOf: string,
  excluded: Set<string> = new Set(),
): { months: CalendarMonth[]; max: number } {
  const mine = entries.filter((e) => e.metricId === metric.id);
  if (mine.length === 0) return { months: [], max: 0 };
  const first = mine.reduce((m, e) => (e.day < m ? e.day : m), mine[0].day);
  const daily = new Map(dailyValues(metric, mine, { from: first, to: asOf }, excluded).map((d) => [d.day, d.value]));
  const months: CalendarMonth[] = [];
  for (let key = monthStart(asOf); key >= monthStart(first); key = addMonths(key, -1)) {
    const days = daysBetween(key, monthEnd(key)).map((day) => ({ day, value: daily.get(day) ?? null }));
    const logged = days.flatMap((d) => (d.value === null ? [] : [d.value]));
    const value = isAdditive(metric.aggregation)
      ? aggregate(mine.filter((e) => e.day >= key && e.day <= monthEnd(key) && !excluded.has(e.day)).map((e) => e.value), metric.aggregation)
      : aggregate(logged, metric.aggregation);
    months.push({ key, days, value });
  }
  return { months, max: Math.max(0, ...daily.values()) };
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
