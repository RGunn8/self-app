import { router, useLocalSearchParams } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { ScrollView, Text, View } from 'react-native';

import { SOURCE_LABEL } from '@/features/metrics/components/MetricCard';
import { metricsRepo } from '@/features/metrics/repo';
import { toast } from '@/shared/components/toast';
import { Card, Chip, ICON_STROKE, ListRow, Overline, Row } from '@/shared/components/ui';
import { useData } from '@/shared/store/data';
import { useTheme } from '@/shared/theme';

/** Create a new metric, or link an existing one. Metrics and identities are many-to-many. */
export default function AddTrackerSheet() {
  const { identityId } = useLocalSearchParams<{ identityId: string }>();
  const p = useTheme();
  const s = useData();
  const identity = s.identities.find((i) => i.id === identityId);
  const linkedHere = new Set(s.links.filter((l) => l.identityId === identityId).map((l) => l.metricId));
  const linkable = s.metrics.filter((m) => !linkedHere.has(m.id));
  const usedBy = (metricId: string) =>
    s.identities.filter((i) => s.links.some((l) => l.metricId === metricId && l.identityId === i.id)).map((i) => i.name);

  return (
    <ScrollView contentContainerClassName="p-gutter pt-6 gap-4">
      <Text className="font-heading text-display-sm text-ink">Add to {identity?.name}</Text>
      <Card
        onPress={() => {
          router.back();
          router.push({ pathname: '/metric-form', params: { kind: 'add', identityId } });
        }}>
        <Row className="gap-3">
          <View className="w-10 h-10 rounded-[20px] bg-accent items-center justify-center">
            <Plus size={20} color={p.onAccent} strokeWidth={ICON_STROKE} />
          </View>
          <View className="flex-1">
            <Text className="text-ink text-[15px] font-body-bold">
              Create a new metric
            </Text>
            <Text className="font-body text-caption text-muted">
              Name it, choose how it’s measured, set a goal
            </Text>
          </View>
        </Row>
      </Card>
      {linkable.length ? (
        <View className="gap-2">
          <Overline>Or link something you already track</Overline>
          <Text className="font-body text-caption text-muted">
            Linked metrics share one history. Nothing is duplicated.
          </Text>
          {linkable.map((m) => (
            <ListRow
              key={m.id}
              title={m.name}
              sub={`Used by ${usedBy(m.id).join(', ') || 'no identity'} · ${SOURCE_LABEL[m.source]}`}
              right={
                <Chip
                  label="Link"
                  onPress={() => {
                    metricsRepo.link(identityId, m.id, 2);
                    toast(`${m.name} now counts toward ${identity?.name}`);
                    router.back();
                  }}
                />
              }
            />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}
