import { router, useLocalSearchParams } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { Card, Chip, ICON_STROKE, ListRow, Overline, Row, T } from '@/components/ui';
import { SOURCE_LABEL } from '@/components/metric';
import { metricsRepo } from '@/repos';
import { useData } from '@/stores/data';
import { layout, space, useTheme } from '@/theme';
import { toast } from '@/components/overlay';

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
    <ScrollView contentContainerStyle={{ padding: layout.screenGutter, paddingTop: space.xxl, gap: space.lg }}>
      <T v="displaySm">Add to {identity?.name}</T>
      <Card
        onPress={() => {
          router.back();
          router.push({ pathname: '/metric-form', params: { kind: 'add', identityId } });
        }}>
        <Row style={{ gap: space.md }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Plus size={20} color={p.onAccent} strokeWidth={ICON_STROKE} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="label" style={{ fontSize: 15, fontFamily: 'Figtree_700Bold' }}>
              Create a new metric
            </T>
            <T v="caption" muted>
              Name it, choose how it’s measured, set a goal
            </T>
          </View>
        </Row>
      </Card>
      {linkable.length ? (
        <View style={{ gap: space.sm }}>
          <Overline>Or link something you already track</Overline>
          <T v="caption" muted>
            Linked metrics share one history. Nothing is duplicated.
          </T>
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
