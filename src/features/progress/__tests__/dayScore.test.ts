/// <reference types="jest" />
import type { Entry } from '@/features/logging/model';
import type { Plan } from '@/features/planning/model';
import { type DayData, dayScore, fullestDays, usualDay, votesByDay } from '@/features/progress/dayScore';
import type { System, SystemCompletion, SystemIdentity } from '@/features/systems/model';
import { addDays, parseDay } from '@/shared/lib/dates';

const row = { createdAt: 0, updatedAt: 0, deletedAt: null };
const day = '2026-09-23';
let n = 0;

// Each entry is a different metric, so several on one day are several votes (one metric votes once a day).
const entry = (d: string, systemCompletionId: string | null = null, metricId = `m${n}`) =>
  ({ ...row, id: `e${n++}`, metricId, value: 1, loggedAt: parseDay(d).getTime() + 9 * 3_600_000, source: 'manual', systemCompletionId }) as Entry;
const done = (systemId: string, date: string) => ({ ...row, id: `c${n++}`, systemId, date }) as SystemCompletion;
const plan = (d: string, over: Partial<Plan> = {}): Plan => ({
  ...row,
  id: `p${n++}`,
  day: d,
  time: null,
  kind: 'intention',
  systemId: null,
  identityId: 'runner',
  title: 'x',
  metricId: null,
  amount: null,
  status: 'planned',
  entryId: null,
  position: 0,
  ...over,
});

function data(over: Partial<DayData> = {}): DayData {
  return {
    entries: [],
    metrics: [],
    links: [],
    completions: [],
    systems: [{ ...row, id: 'stretch', name: 'Stretch', description: null, cue: 'c', frequency: 'daily', timesPerWeek: 0 } as System],
    systemIdentities: [{ ...row, id: 's', systemId: 'stretch', identityId: 'runner' } as SystemIdentity],
    plans: [],
    identities: [
      { id: 'runner', name: 'Runner', accent: 'runner', archivedAt: null },
      { id: 'writer', name: 'Writer', accent: 'writer', archivedAt: null },
    ],
    pauses: [],
    ...over,
  };
}

/** n manual entries on each of the given days. */
const history = (days: string[], perDay: number) => days.flatMap((d) => Array.from({ length: perDay }, () => entry(d)));

describe('dayScore', () => {
  it('nothing planned and nothing done is a rest day, not a zero', () => {
    expect(dayScore(day, data(), true)).toMatchObject({ state: 'rest', band: null });
  });

  it('planned with nothing done yet is a quiet day', () => {
    expect(dayScore(day, data({ plans: [plan(day)] }), true)).toMatchObject({ state: 'quiet', fill: 0, planned: 1 });
  });

  it('keeping every plan is Full', () => {
    const plans = [plan(day, { status: 'done' }), plan(day, { status: 'done' })];
    expect(dayScore(day, data({ plans }), true)).toMatchObject({ state: 'scored', band: 'full', kept: 2, planned: 2 });
  });

  it('extras top up a partly kept day', () => {
    const plans = [plan(day, { status: 'done' }), plan(day, { status: 'done' }), plan(day, { status: 'done' }), plan(day)];
    const without = dayScore(day, data({ plans }), true);
    expect(without.band).toBe('strong');
    const withExtras = dayScore(day, data({ plans, entries: [entry(day), entry(day)] }), true);
    expect(withExtras).toMatchObject({ band: 'full', extras: 2 });
  });

  it('"not today" isn’t counted against you', () => {
    const plans = [plan(day, { status: 'done' }), plan(day, { status: 'skipped' })];
    expect(dayScore(day, data({ plans }), true)).toMatchObject({ planned: 1, band: 'full' });
  });

  it('unplanned days are measured against your usual day', () => {
    const past = [1, 2, 3, 4].map((i) => addDays(day, -i));
    const d = data({ entries: [...history(past, 4), ...history([day], 2)] });
    expect(dayScore(day, d, true)).toMatchObject({ state: 'scored', usual: 4, band: 'steady' });
  });

  it('with no history, your usual day is 2', () => {
    expect(usualDay(day, new Map())).toBe(2);
    expect(dayScore(day, data({ entries: [entry(day), entry(day)] }), true).band).toBe('full');
  });

  it('any action is at least Getting started', () => {
    const past = [1, 2, 3].map((i) => addDays(day, -i));
    const d = data({ entries: [...history(past, 10), entry(day)] });
    expect(dayScore(day, d, true)).toMatchObject({ fill: 0.25, band: 'started' });
  });

  it('plans for paused identities are left out; everything paused reads Paused', () => {
    const plans = [plan(day, { status: 'done' }), plan(day, { identityId: 'writer' })];
    const writerPaused = data({ plans, pauses: [{ identityId: 'writer', startDate: day, endDate: null }] });
    expect(dayScore(day, writerPaused, true)).toMatchObject({ planned: 1, band: 'full' });
    const allPaused = data({
      pauses: [
        { identityId: 'writer', startDate: day, endDate: null },
        { identityId: 'runner', startDate: day, endDate: null },
      ],
    });
    expect(dayScore(day, allPaused, true).state).toBe('paused');
  });

  it('with planning off, plans are ignored', () => {
    const d = data({ plans: [plan(day), plan(day)], entries: [entry(day), entry(day)] });
    expect(dayScore(day, d, false)).toMatchObject({ planned: 0, band: 'full' });
    expect(dayScore(day, data({ plans: [plan(day)] }), false).state).toBe('rest');
  });
});

describe('votesByDay', () => {
  it('counts manual entries, completions and value-less intentions once each', () => {
    const v = votesByDay({
      metrics: [],
      entries: [entry(day), entry(day, 'c-sys')],
      completions: [done('stretch', day)],
      plans: [plan(day, { status: 'done' }), plan(day, { status: 'done', entryId: 'e-x' }), plan(day)],
    });
    expect(v.get(day)).toBe(3);
  });
});

describe('fullestDays', () => {
  it('names only the Strong and Full days', () => {
    const monday = '2026-09-21';
    const d = data({ plans: [plan(monday, { status: 'done' }), plan('2026-09-22'), plan(day, { status: 'done' }), plan(day)] });
    // Mon: 1 of 1 kept (Full). Tue: quiet. Wed: 1 of 2 kept (Steady).
    expect(fullestDays(monday, day, d, true)).toEqual([monday]);
  });
});

describe('votes are acting, once per metric a day', () => {
  it('logging the same metric twice in a day is one vote', () => {
    const v = votesByDay({ metrics: [], entries: [entry(day, null, 'run'), entry(day, null, 'run')], completions: [], plans: [] });
    expect(v.get(day)).toBe(1);
  });

  it('"at most" metrics (limits) aren’t votes', () => {
    const drinks = { ...row, id: 'drinks', direction: 'atMost' } as never;
    const v = votesByDay({ metrics: [drinks], entries: [entry(day, null, 'drinks')], completions: [], plans: [] });
    expect(v.get(day)).toBeUndefined();
  });
});
