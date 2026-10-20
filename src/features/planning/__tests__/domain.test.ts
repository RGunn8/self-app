/// <reference types="jest" />
import {
  dayPlan,
  formatTime,
  nextUp,
  fromYesterday,
  type PlanData,
  planningPrompt,
  plansKept,
  remindersToSchedule,
  spreadDays,
  suggestionsFor,
  suggestWeek,
} from '@/features/planning/domain';
import type { Plan } from '@/features/planning/model';
import type { System, SystemCompletion, SystemIdentity } from '@/features/systems/model';
import { addDays, parseDay } from '@/shared/lib/dates';

const row = { createdAt: 0, updatedAt: 0, deletedAt: null };
const monday = '2026-09-21';
const wed = '2026-09-23';

const system = (id: string, frequency: System['frequency'], timesPerWeek = 0) =>
  ({ ...row, id, name: id, description: null, cue: 'cue', frequency, timesPerWeek }) as System;
const sysLink = (systemId: string, identityId: string) => ({ ...row, id: `${systemId}-${identityId}`, systemId, identityId }) as SystemIdentity;
const done = (systemId: string, date: string) => ({ ...row, id: `${systemId}-${date}`, systemId, date }) as SystemCompletion;
let n = 0;
const session = (systemId: string, day: string, time: string | null = null, over: Partial<Plan> = {}): Plan => ({
  ...row,
  id: `p${n++}`,
  day,
  time,
  kind: 'system',
  systemId,
  identityId: null,
  title: null,
  metricId: null,
  amount: null,
  status: 'planned',
  entryId: null,
  position: 0,
  ...over,
});
const intention = (title: string, day: string, over: Partial<Plan> = {}): Plan =>
  session('', day, null, { kind: 'intention', systemId: null, identityId: 'runner', title, ...over });

function data(over: Partial<PlanData> = {}): PlanData {
  return {
    plans: [],
    systems: [system('run', 'weekly', 3), system('stretch', 'daily'), system('massage', 'asNeeded')],
    systemIdentities: [sysLink('run', 'runner'), sysLink('stretch', 'runner'), sysLink('massage', 'runner')],
    completions: [],
    identities: [{ id: 'runner', name: 'Runner', accent: 'runner', archivedAt: null }],
    pauses: [],
    ...over,
  };
}

describe('dayPlan', () => {
  it('puts timed plans first, by time, then anytime ones in order', () => {
    const plans = [session('stretch', wed, null, { position: 1 }), session('run', wed, '18:00'), intention('Stretch calves', wed, { position: 0 }), session('run', wed, '07:00')];
    expect(dayPlan(wed, data({ plans })).map((i) => `${i.time ?? '-'} ${i.title}`)).toEqual(['07:00 run', '18:00 run', '- Stretch calves', '- stretch']);
  });

  it('a session is done when its system was completed that day, and undoing puts it back', () => {
    const plans = [session('run', wed, '07:00')];
    expect(dayPlan(wed, data({ plans, completions: [done('run', wed)] }))[0].status).toBe('done');
    expect(dayPlan(wed, data({ plans }))[0].status).toBe('planned');
  });

  it('drops plans whose system or identity is gone', () => {
    const plans = [session('gone', wed), intention('Orphan', wed, { identityId: 'nobody' })];
    expect(dayPlan(wed, data({ plans }))).toEqual([]);
  });
});

describe('suggestionsFor', () => {
  it('suggests daily systems and weekly ones with sessions left, never as-needed ones', () => {
    expect(suggestionsFor(wed, data()).map((s) => [s.system.id, s.remaining])).toEqual([
      ['stretch', null],
      ['run', 3],
    ]);
  });

  it('counts done and planned sessions against a weekly target', () => {
    const d = data({ completions: [done('run', monday)], plans: [session('run', '2026-09-25')] });
    expect(suggestionsFor(wed, d).find((s) => s.system.id === 'run')?.remaining).toBe(1);
    const full = data({ completions: [done('run', monday)], plans: [session('run', '2026-09-24'), session('run', '2026-09-25')] });
    expect(suggestionsFor(wed, full).some((s) => s.system.id === 'run')).toBe(false);
  });

  it('skips systems already planned or done that day', () => {
    expect(suggestionsFor(wed, data({ plans: [session('stretch', wed)] })).some((s) => s.system.id === 'stretch')).toBe(false);
    expect(suggestionsFor(wed, data({ completions: [done('stretch', wed)] })).some((s) => s.system.id === 'stretch')).toBe(false);
  });

  it('leaves out systems whose identities are all paused', () => {
    const d = data({ pauses: [{ identityId: 'runner', startDate: monday, endDate: null }] });
    expect(suggestionsFor(wed, d)).toEqual([]);
  });

  it('offers the time the system is usually planned for', () => {
    const d = data({ plans: [session('run', '2026-09-14', '07:00'), session('run', '2026-09-16', '07:00'), session('run', '2026-09-18', '18:00')] });
    expect(suggestionsFor(wed, d).find((s) => s.system.id === 'run')?.time).toBe('07:00');
  });
});

describe('suggestWeek', () => {
  it('spreads sessions evenly without history', () => {
    expect(spreadDays(2)).toEqual([0, 3]);
    expect(spreadDays(3)).toEqual([0, 2, 4]);
    expect(spreadDays(5)).toEqual([0, 1, 2, 3, 4]);
  });

  it('uses the weekdays you usually do it, topped up with the spread', () => {
    // Tuesdays and Saturdays over the past weeks.
    const history = [1, 2, 3].flatMap((w) => [done('run', addDays(monday, -7 * w + 1)), done('run', addDays(monday, -7 * w + 5))]);
    const s = suggestWeek(data().systems, history, monday);
    expect(s.get('run')).toEqual([0, 1, 5]);
    expect(s.get('stretch')).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(s.has('massage')).toBe(false);
  });
});

describe('plansKept and carry-over', () => {
  it('counts kept plans up to today, leaving out "not today"', () => {
    const plans = [
      session('run', monday),
      session('run', wed),
      intention('Call coach', wed, { status: 'done' }),
      intention('Foam roll', wed, { status: 'skipped' }),
      session('run', '2026-09-26'),
    ];
    expect(plansKept(monday, wed, data({ plans, completions: [done('run', monday)] }))).toEqual({ kept: 2, total: 3 });
  });

  it('only yesterday’s unfinished plans carry over', () => {
    const plans = [session('run', addDays(wed, -1)), session('run', addDays(wed, -2)), intention('Done one', addDays(wed, -1), { status: 'done' })];
    expect(fromYesterday(wed, data({ plans })).map((i) => i.plan.day)).toEqual([addDays(wed, -1)]);
  });
});

describe('remindersToSchedule', () => {
  const now = parseDay(wed);
  now.setHours(12, 0, 0, 0);

  it('schedules future timed plans in the next 7 days, soonest first', () => {
    const plans = [
      session('run', wed, '18:00'),
      session('run', wed, '07:00'), // already past
      session('stretch', addDays(wed, 1)), // no time
      intention('Call mom', addDays(wed, 2), { time: '17:30' }),
      session('run', addDays(wed, 9), '07:00'), // too far
      intention('Done', addDays(wed, 1), { time: '09:00', status: 'done' }),
    ];
    const r = remindersToSchedule(data({ plans }), now);
    expect(r.map((x) => `${x.title} ${x.at.getDate()}`)).toEqual(['run 23', 'Call mom 25']);
    expect(r[0].body).toBe('For Runner');
  });

  it('caps the number of reminders', () => {
    const plans = Array.from({ length: 80 }, (_, i) => intention(`x${i}`, addDays(wed, 1), { time: '09:00' }));
    expect(remindersToSchedule(data({ plans }), now)).toHaveLength(60);
  });
});

describe('planningPrompt', () => {
  const sunday = '2026-09-20';
  const thursday = '2026-09-24';

  it('invites planning the coming week on Sunday when nothing is planned', () => {
    expect(planningPrompt(sunday, data())).toEqual({ kind: 'week', weekStart: monday, systems: 2 });
  });

  it('on Monday, it’s about this week', () => {
    expect(planningPrompt(monday, data())).toEqual({ kind: 'week', weekStart: monday, systems: 2 });
  });

  it('no week prompt once anything is planned that week', () => {
    expect(planningPrompt(sunday, data({ plans: [session('run', '2026-09-25')] }))).toBeNull();
  });

  it('no week prompt without systems to plan', () => {
    expect(planningPrompt(monday, data({ systems: [system('massage', 'asNeeded')] }))).toBeNull();
  });

  it('mid-week, people who don’t plan see nothing', () => {
    expect(planningPrompt(thursday, data())).toBeNull();
  });

  it('people who planned in the last 10 days get a quiet daily prompt', () => {
    expect(planningPrompt(thursday, data({ plans: [session('run', addDays(thursday, -10))] }))).toEqual({ kind: 'day' });
    expect(planningPrompt(thursday, data({ plans: [session('run', addDays(thursday, -11))] }))).toBeNull();
  });

  it('nothing when today already has a plan', () => {
    expect(planningPrompt(thursday, data({ plans: [session('run', addDays(thursday, -2)), session('stretch', thursday)] }))).toBeNull();
  });
});

describe('archived identities', () => {
  const archived = [{ id: 'runner', name: 'Runner', accent: 'runner', archivedAt: 1 }];

  it('hides their intentions and sessions everywhere, including reminders', () => {
    const plans = [intention('Call coach', wed, { time: '18:00' }), session('run', wed, '19:00')];
    const d = data({ plans, identities: archived });
    expect(dayPlan(wed, d)).toEqual([]);
    const now = parseDay(wed);
    now.setHours(8);
    expect(remindersToSchedule(d, now)).toEqual([]);
  });

  it('they come back on unarchive', () => {
    const plans = [intention('Call coach', wed)];
    expect(dayPlan(wed, data({ plans }))).toHaveLength(1);
  });
});

describe('nextUp', () => {
  const items = (plans: Plan[]) => dayPlan(wed, data({ plans }));
  it('is the next timed plan still ahead', () => {
    const r = nextUp(items([session('run', wed, '07:00'), session('stretch', wed, '18:00')]), '15:00');
    expect(r).toMatchObject({ earlier: false, item: { time: '18:00' } });
  });
  it('falls back to an anytime plan, then to one from earlier', () => {
    expect(nextUp(items([session('run', wed, '07:00'), intention('Read', wed)]), '15:00')?.item.title).toBe('Read');
    expect(nextUp(items([session('run', wed, '07:00')]), '15:00')).toMatchObject({ earlier: true });
  });
});

describe('formatTime', () => {
  it('keeps AM/PM with the time', () => {
    expect(formatTime('17:30')).toBe('5:30\u00A0PM');
  });
});
