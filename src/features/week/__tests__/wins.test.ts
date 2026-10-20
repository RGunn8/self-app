/// <reference types="jest" />
import type { IdentityInput } from '@/features/insights/domain';
import type { EntryPoint, MetricDef } from '@/features/metrics/domain';
import { weekWins } from '@/features/week/domain';

const week = '2026-09-21'; // Monday
const m = (id: string, over: Partial<MetricDef> = {}): MetricDef => ({
  id,
  name: id,
  aggregation: 'total',
  unit: 'x',
  target: 10,
  period: 'day',
  direction: 'atLeast',
  ...over,
});
const who = (id: string, metrics: MetricDef[]): IdentityInput => ({ id, name: id, links: metrics.map((metric) => ({ metric, weight: 2 })), pauses: [] });
const e = (metricId: string, day: string, value: number): EntryPoint => ({ metricId, day, value });
const summary = (wins: ReturnType<typeof weekWins>) => wins.map((w) => `${w.day} ${w.kind} ${w.text}`);

describe('weekWins', () => {
  it('celebrates each day a daily goal was met', () => {
    const steps = m('Steps', { target: 8000, unit: 'steps' });
    const wins = weekWins([who('walker', [steps])], [e('Steps', '2026-09-21', 9000), e('Steps', '2026-09-22', 3000), e('Steps', '2026-09-23', 4000), e('Steps', '2026-09-23', 4500)], week);
    expect(summary(wins)).toEqual(['2026-09-21 daily Steps 9,000 steps · goal met', '2026-09-23 daily Steps 8,500 steps · goal met']);
  });

  it('counts staying under an "at most" daily limit', () => {
    const drinks = m('Drinks', { target: 2, direction: 'atMost', unit: 'drinks' });
    const wins = weekWins([who('me', [drinks])], [e('Drinks', '2026-09-21', 1), e('Drinks', '2026-09-22', 3)], week);
    expect(summary(wins)).toEqual(['2026-09-21 daily Drinks 1.0 drinks · under your limit']);
  });

  it('marks the day a weekly goal was reached, once', () => {
    const run = m('Run', { period: 'week', target: 14, unit: 'mi' });
    const wins = weekWins([who('runner', [run])], [e('Run', '2026-09-21', 6), e('Run', '2026-09-23', 9), e('Run', '2026-09-25', 4)], week);
    expect(summary(wins)).toEqual(['2026-09-23 period Run weekly goal reached · 15 mi']);
  });

  it('a monthly goal already reached last week is not celebrated again', () => {
    const read = m('Read', { period: 'month', target: 100, unit: 'pages' });
    const wins = weekWins([who('reader', [read])], [e('Read', '2026-09-02', 120), e('Read', '2026-09-22', 30)], week);
    expect(wins).toEqual([]);
  });

  it('a personal best replaces that day’s daily-goal win', () => {
    const steps = m('Steps', { target: 8000, unit: 'steps' });
    const earlier = ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14'].map((d) => e('Steps', d, 9000));
    const wins = weekWins([who('walker', [steps])], [...earlier, e('Steps', '2026-09-22', 12000), e('Steps', '2026-09-23', 8500)], week);
    expect(summary(wins)).toEqual(['2026-09-22 best Steps 12,000 steps · best yet', '2026-09-23 daily Steps 8,500 steps · goal met']);
  });

  it('needs five earlier entries before calling anything a best', () => {
    const run = m('Run', { period: 'week', target: 1000, unit: 'mi' });
    const wins = weekWins([who('runner', [run])], [e('Run', '2026-09-14', 3), e('Run', '2026-09-22', 9)], week);
    expect(wins).toEqual([]);
  });

  it('shows a shared metric under its first identity only', () => {
    const steps = m('Steps', { target: 1 });
    const wins = weekWins([who('a', [steps]), who('b', [steps])], [e('Steps', '2026-09-21', 2)], week);
    expect(wins.map((w) => w.identityId)).toEqual(['a']);
  });
});

describe('weekWins and pauses', () => {
  it('has no wins on paused days', () => {
    const steps = m('Steps', { target: 1 });
    const paused: IdentityInput = { ...who('walker', [steps]), pauses: [{ startDate: '2026-09-22', endDate: '2026-09-23' }] };
    const wins = weekWins([paused], [e('Steps', '2026-09-21', 2), e('Steps', '2026-09-22', 2), e('Steps', '2026-09-24', 2)], week);
    expect(wins.map((w) => w.day)).toEqual(['2026-09-21', '2026-09-24']);
  });
});
