import type { Settings } from '@/features/settings/model';
import { useData } from '@/shared/store/data';

export function useSettings<T>(select: (s: Settings) => T): T {
  return useData((d) => select(d.settings));
}
