// Derived, read-only views over the snapshot. Nothing here is stored.
import { useMemo } from 'react';

import type { Identity, Metric, Pause, Priority, Weight } from '@/db/schema';
import { activePause, type Alignment, alignmentDelta } from '@/domain/alignment';
import type { IdentityInput } from '@/domain/insights';
import { type MetricDef, type Trend, trendFor, weeklySeries } from '@/domain/metrics';
import { adherence, type Adherence } from '@/domain/systems';
import { today } from '@/lib/dates';
import { type Snapshot, useData } from './data';

export const PRIORITIES: { key: Priority; label: string; sub: string }[] = [
  { key: 'core', label: 'Core', sub: 'Among the things that matter most right now' },
  { key: 'important', label: 'Important', sub: 'A real priority, alongside others' },
  { key: 'supporting', label: 'Supporting', sub: 'Worth keeping in view' },
];

export interface LinkedMetric {
  metric: Metric;
  weight: Weight;
}

export interface IdentityView {
  identity: Identity;
  links: LinkedMetric[];
  pauses: Pause[];
  pause: Pause | undefined;
  alignment: Alignment;
  delta: number | null;
  headline: { metric: Metric; trend: Trend; spark: (number | null)[] } | null;
}

export function linksFor(s: Snapshot, identityId: string): LinkedMetric[] {
  const byId = new Map(s.metrics.map((m) => [m.id, m]));
  return s.links
    .filter((l) => l.identityId === identityId && byId.has(l.metricId))
    .map((l) => ({ metric: byId.get(l.metricId)!, weight: l.weight }));
}

export function identityInputs(s: Snapshot, includeArchived = false): IdentityInput[] {
  return s.identities
    .filter((i) => includeArchived || i.archivedAt === null)
    .map((i) => ({
      id: i.id,
      name: i.name,
      links: linksFor(s, i.id) as { metric: MetricDef; weight: Weight }[],
      pauses: s.pauses.filter((p) => p.identityId === i.id),
    }));
}

function buildView(s: Snapshot, identity: Identity, asOf: string): IdentityView {
  const links = linksFor(s, identity.id);
  const ps = s.pauses.filter((p) => p.identityId === identity.id);
  const { now, delta } = alignmentDelta(links, s.points, ps, asOf);
  const top = links[0];
  return {
    identity,
    links,
    pauses: ps,
    pause: activePause(ps, asOf),
    alignment: now,
    delta,
    headline: top
      ? {
          metric: top.metric,
          trend: trendFor(top.metric, s.points, asOf),
          spark: weeklySeries(top.metric, s.points, asOf, 12),
        }
      : null,
  };
}

export function useIdentityViews(includeArchived = false): IdentityView[] {
  const s = useData();
  return useMemo(() => {
    const asOf = today();
    return s.identities.filter((i) => includeArchived || i.archivedAt === null).map((i) => buildView(s, i, asOf));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.version, includeArchived]);
}

export function useIdentityView(id: string | undefined): IdentityView | null {
  const s = useData();
  return useMemo(() => {
    const identity = s.identities.find((i) => i.id === id);
    return identity ? buildView(s, identity, today()) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.version, id]);
}

export interface SystemView {
  system: Snapshot['systems'][number];
  steps: Snapshot['steps'];
  identityIds: string[];
  completionDays: string[];
  adherence: Adherence;
  todayCompletion: Snapshot['completions'][number] | undefined;
}

export function useSystemViews(identityId?: string): SystemView[] {
  const s = useData();
  return useMemo(() => {
    const t = today();
    return s.systems
      .map((system) => {
        const identityIds = s.systemIdentities.filter((x) => x.systemId === system.id).map((x) => x.identityId);
        const completions = s.completions.filter((c) => c.systemId === system.id);
        const completionDays = [...new Set(completions.map((c) => c.date))];
        return {
          system,
          steps: s.steps.filter((st) => st.systemId === system.id),
          identityIds,
          completionDays,
          adherence: adherence(system, completionDays, t),
          todayCompletion: completions.find((c) => c.date === t),
        };
      })
      .filter((v) => !identityId || v.identityIds.includes(identityId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.version, identityId]);
}

/** Identities a metric counts toward. */
export function supportersOf(s: Snapshot, metricId: string) {
  const ids = new Set(s.links.filter((l) => l.metricId === metricId).map((l) => l.identityId));
  return s.identities.filter((i) => ids.has(i.id) && i.archivedAt === null);
}
