import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { identityInputs } from '@/features/identities/views';
import type { LogData } from '@/features/logging/domain';
import { planDataOf } from '@/features/planning/views';
import { type DayData, type DayScore, dayScore, fullestDays } from '@/features/progress/dayScore';
import { type Added, identitiesForLog, isNewVote, momentFor, type Moment, votesFor } from '@/features/progress/domain';
import { today } from '@/shared/lib/dates';
import { type Snapshot, useData } from '@/shared/store/data';

export function logDataOf(s: Snapshot): LogData {
  return {
    entries: s.entries,
    metrics: s.metrics,
    links: s.links,
    completions: s.completions,
    systems: s.systems,
    systemIdentities: s.systemIdentities,
    plans: s.plans,
  };
}

/**
 * What to say about a log, judged against the snapshot from before it was written:
 * a moment worth a card, or the quiet toast line with the vote it cast.
 */
export function afterLog(before: Snapshot, added: Added, what: string): { moment: Moment | null; line: string } {
  const data = logDataOf(before);
  const identities = identityInputs(before);
  const moment = momentFor(data, added, identities, today());
  const supporters = identitiesForLog(added, data, identities);
  let line = what;
  const newVote = added.kind !== 'entry' || isNewVote(data, added.metricId, added.day);
  if (!newVote) return { moment, line };
  if (supporters.length === 1) line += ` · vote #${votesFor(supporters[0].id, data, supporters[0].since ?? null).count + 1} for ${supporters[0].name}`;
  else if (supporters.length > 1) line += ` · a vote for ${supporters.map((i) => i.name).join(' and ')}`;
  return { moment, line };
}

const dayDataOf = (s: Snapshot): DayData => ({ ...logDataOf(s), ...planDataOf(s) });

/** The day score for `day`, or null when the person hasn't turned it on. */
export function useDayScore(day: string): DayScore | null {
  const data = useData(useShallow(dayDataOf));
  const enabled = useData((s) => s.settings.dayScoreEnabled);
  const planning = useData((s) => s.settings.planningEnabled);
  return useMemo(() => (enabled ? dayScore(day, data, planning) : null), [enabled, day, data, planning]);
}

/** The week's fullest days, or [] when the day score is off. */
export function useFullestDays(weekStartKey: string, asOf: string): string[] {
  const data = useData(useShallow(dayDataOf));
  const enabled = useData((s) => s.settings.dayScoreEnabled);
  const planning = useData((s) => s.settings.planningEnabled);
  return useMemo(() => (enabled ? fullestDays(weekStartKey, asOf, data, planning) : []), [enabled, weekStartKey, asOf, data, planning]);
}
