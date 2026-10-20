// Derived, read-only system views over the snapshot. Nothing here is stored.
import { useMemo } from 'react';

import { adherence, type Adherence } from '@/features/systems/domain';
import { today } from '@/shared/lib/dates';
import { type Snapshot, useData } from '@/shared/store/data';

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
