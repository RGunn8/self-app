// Row stamps. Rows are soft-deleted (deletedAt) so a later sync can carry deletes.
import { randomUUID } from 'expo-crypto';

export const stamp = () => {
  const now = Date.now();
  return { id: randomUUID(), createdAt: now, updatedAt: now, deletedAt: null };
};
export const touched = () => ({ updatedAt: Date.now() });
export const removed = () => ({ deletedAt: Date.now(), updatedAt: Date.now() });
