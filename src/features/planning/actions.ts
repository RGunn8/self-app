// Doing, skipping and moving plans. Every change offers Undo, and doing an intention goes through
// the same afterLog path as logging, so votes and moments behave the same everywhere.
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';

import { entriesRepo } from '@/features/logging/repo';
import type { PlanItem } from '@/features/planning/domain';
import { plansRepo } from '@/features/planning/repo';
import { celebrate } from '@/features/progress/components/MomentCard';
import { afterLog } from '@/features/progress/views';
import { toast } from '@/shared/components/toast';
import { addDays, parseDay, today } from '@/shared/lib/dates';
import { useData } from '@/shared/store/data';

/** Sessions open their system's checklist; that's where they get done. */
export function openSession(item: PlanItem) {
  router.push({ pathname: '/system/[id]', params: { id: item.plan.systemId! } });
}

export function completeIntention(item: PlanItem) {
  const { plan } = item;
  const before = useData.getState();
  const metric = plan.metricId ? before.metrics.find((m) => m.id === plan.metricId) : undefined;
  let entryId: string | null = null;
  if (metric && plan.amount !== null) {
    const loggedAt = plan.day === today() ? Date.now() : parseDay(plan.day).getTime() + 12 * 3_600_000;
    entryId = entriesRepo.add(metric.id, plan.amount, loggedAt);
  }
  plansRepo.setStatus(plan.id, 'done', entryId);

  const undo = {
    label: 'Undo',
    onPress: () => {
      if (entryId) entriesRepo.remove(entryId);
      plansRepo.setStatus(plan.id, 'planned');
    },
  };
  const { moment, line } = metric
    ? afterLog(before, { kind: 'entry', metricId: metric.id, value: plan.amount ?? 0, day: plan.day }, `Done: ${item.title}`)
    : afterLog(before, { kind: 'intention', identityId: plan.identityId!, day: plan.day }, `Done: ${item.title}`);
  if (moment) {
    celebrate(moment, undo);
  } else {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    toast(line, undo);
  }
}

export function reopenIntention(item: PlanItem) {
  if (item.plan.entryId) entriesRepo.remove(item.plan.entryId);
  plansRepo.setStatus(item.plan.id, 'planned');
}

export function skipPlan(item: PlanItem) {
  plansRepo.setStatus(item.plan.id, 'skipped');
  toast(`Not today: ${item.title}`, { label: 'Undo', onPress: () => plansRepo.setStatus(item.plan.id, 'planned') });
}

export function moveToTomorrow(item: PlanItem) {
  const from = item.plan.day;
  const to = addDays(today(), 1);
  plansRepo.moveTo(item.plan.id, to);
  toast(`Moved to tomorrow: ${item.title}`, { label: 'Undo', onPress: () => plansRepo.moveTo(item.plan.id, from) });
}

export function bringToToday(items: PlanItem[]) {
  for (const i of items) plansRepo.moveTo(i.plan.id, today());
  toast(items.length === 1 ? `Brought over: ${items[0].title}` : `Brought over ${items.length} plans`);
}

export function removePlan(item: PlanItem) {
  plansRepo.remove(item.plan.id);
  toast(`Removed: ${item.title}`, { label: 'Undo', onPress: () => plansRepo.restore(item.plan.id) });
}
