import type { Weight } from '@/db/schema';
import { addDays, diffDays } from '@/lib/dates';
import { alignment, type PauseRange, scoreOf } from './alignment';
import { type EntryPoint, formatValue, type MetricDef, periodValue, windowEnding } from './metrics';

export const INSIGHTS_MIN_DAYS = 28;

export interface IdentityInput {
  id: string;
  name: string;
  links: { metric: MetricDef; weight: Weight }[];
  pauses: PauseRange[];
}

export type Insight =
  | { type: 'metricTrend'; identityIds: string[]; who: string; text: string; basis: string }
  | { type: 'alignmentShift'; identityIds: string[]; who: string; text: string; basis: string }
  | {
      type: 'split';
      identityIds: string[];
      who: string;
      text: string;
      basis: string;
      bars: { label: string; value: string; ratio: number }[];
    };

export type InsightsResult = { status: 'ready'; insights: Insight[] } | { status: 'waiting'; daysToGo: number };

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Plain-language patterns, templated from the calculations. No AI in V1. */
export function computeInsights(identities: IdentityInput[], entries: EntryPoint[], asOf: string): InsightsResult {
  if (entries.length === 0) return { status: 'waiting', daysToGo: INSIGHTS_MIN_DAYS };
  const first = entries.reduce((m, e) => (e.day < m ? e.day : m), entries[0].day);
  const span = diffDays(asOf, first) + 1;
  if (span < INSIGHTS_MIN_DAYS) return { status: 'waiting', daysToGo: INSIGHTS_MIN_DAYS - span };

  const out: Insight[] = [];
  const metricsById = new Map<string, { metric: MetricDef; identityIds: string[] }>();
  for (const i of identities) {
    for (const { metric } of i.links) {
      const m = metricsById.get(metric.id) ?? { metric, identityIds: [] };
      m.identityIds.push(i.id);
      metricsById.set(metric.id, m);
    }
  }

  // 1. Alignment shift over ~3 months: one identity that moved, one that held.
  const shifts = identities
    .map((i) => {
      const now = scoreOf(alignment(i.links, entries, i.pauses, asOf));
      const then = scoreOf(alignment(i.links, entries, i.pauses, addDays(asOf, -90)));
      return now !== null && then !== null ? { i, now, then, d: now - then } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const mover = [...shifts].sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
  if (mover && Math.abs(mover.d) >= 5) {
    const holder = shifts.find((s) => s !== mover && Math.abs(s.d) < 3);
    const text =
      `Over the past three months, ${mover.i.name} went from ${mover.then}% to ${mover.now}% aligned` +
      (holder ? `, while ${holder.i.name} stayed around ${holder.now}%.` : '.');
    out.push({
      type: 'alignmentShift',
      identityIds: holder ? [mover.i.id, holder.i.id] : [mover.i.id],
      who: holder ? `${mover.i.name} · ${holder.i.name}` : mover.i.name,
      text,
      basis: '28-day alignment, now vs 90 days ago',
    });
  }

  // 2. A metric's 4-week average vs three months ago.
  const trends = [...metricsById.values()]
    .map(({ metric, identityIds }) => {
      const now = periodValue(metric, entries, windowEnding(asOf, 28));
      const then = periodValue(metric, entries, windowEnding(addDays(asOf, -84), 28));
      if (now === null || then === null || then === 0) return null;
      return { metric, identityIds, now, then, change: (now - then) / Math.abs(then) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null && Math.abs(x.change) >= 0.1)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  for (const t of trends.slice(0, 2)) {
    const per = t.metric.period === 'week' ? 'weekly ' : t.metric.period === 'month' ? 'monthly ' : 'daily ';
    out.push({
      type: 'metricTrend',
      identityIds: t.identityIds,
      who: t.metric.name,
      text: `You've ${t.change > 0 ? 'increased' : 'decreased'} your ${per}${lower(t.metric.name)} from ${formatValue(
        t.then,
      )} to ${formatValue(t.now)} ${t.metric.unit} over the last three months.`,
      basis: '4-week averages',
    });
  }

  // 3. Weeks above vs below a daily metric's threshold, compared on a weekly metric in the same identity.
  for (const i of identities) {
    const daily = i.links.map((l) => l.metric).filter((m) => m.period === 'day' && m.direction === 'atLeast');
    const weekly = i.links.map((l) => l.metric).filter((m) => m.period === 'week');
    for (const d of daily) {
      for (const wk of weekly) {
        const threshold = Math.floor(d.target);
        const hi: number[] = [];
        const lo: number[] = [];
        for (let k = 0; k < 52; k++) {
          const w = windowEnding(addDays(asOf, -7 * k), 7);
          const dv = periodValue(d, entries, w);
          const wv = periodValue(wk, entries, w);
          if (dv === null || wv === null) continue;
          (dv >= threshold ? hi : lo).push(wv);
        }
        if (hi.length < 3 || lo.length < 3) continue;
        const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
        const h = mean(hi);
        const l = mean(lo);
        if (l <= 0 || h / l < 1.15) continue;
        const max = Math.max(h, l);
        out.push({
          type: 'split',
          identityIds: [i.id],
          who: `${i.name} · ${d.name}`,
          text: `Your strongest ${lower(wk.name)} weeks tend to happen when you average ${threshold} ${d.unit} of ${lower(
            d.name,
          )} or more.`,
          basis: `Average weekly ${wk.unit}, ${hi.length + lo.length} weeks`,
          bars: [
            { label: `${threshold}${d.unit}+ ${lower(d.name)}`, value: `${formatValue(h)} ${wk.unit}`, ratio: h / max },
            { label: `Under ${threshold}${d.unit}`, value: `${formatValue(l)} ${wk.unit}`, ratio: l / max },
          ],
        });
        break;
      }
    }
  }

  return { status: 'ready', insights: out };
}
