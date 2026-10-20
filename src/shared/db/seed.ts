// Demo data matching the spec's wireframes (Maya: Runner, Present parent, Writer, Financially steady, Musician).
// Dev-only: Settings › "Load demo data".
import { randomUUID } from 'expo-crypto';

import { identities, identityPriorityHistory } from '@/features/identities/model';
import { plans } from '@/features/planning/model';
import { entries } from '@/features/logging/model';
import { identityMetrics, metrics } from '@/features/metrics/model';
import type { MetricInput } from '@/features/metrics/repo';
import { systemCompletions, systemIdentities, systems, systemSteps } from '@/features/systems/model';
import { DATA_TABLES } from '@/shared/db/backup';
import { db, sqlite } from '@/shared/db/client';
import { addDays, daysBetween, parseDay, today, weekStart } from '@/shared/lib/dates';


export function clearAll() {
  sqlite.withTransactionSync(() => {
    for (const t of DATA_TABLES) sqlite.runSync(`DELETE FROM ${t}`);
  });
}

// Deterministic PRNG so demo numbers are stable between reloads.
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function seedDemo() {
  clearAll();
  const rand = rng(42);
  const now = Date.now();
  const base = () => ({ id: randomUUID(), createdAt: now, updatedAt: now, deletedAt: null });
  const end = today();
  const start = addDays(end, -460);

  const metricDefs: Record<string, MetricInput & { defaultAmount: number; step: number }> = {
    distance: { name: 'Running distance', aggregation: 'total', unit: 'mi', target: 15, period: 'week', direction: 'atLeast', defaultAmount: 3, step: 0.5 },
    runs: { name: 'Runs', aggregation: 'count', unit: 'runs', target: 3, period: 'week', direction: 'atLeast', defaultAmount: 1, step: 1 },
    longRuns: { name: 'Long runs', aggregation: 'count', unit: 'long runs', target: 1, period: 'week', direction: 'atLeast', defaultAmount: 1, step: 1 },
    strength: { name: 'Strength training', aggregation: 'count', unit: 'sessions', target: 2, period: 'week', direction: 'atLeast', defaultAmount: 1, step: 1 },
    sleep: { name: 'Sleep', aggregation: 'average', unit: 'h', target: 7.5, period: 'day', direction: 'atLeast', defaultAmount: 7, step: 0.25 },
    drinks: { name: 'Drinks', aggregation: 'total', unit: 'drinks', target: 3, period: 'week', direction: 'atMost', defaultAmount: 1, step: 1 },
    leo: { name: 'Quality time with Leo', aggregation: 'total', unit: 'h', target: 12, period: 'week', direction: 'atLeast', defaultAmount: 1, step: 0.5 },
    phoneFree: { name: 'Phone-free evenings', aggregation: 'count', unit: 'evenings', target: 4, period: 'week', direction: 'atLeast', defaultAmount: 1, step: 1 },
    words: { name: 'Words written', aggregation: 'total', unit: 'words', target: 2500, period: 'week', direction: 'atLeast', defaultAmount: 500, step: 50 },
    reading: { name: 'Reading', aggregation: 'total', unit: 'min', target: 120, period: 'week', direction: 'atLeast', defaultAmount: 20, step: 5 },
    saved: { name: 'Money saved', aggregation: 'total', unit: '$', target: 900, period: 'month', direction: 'atLeast', defaultAmount: 50, step: 10 },
    budget: { name: 'Budget check-ins', aggregation: 'count', unit: 'check-ins', target: 1, period: 'week', direction: 'atLeast', defaultAmount: 1, step: 1 },
    guitar: { name: 'Guitar practice', aggregation: 'total', unit: 'min', target: 120, period: 'week', direction: 'atLeast', defaultAmount: 20, step: 5 },
  };
  const mid: Record<string, string> = {};

  const ids: Record<string, string> = {};
  const identityDefs = [
    { key: 'runner', name: 'Runner', priority: 'core', marker: '🏃', accent: 'runner', description: 'I want running to be a steady part of my week, and to run a half marathon next spring.', links: [['distance', 4], ['runs', 2], ['longRuns', 2], ['strength', 1], ['sleep', 1], ['drinks', 1]] },
    { key: 'parent', name: 'Present parent', priority: 'core', marker: '🧸', accent: 'parent', description: 'Fully there for Leo, not half on my phone.', links: [['leo', 4], ['phoneFree', 2], ['sleep', 1], ['drinks', 1]] },
    { key: 'writer', name: 'Writer', priority: 'important', marker: '✍️', accent: 'writer', description: 'Write most days and finish the draft.', links: [['words', 4], ['reading', 2], ['sleep', 1]] },
    { key: 'financial', name: 'Financially steady', priority: 'important', marker: '💰', accent: 'financial', description: 'Spend on purpose and save every month.', links: [['saved', 4], ['budget', 2]] },
    { key: 'musician', name: 'Musician', priority: 'supporting', marker: '🎸', accent: 'musician', description: 'Keep playing, even a little.', links: [['guitar', 4]] },
  ] as const;

  const createdAt = parseDay(start).getTime();
  db.transaction((tx) => {
    for (const [k, def] of Object.entries(metricDefs)) {
      const row = { ...base(), createdAt, source: 'manual' as const, ...def };
      mid[k] = row.id;
      tx.insert(metrics).values(row).run();
    }
    for (const d of identityDefs) {
      const id = randomUUID();
      ids[d.key] = id;
      tx.insert(identities)
        .values({ id, createdAt, updatedAt: now, deletedAt: null, name: d.name, description: d.description, priority: d.priority, marker: d.marker, accent: d.accent, archivedAt: null })
        .run();
      tx.insert(identityPriorityHistory).values({ ...base(), identityId: id, priority: d.priority, fromDate: start }).run();
      for (const [m, w] of d.links) tx.insert(identityMetrics).values({ ...base(), identityId: id, metricId: mid[m], weight: w }).run();
    }

    const add = (m: string, day: string, value: number, hour = 7) => {
      const t = parseDay(day).getTime() + hour * 3600_000 + Math.floor(rand() * 50) * 60_000;
      tx.insert(entries).values({ ...base(), metricId: mid[m], value: Math.round(value * 10) / 10, loggedAt: t, source: 'manual', systemCompletionId: null }).run();
    };

    const days = daysBetween(start, end);
    const total = days.length;
    let weekSleepGood = true;
    days.forEach((day, i) => {
      const p = i / total; // 0 → 1 over the period: Maya slowly improves
      const dow = parseDay(day).getDay();
      if (dow === 1) weekSleepGood = rand() < 0.55;

      // Sleep: daily, ~2 skipped nights a month
      if (rand() > 0.07) add('sleep', day, (weekSleepGood ? 7.4 : 6.6) + (rand() - 0.5) * 0.8, 6);

      // Running: Tue / Thu / Sat, mileage grows; better-slept weeks run longer
      const runDay = dow === 2 || dow === 4 || dow === 6;
      if (runDay && rand() < 0.72 + p * 0.22) {
        const longRun = dow === 6 && rand() < 0.8;
        const miles = (longRun ? 3.6 + p * 2.4 : 1.8 + p * 1.2) * (weekSleepGood ? 1.12 : 0.88) + rand() * 0.6;
        add('distance', day, miles, 18);
        add('runs', day, 1, 18);
        if (longRun) add('longRuns', day, 1, 18);
      }
      if ((dow === 1 || dow === 5) && rand() < 0.6 + p * 0.2) add('strength', day, 1, 7);
      if ((dow === 5 || dow === 6) && rand() < 0.6) add('drinks', day, 1 + Math.floor(rand() * 2), 20);

      // Parent
      if (rand() < 0.8) add('leo', day, 0.7 + rand() * 1.1 + (dow === 0 || dow === 6 ? 1.2 : 0), 17);
      if (rand() < 0.5 + p * 0.1) add('phoneFree', day, 1, 21);

      // Writer: steady around 2,100–2,400 words / wk
      if (rand() < 0.62) add('words', day, 350 + rand() * 300, 8);
      if (rand() < 0.5) add('reading', day, 15 + rand() * 25, 22);

      // Financial
      if (dow === 0 && rand() < 0.75) add('budget', day, 1, 19);
      if (parseDay(day).getDate() % 7 === 1) add('saved', day, 110 + rand() * 60 + p * 40, 12);

      // Musician: slipping lately
      if (rand() < 0.35 - (p > 0.9 ? 0.1 : 0)) add('guitar', day, 15 + rand() * 20, 20);
    });

    // Systems
    const sys = [
      { name: 'Run days', cue: 'Tue, Thu and Sat, after coffee', frequency: 'weekly' as const, timesPerWeek: 3, steps: [['Lay out kit the night before', null], ['Five-minute warm-up walk', null], ['Run', 'runs'], ['Stretch for 10 minutes', null]], identities: ['runner'], days: [2, 4, 6], rate: 0.83 },
      { name: 'Strength circuit', cue: 'Monday and Friday, 7 AM', frequency: 'weekly' as const, timesPerWeek: 2, steps: [['Mobility warm-up', null], ['Circuit × 3', 'strength']], identities: ['runner'], days: [1, 5], rate: 0.55 },
      { name: 'Wind-down', cue: 'When the 9:30 PM alarm goes off', frequency: 'daily' as const, timesPerWeek: 7, steps: [['Phone on the charger in the kitchen', 'phoneFree'], ['Read for 20 minutes', 'reading'], ['Lights out by 10:30', null]], identities: ['runner', 'parent', 'writer'], days: [0, 1, 2, 3, 4, 5, 6], rate: 0.6 },
    ];
    const sysIds: Record<string, string> = {};
    const doneDays = new Set<string>();
    for (const s of sys) {
      const sid = randomUUID();
      sysIds[s.name] = sid;
      tx.insert(systems).values({ id: sid, createdAt, updatedAt: now, deletedAt: null, name: s.name, description: null, cue: s.cue, frequency: s.frequency, timesPerWeek: s.timesPerWeek }).run();
      s.steps.forEach(([name, m], position) =>
        tx.insert(systemSteps).values({ ...base(), systemId: sid, name: name as string, position, metricId: m ? mid[m] : null }).run(),
      );
      for (const k of s.identities) tx.insert(systemIdentities).values({ ...base(), systemId: sid, identityId: ids[k] }).run();
      for (const day of daysBetween(addDays(end, -60), addDays(end, -1))) {
        if (s.days.includes(parseDay(day).getDay()) && rand() < s.rate) {
          tx.insert(systemCompletions).values({ ...base(), systemId: sid, date: day }).run();
          doneDays.add(`${sid}:${day}`);
        }
      }
    }

    // Plans: last week and this week of sessions on each system's usual days, plus a few intentions.
    const plan = (day: string, time: string | null, more: Partial<typeof plans.$inferInsert>, position = 0) =>
      tx.insert(plans)
        .values({ ...base(), day, time, kind: 'system', systemId: null, identityId: null, title: null, metricId: null, amount: null, status: 'planned', entryId: null, position, ...more })
        .run();
    const times: Record<string, string> = { 'Run days': '07:00', 'Strength circuit': '07:00', 'Wind-down': '21:30' };
    for (const day of daysBetween(addDays(weekStart(end), -7), addDays(weekStart(end), 6))) {
      for (const s of sys) {
        if (!s.days.includes(parseDay(day).getDay())) continue;
        const sid = sysIds[s.name];
        // A past session that didn't happen is sometimes a conscious "not today".
        const skipped = day < end && !doneDays.has(`${sid}:${day}`) && rand() < 0.4;
        plan(day, times[s.name], { kind: 'system', systemId: sid, status: skipped ? 'skipped' : 'planned' });
      }
    }
    const intention = (day: string, time: string | null, identity: string, title: string, status: 'planned' | 'done' = 'planned', metric?: { key: string; amount: number }) =>
      plan(day, time, { kind: 'intention', identityId: ids[identity], title, status, metricId: metric ? mid[metric.key] : null, amount: metric?.amount ?? null }, 1);
    intention(addDays(end, -6), null, 'financial', 'Review this month’s subscriptions', 'done');
    intention(addDays(end, -3), '18:00', 'parent', 'Bike ride with Leo', 'done');
    intention(addDays(end, -1), null, 'musician', 'Learn the bridge of “Blackbird”', 'done');
    intention(addDays(end, -1), '20:00', 'writer', 'Outline chapter 4');
    intention(end, '13:00', 'parent', 'Call mom after lunch');
    intention(end, null, 'writer', 'Draft the opening scene', 'planned', { key: 'words', amount: 500 });
    intention(addDays(end, 1), '17:30', 'parent', 'Pick Leo up and go to the park');
  });
}
