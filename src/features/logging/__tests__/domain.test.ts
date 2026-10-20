/// <reference types="jest" />
import { dayIdentities, firstLogDay, type LogData, logByDay } from '@/features/logging/domain';
import type { Entry } from '@/features/logging/model';
import type { IdentityMetric, Metric } from '@/features/metrics/model';
import type { System, SystemCompletion, SystemIdentity } from '@/features/systems/model';
import { parseDay } from '@/shared/lib/dates';

const row = { createdAt: 0, updatedAt: 0, deletedAt: null };
const at = (day: string, hour = 9) => parseDay(day).getTime() + hour * 3_600_000;

const metric = (id: string) => ({ ...row, id, name: id, unit: 'x' }) as unknown as Metric;
const link = (identityId: string, metricId: string) => ({ ...row, id: `${identityId}-${metricId}`, identityId, metricId }) as unknown as IdentityMetric;
const entry = (id: string, metricId: string, day: string, hour?: number) =>
  ({ ...row, id, metricId, value: 1, loggedAt: at(day, hour), source: 'manual', systemCompletionId: null }) as unknown as Entry;
const system = (id: string) => ({ ...row, id, name: id }) as unknown as System;
const sysLink = (systemId: string, identityId: string) => ({ ...row, id: `${systemId}-${identityId}`, systemId, identityId }) as unknown as SystemIdentity;
const done = (id: string, systemId: string, date: string) => ({ ...row, id, systemId, date }) as unknown as SystemCompletion;

// run → runner + parent (shared metric), read → writer; stretch system → runner.
const data: LogData = {
  metrics: [metric('run'), metric('read')],
  links: [link('runner', 'run'), link('parent', 'run'), link('writer', 'read')],
  entries: [entry('e2', 'run', '2026-09-22', 18), entry('e1', 'run', '2026-09-22', 7), entry('e3', 'read', '2026-09-23')],
  systems: [system('stretch')],
  systemIdentities: [sysLink('stretch', 'runner')],
  completions: [done('c1', 'stretch', '2026-09-24')],
};

describe('logByDay', () => {
  it('groups entries and completed systems by day, entries in time order', () => {
    const log = logByDay(data);
    expect([...log.keys()].sort()).toEqual(['2026-09-22', '2026-09-23', '2026-09-24']);
    expect(log.get('2026-09-22')!.entries.map((e) => e.entry.id)).toEqual(['e1', 'e2']);
    expect(log.get('2026-09-24')!.systems.map((s) => s.system.id)).toEqual(['stretch']);
  });

  it('a shared metric shows under every identity it is linked to', () => {
    expect(logByDay(data, 'runner').get('2026-09-22')!.entries).toHaveLength(2);
    expect(logByDay(data, 'parent').get('2026-09-22')!.entries).toHaveLength(2);
  });

  it('filtering leaves out days with nothing for that identity', () => {
    const writer = logByDay(data, 'writer');
    expect([...writer.keys()]).toEqual(['2026-09-23']);
    const parent = logByDay(data, 'parent');
    expect(parent.has('2026-09-24')).toBe(false);
  });

  it('completed systems filter through their identities', () => {
    expect(logByDay(data, 'runner').get('2026-09-24')!.systems).toHaveLength(1);
    expect(logByDay(data, 'writer').get('2026-09-24')).toBeUndefined();
  });
});

describe('dayIdentities', () => {
  it('lists identities with anything that day, in the given order', () => {
    const log = logByDay(data);
    expect(dayIdentities(log.get('2026-09-22')!, ['writer', 'parent', 'runner'])).toEqual(['parent', 'runner']);
    expect(dayIdentities(log.get('2026-09-24')!, ['writer', 'parent', 'runner'])).toEqual(['runner']);
  });

  it('is just the filtered identity when filtering', () => {
    const log = logByDay(data, 'parent');
    expect(dayIdentities(log.get('2026-09-22')!, ['runner', 'parent'], 'parent')).toEqual(['parent']);
  });
});

describe('firstLogDay', () => {
  it('is the earliest entry or completion', () => {
    expect(firstLogDay(data)).toBe('2026-09-22');
    expect(firstLogDay({ entries: [], completions: [done('c', 's', '2026-01-02')] })).toBe('2026-01-02');
    expect(firstLogDay({ entries: [], completions: [] })).toBeNull();
  });
});
