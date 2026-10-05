import { addDays, daysBetween, parseDay } from '@/lib/dates';
import { alignment, scoreOf } from './alignment';
import type { IdentityInput } from './insights';
import { type EntryPoint, formatValue, type MetricDef, periodValue, windowEnding } from './metrics';

export interface WeekIdentityRow {
  identityId: string;
  name: string;
  summary: string;
  change: number | null;
  score: number | null;
}

export interface WeekReview {
  weekStart: string;
  weekEnd: string;
  rows: WeekIdentityRow[];
  standout: string | null;
  skipped: { metric: string; days: number }[];
}

const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function weekValueText(metric: MetricDef, entries: EntryPoint[], from: string, to: string): string | null {
  const v = periodValue({ ...metric, period: metric.period === 'day' ? 'day' : 'week' }, entries, { from, to });
  if (v === null) return null;
  return `${formatValue(v)} ${metric.unit}`;
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
      score: scoreOf(alignment(i.links, entries, i.pauses, weekEnd)),
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
        } on ${DOW_LONG[parseDay(best.day).getDay()]}.`;
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

  return { weekStart: weekStartKey, weekEnd, rows, standout, skipped };
}
