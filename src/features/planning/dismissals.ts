// "Not now" on a planning prompt hides it for that day or week, on this device.
import Storage from 'expo-sqlite/kv-store';
import { useEffect, useState } from 'react';

const KEY = 'planning:prompt-dismissed';

/** Whether the prompt with this key was dismissed, and a way to dismiss it. */
export function useDismissal(key: string | null): [boolean, () => void] {
  const [dismissed, setDismissed] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    Storage.getItem(KEY)
      .then((v) => setDismissed(v))
      .catch(() => setDismissed(null));
  }, []);
  const dismiss = () => {
    if (!key) return;
    setDismissed(key);
    Storage.setItem(KEY, key).catch(() => {});
  };
  // Until storage answers, treat it as dismissed so nothing flashes in and out.
  return [key === null || dismissed === undefined || dismissed === key, dismiss];
}
