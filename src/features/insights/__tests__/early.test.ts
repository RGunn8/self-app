/// <reference types="jest" />
import { earlyObservations, type IdentityInput } from '@/features/insights/domain';
import type { EntryPoint, MetricDef } from '@/features/metrics/domain';

const asOf = '2026-09-23'; // a Wednesday
const run: MetricDef = { id: 'run', name: 'Run', aggregation: 'total', unit: 'mi', target: 14, period: 'week', direction: 'atLeast' };
const runner: IdentityInput = { id: 'runner', name: 'Runner', links: [{ metric: run, weight: 2 }], pauses: [] };
const e = (day: string, value = 1): EntryPoint => ({ metricId: 'run', day, value });
const texts = (entries: EntryPoint[]) => earlyObservations([runner], entries, asOf).map((o) => o.text);

describe('earlyObservations', () => {
  it('says nothing without data', () => {
    expect(texts([])).toEqual([]);
  });

  it('counts days logged in the last 7, from 3 days up', () => {
    expect(texts([e('2026-09-21'), e('2026-09-22')]).some((t) => t.includes('of the last 7 days'))).toBe(false);
    expect(texts([e('2026-09-17'), e('2026-09-21'), e('2026-09-22'), e('2026-09-22')])).toContain(
      'You logged something for Runner on 3 of the last 7 days.',
    );
  });

  it('names a favourite weekday once there are 5 entries and one day has 40%', () => {
    const saturdays = [e('2026-08-29'), e('2026-09-05'), e('2026-09-12'), e('2026-09-01'), e('2026-09-09')];
    expect(texts(saturdays)).toContain('Most of your run entries land on Saturdays.');
    expect(texts(saturdays.slice(0, 4)).some((t) => t.startsWith('Most of your'))).toBe(false);
  });

  it('picks the best week once there are two weeks', () => {
    expect(texts([e('2026-09-14', 3), e('2026-09-15', 4)]).some((t) => t.includes('best run week'))).toBe(false);
    expect(texts([e('2026-09-07', 3), e('2026-09-14', 3), e('2026-09-15', 4)])).toContain(
      'Your best run week so far: 7.0 mi, the week of Sep 14.',
    );
  });

  it('notes the personal best after 5 entries', () => {
    const five = [e('2026-09-01', 2), e('2026-09-03', 6), e('2026-09-05', 3), e('2026-09-08', 4), e('2026-09-10', 1)];
    expect(texts(five)).toContain('Your best run so far: 6.0 mi on Sep 3.');
    expect(texts(five.slice(0, 4)).some((t) => t.startsWith('Your best run so far'))).toBe(false);
  });
});
