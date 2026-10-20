// Derived, read-only identity views over the snapshot. Nothing here is stored.
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { activePause, type Alignment, alignmentDelta, pausedDays, sinceRestart } from '@/features/identities/domain';
import type { Identity, Pause, Priority } from '@/features/identities/model';
import type { IdentityInput } from '@/features/insights/domain';
import { type EntryPoint, type MetricDef, type Trend, trendFor, weeklySeries } from '@/features/metrics/domain';
import type { Metric, Weight } from '@/features/metrics/model';
import { today } from '@/shared/lib/dates';
import { pointsOf, type Snapshot, useData } from '@/shared/store/data';

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
  /** Every paused day up to today; left out of trends and charts. */
  paused: Set<string>;
  alignment: Alignment;
  delta: number | null;
  headline: { metric: Metric; trend: Trend; spark: (number | null)[] } | null;
}

export function linksFor(s: Pick<Snapshot, 'metrics' | 'links'>, identityId: string): LinkedMetric[] {
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
      since: i.restartedAt,
    }));
}

/** The snapshot slices identity views read. */
type ViewData = Pick<Snapshot, 'identities' | 'metrics' | 'links' | 'pauses' | 'pointsByMetric'>;
const pickViewData = (s: Snapshot): ViewData => ({
  identities: s.identities,
  metrics: s.metrics,
  links: s.links,
  pauses: s.pauses,
  pointsByMetric: s.pointsByMetric,
});

/** The points an identity counts: its metrics' entries, from its restart day on. */
export function identityPoints(s: Pick<Snapshot, 'pointsByMetric'>, links: { metric: { id: string } }[], since: string | null): EntryPoint[] {
  return sinceRestart(
    links.flatMap((l) => pointsOf(s, l.metric.id)),
    since,
  );
}

function buildView(s: ViewData, identity: Identity, asOf: string): IdentityView {
  const links = linksFor(s, identity.id);
  const ps = s.pauses.filter((p) => p.identityId === identity.id);
  const points = identityPoints(s, links, identity.restartedAt);
  const paused = pausedDays(ps, ps.reduce((m, p) => (p.startDate < m ? p.startDate : m), asOf), asOf);
  const { now, delta } = alignmentDelta(links, points, ps, asOf);
  const top = links[0];
  return {
    identity,
    links,
    pauses: ps,
    pause: activePause(ps, asOf),
    paused,
    alignment: now,
    delta,
    headline: top
      ? {
          metric: top.metric,
          trend: trendFor(top.metric, points, asOf, paused),
          spark: weeklySeries(top.metric, points, asOf, 12, paused),
        }
      : null,
  };
}

export function useIdentityViews(includeArchived = false): IdentityView[] {
  const s = useData(useShallow(pickViewData));
  return useMemo(() => {
    const asOf = today();
    return s.identities.filter((i) => includeArchived || i.archivedAt === null).map((i) => buildView(s, i, asOf));
  }, [s, includeArchived]);
}

export function useIdentityView(id: string | undefined): IdentityView | null {
  const s = useData(useShallow(pickViewData));
  return useMemo(() => {
    const identity = s.identities.find((i) => i.id === id);
    return identity ? buildView(s, identity, today()) : null;
  }, [s, id]);
}

/** Identities a metric counts toward. */
export function supportersOf(s: Snapshot, metricId: string) {
  const ids = new Set(s.links.filter((l) => l.metricId === metricId).map((l) => l.identityId));
  return s.identities.filter((i) => ids.has(i.id) && i.archivedAt === null);
}
