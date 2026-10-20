import { alignment, pausedDays, scoreOf, sinceRestart } from '@/features/identities/domain';
import type { IdentityInput } from '@/features/insights/domain';
import { aggregate, dailyValues, type EntryPoint, formatAmount, formatValue, type MetricDef, periodStart, periodValue, windowEnding } from '@/features/metrics/domain';
import { addDays, daysBetween, fmt, parseDay } from '@/shared/lib/dates';

export interface WeekIdentityRow {
  identityId: string;
  name: string;
  summary: string;
  change: number | null;
  score: number | null;
}

export interface DayWin {
  day: string;
  /** The identity the win is shown under: the first one the metric supports. */
  identityId: string;
  metricId: string;
  kind: 'daily' | 'period' | 'best';
  text: string;
}

export interface WeekReview {
  weekStart: string;
  weekEnd: string;
  rows: WeekIdentityRow[];
  standout: string | null;
  skipped: { metric: string; days: number }[];
  /** Every win that week, oldest first. Daily goals are celebrated here, not with a card each day. */
  wins: DayWin[];
}


function weekValueText(metric: MetricDef, entries: EntryPoint[], from: string, to: string): string | null {
  const v = periodValue({ ...metric, period: metric.period === 'day' ? 'day' : 'week' }, entries, { from, to });
  if (v === null) return null;
  return `${formatAmount(v, metric.unit)}`;
}

/** The week vs. the usual four weeks before it, one highlight, and skipped days. */
export function weekReview(identities: IdentityInput[], entries: EntryPoint[], weekStartKey: string): WeekReview {
  const weekEnd = addDays(weekStartKey, 6);
  const rows: WeekIdentityRow[] = identities.map((i) => {
    const headline = [...i.links].sort((a, b) => b.weight - a.weight)[0]?.metric;
    const parts = [...i.links]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 2)
      .map((l) => weekValueText(l.metric, entries, weekStartKey, weekEnd))
      .filter((s): s is string => s !== null);
    let change: number | null = null;
    if (headline) {
      const cur = periodValue(headline, entries, { from: weekStartKey, to: weekEnd });
      const prev = periodValue(headline, entries, windowEnding(addDays(weekStartKey, -1), 28));
      if (cur !== null && prev !== null && prev !== 0) change = (cur - prev) / Math.abs(prev);
    }
    return {
      identityId: i.id,
      name: i.name,
      summary: parts.join(' · ') || 'Nothing logged',
      change,
      score: scoreOf(alignment(i.links, sinceRestart(entries, i.since), i.pauses, weekEnd)),
    };
  });

  // Highlight: the biggest single entry of the year, if it happened this week.
  let standout: string | null = null;
  const year = weekStartKey.slice(0, 4);
  const seen = new Set<string>();
  for (const i of identities) {
    for (const { metric } of i.links) {
      if (seen.has(metric.id) || metric.aggregation !== 'total' || metric.direction !== 'atLeast') continue;
      seen.add(metric.id);
      const yearEntries = entries.filter((e) => e.metricId === metric.id && e.day.startsWith(year) && e.day <= weekEnd);
      if (yearEntries.length < 5) continue;
      const best = yearEntries.reduce((m, e) => (e.value > m.value ? e : m));
      if (best.day >= weekStartKey) {
        standout = `Your biggest ${metric.name.toLowerCase()} entry of the year: ${formatValue(best.value)} ${
          metric.unit
        } on ${fmt.dayName(parseDay(best.day).getDay())}.`;
        break;
      }
    }
    if (standout) break;
  }

  const skipped: { metric: string; days: number }[] = [];
  const days = daysBetween(weekStartKey, weekEnd);
  const dailySeen = new Set<string>();
  for (const i of identities) {
    for (const { metric } of i.links) {
      if (metric.period !== 'day' || dailySeen.has(metric.id)) continue;
      dailySeen.add(metric.id);
      const logged = new Set(entries.filter((e) => e.metricId === metric.id).map((e) => e.day));
      const n = days.filter((d) => !logged.has(d)).length;
      if (n > 0 && n < 7) skipped.push({ metric: metric.name, days: n });
    }
  }

  return { weekStart: weekStartKey, weekEnd, rows, standout, skipped, wins: weekWins(identities, entries, weekStartKey) };
}

const BEST_MIN_PRIOR = 5;
const KIND_ORDER: Record<DayWin['kind'], number> = { best: 0, period: 1, daily: 2 };

/**
 * The week's wins, day by day:
 * - daily goals met (or kept under, for "at most" goals),
 * - the day a weekly or monthly goal was reached,
 * - personal bests (after at least five earlier entries, for "at least" goals).
 * A best on the same day replaces that metric's daily-goal win. Paused days have no wins.
 */
export function weekWins(identities: IdentityInput[], entries: EntryPoint[], weekStartKey: string): DayWin[] {
  const weekEnd = addDays(weekStartKey, 6);
  const days = daysBetween(weekStartKey, weekEnd);
  const owner = new Map<string, { metric: MetricDef; identityId: string; paused: Set<string> }>();
  for (const i of identities) {
    for (const { metric } of i.links) {
      if (!owner.has(metric.id)) owner.set(metric.id, { metric, identityId: i.id, paused: pausedDays(i.pauses, weekStartKey, weekEnd) });
    }
  }

  const wins: DayWin[] = [];
  for (const { metric, identityId, paused } of owner.values()) {
    const mine = entries.filter((e) => e.metricId === metric.id && e.day <= weekEnd);
    const unit = metric.unit;
    const additive = metric.aggregation === 'total' || metric.aggregation === 'count';
    // Paused days aren't scored, so they aren't celebrated either.
    const add = (day: string, kind: DayWin['kind'], text: string) => {
      if (!paused.has(day)) wins.push({ day, identityId, metricId: metric.id, kind, text });
    };

    // Daily goals.
    if (metric.period === 'day') {
      for (const { day, value } of dailyValues(metric, mine, { from: weekStartKey, to: weekEnd })) {
        if (metric.direction === 'atLeast' ? value >= metric.target : value <= metric.target) {
          add(day, 'daily', `${metric.name} ${formatAmount(value, unit)} · ${metric.direction === 'atLeast' ? 'goal met' : 'under your limit'}`);
        }
      }
    }

    // The day a weekly or monthly total crossed its goal.
    if (metric.period !== 'day' && additive && metric.direction === 'atLeast') {
      for (const day of days) {
        const from = periodStart(metric.period, day);
        const upTo = (to: string) => aggregate(mine.filter((e) => e.day >= from && e.day <= to).map((e) => e.value), metric.aggregation) ?? 0;
        const before = day === from ? 0 : upTo(addDays(day, -1));
        const after = upTo(day);
        if (before < metric.target && after >= metric.target) {
          add(day, 'period', `${metric.name} ${metric.period === 'week' ? 'weekly' : 'monthly'} goal reached · ${formatAmount(after, unit)}`);
        }
      }
    }

    // Personal bests. Daily totals compare day against day; everything else entry against entry.
    if (metric.direction === 'atLeast' && metric.aggregation !== 'count' && metric.aggregation !== 'min') {
      const byDay = new Map<string, number[]>();
      for (const e of mine) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e.value]);
      const dayScore = (vals: number[]) => (metric.period === 'day' && metric.aggregation === 'total' ? vals.reduce((a, b) => a + b, 0) : Math.max(...vals));
      for (const day of days) {
        const vals = byDay.get(day);
        if (!vals) continue;
        const earlier = mine.filter((e) => e.day < day);
        if (earlier.length < BEST_MIN_PRIOR) continue;
        const earlierDays = new Map<string, number[]>();
        for (const e of earlier) earlierDays.set(e.day, [...(earlierDays.get(e.day) ?? []), e.value]);
        const prevBest = Math.max(...[...earlierDays.values()].map(dayScore));
        const mineToday = dayScore(vals);
        if (mineToday > prevBest) {
          const i = wins.findIndex((w) => w.day === day && w.kind === 'daily' && w.metricId === metric.id);
          if (i >= 0) wins.splice(i, 1);
          add(day, 'best', `${metric.name} ${formatAmount(mineToday, unit)} · best yet`);
        }
      }
    }
  }
  return wins.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : KIND_ORDER[a.kind] - KIND_ORDER[b.kind]));
}
