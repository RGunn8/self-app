// Pause, resume and restart, shared by the identity actions sheet and the edit screen.
import { Alert } from 'react-native';

import type { Identity, Pause } from '@/features/identities/model';
import { identitiesRepo, pausesRepo } from '@/features/identities/repo';
import { toast } from '@/shared/components/toast';
import { fmt, today } from '@/shared/lib/dates';

export function resumeIdentity(identity: Identity, pause: Pause) {
  pausesRepo.resume(pause.id, pause.startDate);
  toast(`${identity.name} resumed`);
}

/** Fresh start from today. Nothing is deleted, and it can be undone. */
export function confirmRestart(identity: Identity, onDone?: () => void) {
  Alert.alert(
    `Restart ${identity.name}?`,
    'Alignment, votes and your getting-started path count from today. Your history stays in charts and the calendar, and you can undo this.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Restart',
        onPress: () => {
          const previous = identity.restartedAt;
          identitiesRepo.restart(identity.id, today());
          onDone?.();
          toast(`${identity.name} starts fresh today`, { label: 'Undo', onPress: () => identitiesRepo.restart(identity.id, previous) });
        },
      },
    ],
  );
}

export function undoRestart(identity: Identity) {
  const was = identity.restartedAt;
  identitiesRepo.restart(identity.id, null);
  toast(`Restart undone. ${identity.name} counts all its history again`, { label: 'Undo', onPress: () => identitiesRepo.restart(identity.id, was) });
}

export const restartedLabel = (identity: Identity) => (identity.restartedAt ? `Restarted ${fmt.short(identity.restartedAt)}` : null);
