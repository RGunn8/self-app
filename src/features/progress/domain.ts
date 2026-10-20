import { alignment, BASELINE_DAYS, sinceRestart } from '@/features/identities/domain';
import { INSIGHTS_MIN_DAYS, type IdentityInput } from '@/features/insights/domain';
import type { LogData } from '@/features/logging/domain';
import { aggregate, type EntryPoint, formatValue, periodStart, toEntryPoint } from '@/features/metrics/domain';
import { addDays, dayKey, diffDays, fmt, monthEnd } from '@/shared/lib/dates';

// Votes ---------------------------------------------------------------------------------------

/**
 * Every manual entry on a linked metric and every completed linked system is a vote for the
 * identity. Entries a system logged ride on its completion, so they aren't counted twice.
 * The count only grows; it never resets (a restart counts from its day, and can be undone).
 */
export function votesFor(identityId: string, data: LogData, restartedAt: string | null = null): { count: number; since: string | null } {
  const metricIds = new Set(data.links.filter((l) => l.identityId === identityId).map((l) => l.metricId));
  const systemIds = new Set(data.systemIdentities.filter((l) => l.identityId === identityId).map((l) => l.systemId));
  let count = 0;
  let since: string | null = null;
  const see = (day: string) => {
    if (restartedAt && day < restartedAt) return;
    count++;
    if (since === null || day < since) since = day;
  };
  for (const e of data.entries) if (e.systemCompletionId === null && metricIds.has(e.metricId)) see(dayKey(e.loggedAt));
  for (const c of data.completions) if (systemIds.has(c.systemId)) see(c.date);
  // An intention that logged a value already counts through its entry.
  for (const p of data.plans ?? []) {
    if (p.kind === 'intention' && p.status === 'done' && p.entryId === null && p.identityId === identityId) see(p.day);
  }
  return { count, since };
}

// Unlock path ---------------------------------------------------------------------------------

export type StepKey = 'first' | 'alignment' | 'insights' | 'year';

export interface UnlockStep {
  key: StepKey;
  state: 'done' | 'active' | 'locked';
  /** 0..1 toward this step, for the active one. */
  progress: number;
  /** Days so far and days needed, for the active step's "4 of 7 days". */
  days: number;
  of: number;
  /** The day it unlocks, once the identity has a first entry. */
  unlocksOn: string | null;
}

const YEAR_DAYS = 365;

const firstDay = (points: EntryPoint[]) => points.reduce<string | null>((m, e) => (m === null || e.day < m ? e.day : m), null);

/**
 * What an identity unlocks as it gathers data, using the same gates as the real features:
 * alignment after BASELINE_DAYS of its own data, insights after INSIGHTS_MIN_DAYS of any data.
 */
export function unlockPath(identity: Pick<IdentityInput, 'links' | 'since'>, points: EntryPoint[], asOf: string): UnlockStep[] {
  const ids = new Set(identity.links.map((l) => l.metric.id));
  const first = firstDay(sinceRestart(points, identity.since).filter((e) => ids.has(e.metricId) && e.day <= asOf));
  const appFirst = firstDay(points.filter((e) => e.day <= asOf));
  const span = first ? diffDays(asOf, first) + 1 : 0;
  const appSpan = appFirst ? diffDays(asOf, appFirst) + 1 : 0;

  const raw: { key: StepKey; days: number; of: number; unlocksOn: string | null }[] = [
    { key: 'first', days: first ? 1 : 0, of: 1, unlocksOn: first },
    { key: 'alignment', days: span, of: BASELINE_DAYS, unlocksOn: first ? addDays(first, BASELINE_DAYS - 1) : null },
    { key: 'insights', days: appSpan, of: INSIGHTS_MIN_DAYS, unlocksOn: appFirst ? addDays(appFirst, INSIGHTS_MIN_DAYS - 1) : null },
    { key: 'year', days: span, of: YEAR_DAYS, unlocksOn: first ? addDays(first, YEAR_DAYS) : null },
  ];
  let activeTaken = false;
  return raw.map((r) => {
    const done = first !== null && r.days >= r.of;
    const state = done ? 'done' : activeTaken ? 'locked' : 'active';
    if (state === 'active') activeTaken = true;
    return { ...r, days: Math.min(r.days, r.of), state, progress: Math.max(0, Math.min(1, r.days / r.of)) };
  });
}

// Moments -------------------------------------------------------------------------------------

export interface Moment {
  identityId: string;
  title: string;
  body: string;
}

export type Added =
  | { kind: 'entry'; metricId: string; value: number; day: string }
  | { kind: 'system'; systemId: string; day: string }
  | { kind: 'intention'; identityId: string; day: string };

const VOTE_MILESTONES = [10, 25, 50, 100, 250, 500];
export const isVoteMilestone = (n: number) => VOTE_MILESTONES.includes(n) || (n > 500 && n % 500 === 0);
const PB_MIN_ENTRIES = 5;

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Identities the added log counts toward, in identity order. */
export function identitiesForLog(added: Added, data: LogData, identities: IdentityInput[]): IdentityInput[] {
  const ids =
    added.kind === 'entry'
      ? data.links.filter((l) => l.metricId === added.metricId).map((l) => l.identityId)
      : added.kind === 'system'
        ? data.systemIdentities.filter((l) => l.systemId === added.systemId).map((l) => l.identityId)
        : [added.identityId];
  return identities.filter((i) => ids.includes(i.id));
}

/**
 * The single most notable thing about a log that's about to be (or was just) added, judged
 * against the data from before it. Null means an ordinary log: no card, just the quiet toast.
 */
export function momentFor(before: LogData, added: Added, identities: IdentityInput[], asOf: string): Moment | null {
  const supporters = identitiesForLog(added, before, identities);
  if (supporters.length === 0) return null;
  const beforePoints = before.entries.map(toEntryPoint);
  const metric = added.kind === 'entry' ? before.metrics.find((m) => m.id === added.metricId) : undefined;
  const afterPoints = added.kind === 'entry' ? [...beforePoints, { metricId: added.metricId, value: added.value, day: added.day }] : beforePoints;
  const votes = new Map(supporters.map((i) => [i.id, votesFor(i.id, before, i.since ?? null).count]));

  // 1. First vote.
  const fresh = supporters.find((i) => votes.get(i.id) === 0);
  if (fresh) {
    return fresh.since
      ? { identityId: fresh.id, title: `A fresh start for ${fresh.name}`, body: 'The first vote since your restart. Everything counts from here.' }
      : { identityId: fresh.id, title: `First vote for ${fresh.name}`, body: 'Every entry is a vote for who you want to become. This is the first one.' };
  }

  // 2. A step on the path unlocked since the last log.
  for (const i of supporters) {
    const ids = new Set(i.links.map((l) => l.metric.id));
    const systemIds = new Set(before.systemIdentities.filter((l) => l.identityId === i.id).map((l) => l.systemId));
    const voteDays = sinceRestart(
      [...beforePoints.filter((e) => ids.has(e.metricId)), ...before.completions.filter((c) => systemIds.has(c.systemId)).map((c) => ({ day: c.date }))],
      i.since,
    ).map((x) => x.day);
    const loggedSince = (day: string) => voteDays.some((d) => d >= day);
    const appLoggedSince = (day: string) => beforePoints.some((e) => e.day >= day) || before.completions.some((c) => c.date >= day);
    const path = unlockPath(i, beforePoints, asOf);
    const step = (k: StepKey) => path.find((s) => s.key === k)!;
    const al = step('alignment');
    if (al.state === 'done' && al.unlocksOn && !loggedSince(al.unlocksOn)) {
      const a = alignment(i.links, sinceRestart(afterPoints, i.since), i.pauses, asOf);
      return {
        identityId: i.id,
        title: 'Alignment unlocked',
        body: a.status === 'scored' ? `${i.name} is ${a.score}% aligned with who you want to be.` : `${i.name} now has an alignment score.`,
      };
    }
    const ins = step('insights');
    if (ins.state === 'done' && ins.unlocksOn && !appLoggedSince(ins.unlocksOn)) {
      return { identityId: i.id, title: 'Insights unlocked', body: 'Four weeks of data. Patterns are ready on the Insights tab.' };
    }
    const yr = step('year');
    if (yr.state === 'done' && yr.unlocksOn && !loggedSince(yr.unlocksOn)) {
      return { identityId: i.id, title: `A year as ${i.name}`, body: 'Your journey now compares this year with the last.' };
    }
  }

  if (added.kind === 'entry' && metric) {
    const host = supporters[0];
    const prior = beforePoints.filter((e) => e.metricId === metric.id);
    const additive = metric.aggregation === 'total' || metric.aggregation === 'count';

    // 3. Goal reached for this week or month.
    if (additive && metric.direction === 'atLeast' && metric.period !== 'day') {
      const from = periodStart(metric.period, added.day);
      const to = metric.period === 'week' ? addDays(from, 6) : monthEnd(from);
      const inPeriod = prior.filter((e) => e.day >= from && e.day <= to).map((e) => e.value);
      const was = aggregate(inPeriod, metric.aggregation) ?? 0;
      const now = aggregate([...inPeriod, added.value], metric.aggregation) ?? 0;
      if (was < metric.target && now >= metric.target) {
        return {
          identityId: host.id,
          title: `${metric.name}: goal reached`,
          body: `${formatValue(now)} ${metric.unit} this ${metric.period}. That's the ${formatValue(metric.target)} ${metric.unit} you set out to do.`,
        };
      }
    }

    // 4. Personal best. "At most" goals and counts have no meaningful "most ever".
    if (metric.direction === 'atLeast' && metric.aggregation !== 'count' && metric.aggregation !== 'min' && prior.length >= PB_MIN_ENTRIES) {
      let best: { value: number; day: string } | null = null;
      let mine: number;
      if (metric.period === 'day' && metric.aggregation === 'total') {
        const byDay = new Map<string, number>();
        for (const e of prior) byDay.set(e.day, (byDay.get(e.day) ?? 0) + e.value);
        mine = (byDay.get(added.day) ?? 0) + added.value;
        byDay.delete(added.day);
        for (const [day, value] of byDay) if (!best || value > best.value) best = { value, day };
      } else {
        mine = added.value;
        for (const e of prior) if (!best || e.value > best.value) best = { value: e.value, day: e.day };
      }
      if (best && mine > best.value) {
        return {
          identityId: host.id,
          title: `Best ${lower(metric.name)} yet`,
          body: `${formatValue(mine)} ${metric.unit}, beating ${formatValue(best.value)} ${metric.unit} from ${fmt.short(best.day)}.`,
        };
      }
    }
  }

  // 5. Vote milestones.
  const milestone = supporters.find((i) => isVoteMilestone((votes.get(i.id) ?? 0) + 1));
  if (milestone) {
    const n = (votes.get(milestone.id) ?? 0) + 1;
    return { identityId: milestone.id, title: `${n} votes for ${milestone.name}`, body: 'Each one is a small piece of evidence for who you’re becoming.' };
  }
  return null;
}
