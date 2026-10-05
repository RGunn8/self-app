import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { View } from 'react-native';

import { goalText, AGG_LABEL, SOURCE_LABEL } from '@/components/metric';
import { Button, ICON_STROKE, ListRow, NavHeader, Overline, Screen, T } from '@/components/ui';
import { WEIGHT_LABEL } from '@/domain/alignment';
import { identitiesRepo, metricsRepo } from '@/repos';
import { useCreateDraft } from '@/stores/createDraft';
import { useData } from '@/stores/data';
import { space, useTheme } from '@/theme';

/** Step 3 of 3. Defines the identity through metrics, new or already tracked. */
export default function CreateMetrics() {
  const p = useTheme();
  const draft = useCreateDraft();
  const metrics = useData((s) => s.metrics);
  const links = useData((s) => s.links);
  const name = draft.name.trim();

  const create = () => {
    const newLinks = draft.newMetrics.map((m) => ({ metricId: metricsRepo.create(m), weight: m.weight }));
    const linked = Object.entries(draft.linked).map(([metricId, weight]) => ({ metricId, weight }));
    const id = identitiesRepo.create(
      { name, description: draft.description, priority: draft.priority, marker: draft.marker, accent: draft.accent },
      [...newLinks, ...linked],
    );
    router.dismissAll();
    router.push(`/identity/${id}`);
  };

  return (
    <Screen header={<NavHeader title="3 of 3" right={null} />}>
      <View style={{ gap: space.sm }}>
        <T v="label" muted>
          {name}
        </T>
        <T v="displayMd">What would make you feel like you’re living as {name.toLowerCase().startsWith('a ') ? name.slice(2) : name}?</T>
      </View>
      <View style={{ gap: space.sm }}>
        {draft.newMetrics.map((m) => (
          <ListRow
            key={m.tempId}
            title={m.name}
            sub={`${AGG_LABEL[m.aggregation]} · target ${goalText(m)} · ${WEIGHT_LABEL[m.weight]} weight · ${SOURCE_LABEL[m.source ?? 'manual']}`}
          />
        ))}
        <Button kind="dashed" label="+ Add something to track" onPress={() => router.push({ pathname: '/metric-form', params: { kind: 'create' } })} />
      </View>
      {metrics.length ? (
        <View style={{ gap: space.sm }}>
          <Overline>Already tracking</Overline>
          <T v="caption" muted>
            Link a metric you already track. It won’t be duplicated.
          </T>
          {metrics.map((m) => {
            const on = !!draft.linked[m.id];
            const n = new Set(links.filter((l) => l.metricId === m.id).map((l) => l.identityId)).size;
            return (
              <ListRow
                key={m.id}
                title={m.name}
                sub={`Supports ${n} ${n === 1 ? 'identity' : 'identities'} · ${SOURCE_LABEL[m.source]}`}
                onPress={() => draft.toggleLink(m.id)}
                right={
                  <View
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: on ? p.selected : p.neutral[400],
                      backgroundColor: on ? p.selected : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                    {on ? <Check size={14} color={p.onSelected} strokeWidth={ICON_STROKE} /> : null}
                  </View>
                }
              />
            );
          })}
        </View>
      ) : null}
      <Button label={`Create ${name}`} disabled={!name} onPress={create} />
    </Screen>
  );
}
