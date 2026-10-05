/// <reference types="jest" />
import { addDays } from '@/lib/dates';
import { alignment, pausedDays } from '../alignment';
import { type EntryPoint, type MetricDef, periodValue, progress, trendFor, windowEnding } from '../metrics';
import { adherence } from '../systems';

const asOf = '2026-09-22';
const m = (id: string, over: Partial<MetricDef>): MetricDef => ({
  id,
  name: id,
  aggregation: 'total',
  unit: 'x',
  target: 1,
  period: 'week',
  direction: 'atLeast',
  ...over,
});

/** Spread `n` entries of `value` evenly over the 28-day window ending asOf. */
function spread(metricId: string, n: number, value: number, end = asOf): EntryPoint[] {
  return Array.from({ length: n }, (_, i) => ({
    metricId,
    value,
    day: addDays(end, -Math.floor((i * 28) / n)),
  }));
}

describe('progress', () => {
  it('caps at 100% and treats "at most" as a limit', () => {
    expect(progress(18, 15, 'atLeast')).toBe(1);
    expect(progress(12.6, 15, 'atLeast')).toBeCloseTo(0.84);
    expect(progress(2.7, 3, 'atMost')).toBe(1);
    expect(progress(6, 3, 'atMost')).toBeCloseTo(0.5);
  });
});

describe('periodValue', () => {
  it('scales weekly totals to one week over the window', () => {
    const dist = m('dist', { target: 15 });
    // 12 runs of 4.2 mi in 28 days = 50.4 mi = 12.6 mi / wk
    expect(periodValue(dist, spread('dist', 12, 4.2), windowEnding(asOf, 28))).toBeCloseTo(12.6);
  });

  it('averages daily metrics over logged days only (skipped days are not zero)', () => {
    const sleep = m('sleep', { aggregation: 'average', period: 'day', target: 7.5 });
    const entries: EntryPoint[] = [
      { metricId: 'sleep', value: 7, day: asOf },
      { metricId: 'sleep', value: 8, day: addDays(asOf, -2) },
    ];
    expect(periodValue(sleep, entries, windowEnding(asOf, 28))).toBe(7.5);
  });

  it('leaves paused days out of weekly scaling', () => {
    const runs = m('runs', { aggregation: 'count', target: 3 });
    const entries = spread('runs', 6, 1, addDays(asOf, -14)).filter((e) => e.day >= addDays(asOf, -27));
    const w = windowEnding(asOf, 28);
    const paused = pausedDays([{ startDate: addDays(asOf, -13), endDate: asOf }], w.from, w.to);
    // Only the 14 unpaused days count: the same runs now read as a higher weekly rate.
    expect(periodValue(runs, entries, w, paused)!).toBeGreaterThan(periodValue(runs, entries, w)!);
  });
});

describe('alignment', () => {
  // Runner from the spec: Distance 84% High, Runs 93% Normal, Long runs 75% Normal, Strength 75% Low, Sleep 96% Low.
  const dist = m('Distance', { target: 15 });
  const runs = m('Runs', { aggregation: 'count', target: 3 });
  const longRuns = m('Long runs', { aggregation: 'count', target: 1 });
  const strength = m('Strength', { aggregation: 'count', target: 2 });
  const sleep = m('Sleep', { aggregation: 'average', period: 'day', target: 7.5 });
  const links = [
    { metric: dist, weight: 4 as const },
    { metric: runs, weight: 2 as const },
    { metric: longRuns, weight: 2 as const },
    { metric: strength, weight: 1 as const },
    { metric: sleep, weight: 1 as const },
  ];
  const entries = [
    ...spread('Distance', 12, 4.2),
    ...spread('Runs', 11, 1),
    ...spread('Long runs', 3, 1),
    ...spread('Strength', 6, 1),
    ...Array.from({ length: 28 }, (_, i) => ({ metricId: 'Sleep', value: 7.2, day: addDays(asOf, -i) })),
  ];

  it('matches the spec breakdown and the points add up to the score', () => {
    const a = alignment(links, entries, [], asOf);
    expect(a.status).toBe('scored');
    if (a.status !== 'scored') return;
    const byName = Object.fromEntries(a.breakdown.map((r) => [r.name, r]));
    expect(byName.Distance.score).toBe(84);
    expect(byName.Runs.score).toBe(92);
    expect(byName['Long runs'].score).toBe(75);
    expect(byName.Strength.score).toBe(75);
    expect(byName.Sleep.score).toBe(96);
    expect(a.breakdown.reduce((s, r) => s + r.pts, 0)).toBe(a.score);
    expect(a.score).toBe(84);
  });

  it('shows a baseline state before 7 days of data', () => {
    const recent = [{ metricId: 'Distance', value: 3, day: addDays(asOf, -1) }];
    expect(alignment(links, recent, [], asOf)).toEqual({ status: 'baseline', daysToGo: 5 });
  });

  it('is not scored while paused', () => {
    expect(alignment(links, entries, [{ startDate: asOf, endDate: null }], asOf).status).toBe('paused');
  });

  it('scores "at most" metrics as limits', () => {
    const drinks = m('Drinks', { target: 3, direction: 'atMost' });
    const a = alignment([{ metric: drinks, weight: 2 }], spread('Drinks', 8, 1.35), [], asOf);
    expect(a.status === 'scored' && a.score).toBe(100);
  });
});

describe('trendFor', () => {
  it('labels movement toward the goal as improving', () => {
    const dist = m('d', { target: 15 });
    const entries = [...spread('d', 12, 4.2), ...spread('d', 10, 4, addDays(asOf, -28))];
    const t = trendFor(dist, entries, asOf);
    expect(t.status).toBe('improving');
    expect(t.change!).toBeCloseTo(0.26, 2);
  });
});

describe('adherence', () => {
  const sys = { frequency: 'weekly' as const, timesPerWeek: 3 };
  const days = (n: number) => Array.from({ length: n }, (_, i) => addDays(asOf, -i * 2));
  it('applies the 75% / 45% thresholds', () => {
    expect(adherence(sys, days(10), asOf).tag).toBe('onTrack'); // 10 of 12
    expect(adherence(sys, days(6), asOf).tag).toBe('slipping'); // 6 of 12
    expect(adherence(sys, days(3), asOf).tag).toBe('reset');
    expect(adherence({ frequency: 'asNeeded', timesPerWeek: 0 }, days(3), asOf).tag).toBe('asNeeded');
  });
});
