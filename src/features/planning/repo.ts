// All plan writes. Plans are soft-deleted like every other row.
import { and, eq, gte, isNull, lte } from 'drizzle-orm';

import { type Plan, plans, type PlanStatus } from '@/features/planning/model';
import { db } from '@/shared/db/client';
import { removed, stamp, touched } from '@/shared/db/rows';
import { addDays } from '@/shared/lib/dates';

function nextPosition(day: string): number {
  const rows = db.select({ position: plans.position }).from(plans).where(and(eq(plans.day, day), isNull(plans.deletedAt))).all();
  return rows.reduce((m, r) => Math.max(m, r.position + 1), 0);
}

export interface IntentionInput {
  day: string;
  time: string | null;
  identityId: string;
  title: string;
  metricId: string | null;
  amount: number | null;
}

export const plansRepo = {
  addSession(systemId: string, day: string, time: string | null) {
    const row = {
      ...stamp(),
      day,
      time,
      kind: 'system' as const,
      systemId,
      identityId: null,
      title: null,
      metricId: null,
      amount: null,
      status: 'planned' as const,
      entryId: null,
      position: nextPosition(day),
    };
    db.insert(plans).values(row).run();
    return row.id;
  },
  addIntention(input: IntentionInput) {
    const row = {
      ...stamp(),
      day: input.day,
      time: input.time,
      kind: 'intention' as const,
      systemId: null,
      identityId: input.identityId,
      title: input.title.trim(),
      metricId: input.metricId,
      amount: input.metricId ? input.amount : null,
      status: 'planned' as const,
      entryId: null,
      position: nextPosition(input.day),
    };
    db.insert(plans).values(row).run();
    return row.id;
  },
  setTime(id: string, time: string | null) {
    db.update(plans).set({ time, ...touched() }).where(eq(plans.id, id)).run();
  },
  /** Move to another day as a fresh plan there. */
  moveTo(id: string, day: string) {
    db.update(plans)
      .set({ day, status: 'planned', position: nextPosition(day), ...touched() })
      .where(eq(plans.id, id))
      .run();
  },
  setStatus(id: string, status: PlanStatus, entryId: string | null = null) {
    db.update(plans).set({ status, entryId, ...touched() }).where(eq(plans.id, id)).run();
  },
  remove(id: string) {
    db.update(plans).set(removed()).where(eq(plans.id, id)).run();
  },
  restore(id: string) {
    db.update(plans).set({ deletedAt: null, ...touched() }).where(eq(plans.id, id)).run();
  },
  /**
   * Save a week's sessions: for each system, the days (Monday-first indexes) and a usual time.
   * Only still-planned sessions from `from` on are replaced. Earlier days are history, and done
   * sessions and intentions are always kept.
   */
  planWeek(
    weekStartKey: string,
    from: string,
    sessions: { systemId: string; days: number[]; time: string | null }[],
    isDone: (systemId: string, day: string) => boolean,
  ) {
    const weekEnd = addDays(weekStartKey, 6);
    const start = from > weekStartKey ? from : weekStartKey;
    db.transaction((tx) => {
      const existing: Plan[] = tx
        .select()
        .from(plans)
        .where(and(eq(plans.kind, 'system'), gte(plans.day, start), lte(plans.day, weekEnd), isNull(plans.deletedAt)))
        .all();
      const keep = new Set<string>();
      for (const p of existing) {
        if (p.systemId && isDone(p.systemId, p.day)) keep.add(`${p.systemId}:${p.day}`);
        else tx.update(plans).set(removed()).where(eq(plans.id, p.id)).run();
      }
      const positions = new Map<string, number>();
      for (const { systemId, days, time } of sessions) {
        for (const d of days) {
          const day = addDays(weekStartKey, d);
          if (day < start) continue;
          if (keep.has(`${systemId}:${day}`) || isDone(systemId, day)) continue;
          const position = positions.get(day) ?? 0;
          positions.set(day, position + 1);
          tx.insert(plans)
            .values({
              ...stamp(),
              day,
              time,
              kind: 'system',
              systemId,
              identityId: null,
              title: null,
              metricId: null,
              amount: null,
              status: 'planned',
              entryId: null,
              position,
            })
            .run();
        }
      }
    });
  },
};
