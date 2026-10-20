/// <reference types="jest" />
import type { IdentityInput } from '@/features/insights/domain';
import type { LogData } from '@/features/logging/domain';
import type { Entry } from '@/features/logging/model';
import { type MetricDef, toEntryPoint } from '@/features/metrics/domain';
import type { IdentityMetric, Metric } from '@/features/metrics/model';
import { isVoteMilestone, momentFor, unlockPath, votesFor } from '@/features/progress/domain';
import type { System, SystemCompletion, SystemIdentity } from '@/features/systems/model';
import { addDays, parseDay } from '@/shared/lib/dates';

const row = { createdAt: 0, updatedAt: 0, deletedAt: null };
const asOf = '2026-09-23'; // a Wednesday

const def = (id: string, over: Partial<MetricDef> = {}): MetricDef => ({
  id,
  name: id === 'run' ? 'Run' : id,
  aggregation: 'total',
  unit: 'mi',
  target: 14,
  period: 'week',
  direction: 'atLeast',
  ...over,
});
const metric = (d: MetricDef) => ({ ...row, ...d }) as unknown as Metric;
const link = (identityId: string, metricId: string) => ({ ...row, id: `${identityId}-${metricId}`, identityId, metricId, weight: 2 }) as unknown as IdentityMetric;
let n = 0;
const entry = (metricId: string, day: string, value = 1, systemCompletionId: string | null = null) =>
  ({ ...row, id: `e${n++}`, metricId, value, loggedAt: parseDay(day).getTime() + 9 * 3_600_000, source: 'manual', systemCompletionId }) as unknown as Entry;
const system = (id: string) => ({ ...row, id, name: id }) as unknown as System;
const sysLink = (systemId: string, identityId: string) => ({ ...row, id: `${systemId}-${identityId}`, systemId, identityId }) as unknown as SystemIdentity;
const done = (id: string, systemId: string, date: string) => ({ ...row, id, systemId, date }) as unknown as SystemCompletion;

function world(entries: Entry[], opts: { runDef?: MetricDef; completions?: SystemCompletion[] } = {}) {
  const run = opts.runDef ?? def('run');
  const data: LogData = {
    metrics: [metric(run), metric(def('read', { unit: 'pages' }))],
    links: [link('runner', 'run'), link('parent', 'run'), link('writer', 'read')],
    entries,
    systems: [system('stretch')],
    systemIdentities: [sysLink('stretch', 'runner')],
    completions: opts.completions ?? [],
  };
  const identities: IdentityInput[] = [
    { id: 'runner', name: 'Runner', links: [{ metric: run, weight: 2 }], pauses: [] },
    { id: 'parent', name: 'Parent', links: [{ metric: run, weight: 2 }], pauses: [] },
    { id: 'writer', name: 'Writer', links: [{ metric: def('read', { unit: 'pages' }), weight: 2 }], pauses: [] },
  ];
  return { data, identities };
}

describe('votesFor', () => {
  it('counts manual entries and completions, not the entries a system logged', () => {
    const { data } = world([entry('run', '2026-09-20'), entry('run', '2026-09-21', 1, 'c1')], { completions: [done('c1', 'stretch', '2026-09-21')] });
    expect(votesFor('runner', data)).toEqual({ count: 2, since: '2026-09-20' });
  });

  it('a shared metric votes for each identity it supports', () => {
    const { data } = world([entry('run', '2026-09-20')]);
    expect(votesFor('runner', data).count).toBe(1);
    expect(votesFor('parent', data).count).toBe(1);
    expect(votesFor('writer', data).count).toBe(0);
  });
});

describe('unlockPath', () => {
  const runner = { links: [{ metric: def('run'), weight: 2 as const }] };
  const states = (s: ReturnType<typeof unlockPath>) => s.map((x) => x.state);

  it('starts with the first entry active and the rest locked', () => {
    expect(states(unlockPath(runner, [], asOf))).toEqual(['active', 'locked', 'locked', 'locked']);
  });

  it('counts days toward alignment, unlocking on day 7', () => {
    const day4 = unlockPath(runner, [{ metricId: 'run', value: 1, day: addDays(asOf, -3) }], asOf);
    expect(states(day4)).toEqual(['done', 'active', 'locked', 'locked']);
    expect(day4[1]).toMatchObject({ days: 4, of: 7, unlocksOn: addDays(asOf, 3) });
    const day7 = unlockPath(runner, [{ metricId: 'run', value: 1, day: addDays(asOf, -6) }], asOf);
    expect(states(day7)).toEqual(['done', 'done', 'active', 'locked']);
  });

  it('insights unlock on day 28 of any data', () => {
    const points = [{ metricId: 'run', value: 1, day: addDays(asOf, -27) }];
    expect(unlockPath(runner, points, asOf)[2].state).toBe('done');
    expect(unlockPath(runner, points, addDays(asOf, -1))[2].state).toBe('active');
  });
});

describe('momentFor', () => {
  const add = (value: number, day = asOf) => ({ kind: 'entry' as const, metricId: 'run', value, day });

  it('a first vote beats everything else', () => {
    const { data, identities } = world([]);
    expect(momentFor(data, add(20), identities, asOf)?.title).toBe('First vote for Runner');
  });

  it('celebrates the alignment unlock only on the first log after it', () => {
    const first = entry('run', addDays(asOf, -8), 1);
    const { data, identities } = world([first]);
    expect(momentFor(data, add(1), identities, asOf)?.title).toBe('Alignment unlocked');
    const { data: again } = world([first, entry('run', addDays(asOf, -1), 1)]);
    expect(momentFor(again, add(1), identities, asOf)).toBeNull();
  });

  it('fires goal reached only on the entry that crosses the target', () => {
    // Entries since the Monday this week: 10 of 14 mi; earlier history so nothing unlocks today.
    const history = [entry('run', '2026-08-01', 1), entry('run', '2026-09-21', 5), entry('run', '2026-09-22', 5)];
    const { data, identities } = world(history);
    expect(momentFor(data, add(4), identities, asOf)?.title).toBe('Run: goal reached');
    const { data: past } = world([...history, entry('run', asOf, 4)]);
    expect(momentFor(past, add(1), identities, asOf)?.title).not.toBe('Run: goal reached');
  });

  // Something logged yesterday, so the insights unlock has already been seen.
  const recent = () => entry('read', addDays(asOf, -1), 5);

  it('a personal best needs five earlier entries and an "at least" goal', () => {
    const four = [recent(), ...['2026-08-01', '2026-08-08', '2026-08-15', '2026-08-22'].map((d) => entry('run', d, 3))];
    const { data, identities } = world(four, { runDef: def('run', { period: 'month', target: 1000 }) });
    expect(momentFor(data, add(9), identities, asOf)).toBeNull();

    const five = [...four, entry('run', '2026-08-29', 3)];
    const w = world(five, { runDef: def('run', { period: 'month', target: 1000 }) });
    expect(momentFor(w.data, add(9), w.identities, asOf)?.title).toBe('Best run yet');

    const atMost = world(five, { runDef: def('run', { period: 'month', target: 1000, direction: 'atMost' }) });
    expect(momentFor(atMost.data, add(9), atMost.identities, asOf)).toBeNull();
  });

  it('marks vote milestones', () => {
    expect(isVoteMilestone(10)).toBe(true);
    expect(isVoteMilestone(25)).toBe(true);
    expect(isVoteMilestone(11)).toBe(false);
    expect(isVoteMilestone(1000)).toBe(true);
    const nine = [recent(), ...Array.from({ length: 9 }, (_, i) => entry('run', addDays('2026-08-01', i), 1))];
    const { data, identities } = world(nine, { runDef: def('run', { target: 1000 }) });
    expect(momentFor(data, add(1), identities, asOf)?.title).toBe('10 votes for Runner');
  });

  it('a log nobody is linked to has no moment', () => {
    const { data, identities } = world([]);
    expect(momentFor(data, { kind: 'entry', metricId: 'ghost', value: 1, day: asOf }, identities, asOf)).toBeNull();
  });

  it('entry points line up with the snapshot', () => {
    expect(toEntryPoint(entry('run', asOf, 2)).day).toBe(asOf);
  });
});

describe('restart', () => {
  it('votes count from the restart day', () => {
    const { data } = world([entry('run', '2026-09-01'), entry('run', '2026-09-20'), entry('run', '2026-09-22')]);
    expect(votesFor('runner', data, '2026-09-20')).toEqual({ count: 2, since: '2026-09-20' });
  });

  it('the getting-started path starts over from the restart', () => {
    const runner = { links: [{ metric: def('run'), weight: 2 as const }], since: asOf };
    const points = [{ metricId: 'run', value: 1, day: '2026-08-01' }];
    expect(unlockPath(runner, points, asOf)[0].state).toBe('active');
    expect(unlockPath({ ...runner, since: null }, points, asOf)[1].state).toBe('done');
  });

  it('the first log after a restart is a fresh start', () => {
    const { data, identities } = world([entry('run', '2026-08-01')]);
    const restarted = identities.map((i) => (i.id === 'runner' ? { ...i, since: asOf } : i));
    expect(momentFor(data, { kind: 'entry', metricId: 'run', value: 1, day: asOf }, restarted, asOf)?.title).toBe('A fresh start for Runner');
  });
});

describe('intentions as votes', () => {
  it('a done intention with no metric is a vote; one that logged a value counts through its entry', () => {
    const { data } = world([]);
    const plan = (over: object) => ({ id: 'p', createdAt: 0, updatedAt: 0, deletedAt: null, day: asOf, time: null, kind: 'intention', systemId: null, identityId: 'runner', title: 'x', metricId: null, amount: null, status: 'done', entryId: null, position: 0, ...over });
    expect(votesFor('runner', { ...data, plans: [plan({})] } as never).count).toBe(1);
    expect(votesFor('runner', { ...data, plans: [plan({ entryId: 'e1' })] } as never).count).toBe(0);
    expect(votesFor('runner', { ...data, plans: [plan({ status: 'planned' })] } as never).count).toBe(0);
  });
});
