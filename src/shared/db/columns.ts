import { integer, text } from 'drizzle-orm/sqlite-core';

// Every synced table carries id (uuid) + createdAt/updatedAt/deletedAt (epoch ms)
// so a future push/pull sync against the API can merge by updatedAt.
export const base = {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
};
