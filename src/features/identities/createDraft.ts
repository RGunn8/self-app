// Draft for the 3-step Create identity flow. Nothing is written until "Create".
import { create } from 'zustand';

import type { Priority } from '@/features/identities/model';
import type { Weight } from '@/features/metrics/model';
import type { MetricInput } from '@/features/metrics/repo';
import type { AccentKey } from '@/shared/theme';

export interface DraftMetric extends MetricInput {
  tempId: string;
  weight: Weight;
}

interface CreateDraft {
  name: string;
  description: string;
  priority: Priority;
  marker: string;
  accent: AccentKey;
  newMetrics: DraftMetric[];
  linked: Record<string, Weight>;
  patch: (p: Partial<Omit<CreateDraft, 'patch' | 'reset' | 'addMetric' | 'toggleLink'>>) => void;
  addMetric: (m: DraftMetric) => void;
  toggleLink: (metricId: string) => void;
  reset: () => void;
}

const initial = {
  name: '',
  description: '',
  priority: 'core' as Priority,
  marker: '🌱',
  accent: 'runner' as AccentKey,
  newMetrics: [] as DraftMetric[],
  linked: {} as Record<string, Weight>,
};

export const useCreateDraft = create<CreateDraft>((set) => ({
  ...initial,
  patch: (p) => set(p),
  addMetric: (m) => set((s) => ({ newMetrics: [...s.newMetrics.filter((x) => x.tempId !== m.tempId), m] })),
  toggleLink: (metricId) =>
    set((s) => {
      const linked = { ...s.linked };
      if (linked[metricId]) delete linked[metricId];
      else linked[metricId] = 2;
      return { linked };
    }),
  reset: () => set(initial),
}));
