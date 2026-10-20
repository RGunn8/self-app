/// <reference types="jest" />
import { calendarMonths, chartSeries, chartWindow, type EntryPoint, type MetricDef } from '@/features/metrics/domain';

// A Wednesday.
const asOf = '2026-09-23';
const m = (over: Partial<MetricDef> = {}): MetricDef => ({
  id: 'run',
  name: 'run',
  aggregation: 'total',
  unit: 'mi',
  target: 14,
  period: 'week',
  direction: 'atLeast',
  ...over,
});
const e = (day: string, value: number): EntryPoint => ({ metricId: 'run', day, value });

describe('chartWindow', () => {
  it('W is the Mon–Sun week around asOf', () => {
    const w = chartWindow('W', asOf);
    expect(w.from).toBe('2026-09-21');
    expect(w.to).toBe('2026-09-27');
    expect(w.buckets).toHaveLength(7);
  });

  it('M is the full calendar month, including a short February', () => {
    expect(chartWindow('M', asOf).buckets).toHaveLength(30);
    const feb = chartWindow('M', '2026-02-10');
    expect(feb.from).toBe('2026-02-01');
    expect(feb.to).toBe('2026-02-28');
    expect(feb.buckets).toHaveLength(28);
  });

  it('3M is 13 Monday weeks ending this week; offset steps back a whole window', () => {
    const w = chartWindow('3M', asOf);
    expect(w.buckets).toHaveLength(13);
    expect(w.buckets[12]).toEqual({ from: '2026-09-21', to: '2026-09-27' });
    expect(chartWindow('3M', asOf, 1).buckets[12].from).toBe('2026-06-22');
  });

  it('offset steps W back one week and M back one month', () => {
    expect(chartWindow('W', asOf, 1).from).toBe('2026-09-14');
    expect(chartWindow('M', '2026-01-15', 1).from).toBe('2025-12-01');
  });
});

describe('chartSeries', () => {
  it('weekly goal on W: running total for the week; future days are null', () => {
    const s = chartSeries(m(), [e('2026-09-21', 3), e('2026-09-21', 2), e('2026-09-23', 1)], 'W', asOf);
    expect(s.cumulative).toBe('week');
    expect(s.points.map((p) => p.value)).toEqual([5, 5, 6, null, null, null, null]);
  });

  it('monthly goal on W: month-to-date, resetting on the 1st', () => {
    const metric = m({ period: 'month', target: 60 });
    const entries = [e('2026-09-29', 10), e('2026-09-30', 5), e('2026-10-01', 4), e('2026-10-02', 2)];
    const s = chartSeries(metric, entries, 'W', '2026-10-02');
    expect(s.cumulative).toBe('month');
    // Mon Sep 28 … Sun Oct 4
    expect(s.points.map((p) => p.value)).toEqual([0, 10, 15, 4, 6, null, null]);
  });

  it('monthly goal on 3M: each week is month-to-date at its last day', () => {
    const metric = m({ period: 'month', target: 60 });
    const s = chartSeries(metric, [e('2026-09-02', 10), e('2026-09-16', 5)], '3M', asOf);
    expect(s.points.slice(-3).map((p) => p.value)).toEqual([10, 15, 15]);
  });

  it('weekly goal on 3M: plain weekly totals', () => {
    const s = chartSeries(m(), [e('2026-09-14', 4), e('2026-09-20', 6), e('2026-09-22', 1)], '3M', asOf);
    expect(s.cumulative).toBeNull();
    expect(s.points[11].value).toBe(10);
    expect(s.points[12].value).toBe(1);
  });

  it('daily additive goal: daily totals on W, unlogged days 0', () => {
    const s = chartSeries(m({ period: 'day', target: 2 }), [e('2026-09-21', 3)], 'W', asOf);
    expect(s.cumulative).toBeNull();
    expect(s.points.map((p) => p.value)).toEqual([3, 0, 0, null, null, null, null]);
  });

  it('non-additive: unlogged days are null', () => {
    const s = chartSeries(m({ aggregation: 'average', period: 'day', target: 7 }), [e('2026-09-22', 6), e('2026-09-22', 8)], 'W', asOf);
    expect(s.cumulative).toBeNull();
    expect(s.points.map((p) => p.value)).toEqual([null, 7, null, null, null, null, null]);
  });

  it('hasEarlier is true only when entries exist before the window', () => {
    const entries = [e('2026-09-10', 3)];
    expect(chartSeries(m(), entries, 'W', asOf).hasEarlier).toBe(true);
    expect(chartSeries(m(), entries, 'M', asOf).hasEarlier).toBe(false);
  });
});

describe('calendarMonths', () => {
  it('lists every month from the first entry, newest first, with month totals', () => {
    const { months, max } = calendarMonths(m(), [e('2026-07-30', 2), e('2026-09-01', 5), e('2026-09-01', 1)], asOf);
    expect(months.map((x) => x.key)).toEqual(['2026-09-01', '2026-08-01', '2026-07-01']);
    expect(months[0].days).toHaveLength(30);
    expect(months[0].value).toBe(6);
    expect(months[1].value).toBe(0);
    expect(months[0].days[0].value).toBe(6);
    expect(months[0].days[1].value).toBeNull();
    expect(max).toBe(6);
  });

  it('is empty with no entries', () => {
    expect(calendarMonths(m(), [], asOf).months).toEqual([]);
  });
});
