import type { Entry } from '@/features/logging/model';
import type { IdentityMetric, Metric } from '@/features/metrics/model';
import type { Plan } from '@/features/planning/model';
import type { System, SystemCompletion, SystemIdentity } from '@/features/systems/model';
import { dayKey } from '@/shared/lib/dates';

export interface LogData {
  entries: Entry[];
  metrics: Metric[];
  links: IdentityMetric[];
  completions: SystemCompletion[];
  systems: System[];
  systemIdentities: SystemIdentity[];
  /** Done intentions with no metric are votes too. */
  plans?: Plan[];
}

export interface DayLog {
  entries: { entry: Entry; metric: Metric; identityIds: string[] }[];
  systems: { completion: SystemCompletion; system: System; identityIds: string[] }[];
}

/** Everything logged, grouped by day: metric entries and completed systems with the identities they count toward. */
export function logByDay(data: LogData, identityId: string | null = null): Map<string, DayLog> {
  const metricById = new Map(data.metrics.map((m) => [m.id, m]));
  const systemById = new Map(data.systems.map((s) => [s.id, s]));
  const metricIdentities = new Map<string, string[]>();
  for (const l of data.links) metricIdentities.set(l.metricId, [...(metricIdentities.get(l.metricId) ?? []), l.identityId]);
  const systemIdentities = new Map<string, string[]>();
  for (const l of data.systemIdentities) systemIdentities.set(l.systemId, [...(systemIdentities.get(l.systemId) ?? []), l.identityId]);
  const keep = (ids: string[]) => identityId === null || ids.includes(identityId);

  const out = new Map<string, DayLog>();
  const dayOf = (day: string) => {
    let d = out.get(day);
    if (!d) out.set(day, (d = { entries: [], systems: [] }));
    return d;
  };
  for (const entry of data.entries) {
    const metric = metricById.get(entry.metricId);
    const identityIds = metricIdentities.get(entry.metricId) ?? [];
    if (!metric || !keep(identityIds)) continue;
    dayOf(dayKey(entry.loggedAt)).entries.push({ entry, metric, identityIds });
  }
  for (const completion of data.completions) {
    const system = systemById.get(completion.systemId);
    const identityIds = systemIdentities.get(completion.systemId) ?? [];
    if (!system || !keep(identityIds)) continue;
    dayOf(completion.date).systems.push({ completion, system, identityIds });
  }
  for (const d of out.values()) d.entries.sort((a, b) => a.entry.loggedAt - b.entry.loggedAt);
  return out;
}

/** The identities with anything logged that day, in `order`. */
export function dayIdentities(day: DayLog, order: string[], identityId: string | null = null): string[] {
  if (identityId) return [identityId];
  const ids = new Set([...day.entries.flatMap((e) => e.identityIds), ...day.systems.flatMap((s) => s.identityIds)]);
  return order.filter((id) => ids.has(id));
}

/** The earliest day anything was logged, or null. */
export function firstLogDay(data: Pick<LogData, 'entries' | 'completions'>): string | null {
  let first: string | null = null;
  for (const e of data.entries) {
    const d = dayKey(e.loggedAt);
    if (first === null || d < first) first = d;
  }
  for (const c of data.completions) if (first === null || c.date < first) first = c.date;
  return first;
}
