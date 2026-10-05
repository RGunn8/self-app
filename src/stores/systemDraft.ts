// In-progress system checks live in a per-day draft that survives restarts.
// They become permanent entries only on "Mark done".
import { useEffect, useState } from 'react';
import { create } from 'zustand';
import Storage from 'expo-sqlite/kv-store';

import { today } from '@/lib/dates';

const keyFor = (systemId: string, day: string) => `draft:${systemId}:${day}`;

interface DraftState {
  drafts: Record<string, string[]>;
  set: (systemId: string, day: string, stepIds: string[]) => void;
}

export const useDrafts = create<DraftState>((set) => ({
  drafts: {},
  set: (systemId, day, stepIds) => {
    const k = keyFor(systemId, day);
    set((s) => ({ drafts: { ...s.drafts, [k]: stepIds } }));
    if (stepIds.length) Storage.setItem(k, JSON.stringify(stepIds)).catch(() => {});
    else Storage.removeItem(k).catch(() => {});
  },
}));

/** Checked step ids for today, hydrated from storage on first use. */
export function useDayDraft(systemId: string, day = today()): string[] {
  const k = keyFor(systemId, day);
  const value = useDrafts((s) => s.drafts[k]);
  const [loaded, setLoaded] = useState(value !== undefined);
  useEffect(() => {
    if (loaded) return;
    Storage.getItem(k)
      .then((raw) => {
        if (raw && useDrafts.getState().drafts[k] === undefined) {
          useDrafts.setState((s) => ({ drafts: { ...s.drafts, [k]: JSON.parse(raw) } }));
        }
      })
      .finally(() => setLoaded(true));
  }, [k, loaded]);
  return value ?? [];
}

export function setDayDraft(systemId: string, stepIds: string[], day = today()) {
  useDrafts.getState().set(systemId, day, stepIds);
}
