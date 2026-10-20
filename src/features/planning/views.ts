// Derived, read-only plan views over the snapshot.
import { useShallow } from 'zustand/react/shallow';

import type { PlanData } from '@/features/planning/domain';
import { type Snapshot, useData } from '@/shared/store/data';

export const planDataOf = (s: Snapshot): PlanData => ({
  plans: s.plans,
  systems: s.systems,
  systemIdentities: s.systemIdentities,
  completions: s.completions,
  identities: s.identities,
  pauses: s.pauses,
});

/** The snapshot slices planning reads; stable until one of them changes. */
export function usePlanData(): PlanData {
  return useData(useShallow(planDataOf));
}
