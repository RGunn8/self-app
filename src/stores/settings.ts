import type { Settings } from '@/db/schema';
import { useData } from './data';

export function useSettings<T>(select: (s: Settings) => T): T {
  return useData((d) => select(d.settings));
}
