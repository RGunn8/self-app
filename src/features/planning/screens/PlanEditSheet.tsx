import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { TimeChoice } from '@/features/planning/components/TimeChoice';
import { planItem } from '@/features/planning/domain';
import { offerRemindersOnce } from '@/features/planning/reminders';
import { plansRepo } from '@/features/planning/repo';
import { usePlanData } from '@/features/planning/views';
import { Button, Chip, Field, Row } from '@/shared/components/ui';
import { addDays, fmt, today } from '@/shared/lib/dates';

/** Change when a plan happens, or decide it isn't for today. */
export default function PlanEditSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = usePlanData();
  const plan = data.plans.find((x) => x.id === id);
  const item = plan ? planItem(plan, data) : null;
  const [time, setTime] = useState<string | null>(plan?.time ?? null);
  const [day, setDay] = useState(plan?.day ?? today());
  if (!plan || !item) return null;

  const t = today();
  const days = [t, addDays(t, 1), addDays(t, 2), addDays(t, 3)];
  const save = () => {
    if (time !== plan.time) plansRepo.setTime(plan.id, time);
    if (day !== plan.day) plansRepo.moveTo(plan.id, day);
    router.back();
    if (time !== null) offerRemindersOnce().catch(() => {});
  };

  return (
    <ScrollView contentContainerClassName="p-gutter pt-6 gap-5 pb-10">
      <Text className="font-heading text-display-sm text-ink">{item.title}</Text>
      <Field label="Day">
        <Row className="flex-wrap">
          {days.map((d, i) => (
            <Chip key={d} label={i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmt.dowShort(d).split(',')[0]} selected={day === d} onPress={() => setDay(d)} />
          ))}
        </Row>
      </Field>
      <Field label="When">
        <TimeChoice value={time} onChange={setTime} />
      </Field>
      <Button label="Save" onPress={save} />
      <View className="gap-2">
        {item.status !== 'skipped' ? (
          <Button
            kind="secondary"
            label="Not today"
            onPress={() => {
              plansRepo.setStatus(plan.id, 'skipped');
              router.back();
            }}
          />
        ) : (
          <Button
            kind="secondary"
            label="Back on for today"
            onPress={() => {
              plansRepo.setStatus(plan.id, 'planned');
              router.back();
            }}
          />
        )}
        <Button
          kind="ghost"
          label="Remove from plan"
          onPress={() => {
            plansRepo.remove(plan.id);
            router.back();
          }}
        />
      </View>
    </ScrollView>
  );
}
