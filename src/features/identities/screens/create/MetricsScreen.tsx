import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Text, View } from 'react-native';

import { useCreateDraft } from '@/features/identities/createDraft';
import { WEIGHT_LABEL } from '@/features/identities/domain';
import { identitiesRepo } from '@/features/identities/repo';
import { goalText, AGG_LABEL, SOURCE_LABEL } from '@/features/metrics/components/MetricCard';
import { metricsRepo } from '@/features/metrics/repo';
import { Button, ICON_STROKE, ListRow, NavHeader, Overline, Screen } from '@/shared/components/ui';
import { cx } from '@/shared/lib/cx';
import { useData } from '@/shared/store/data';
import { useTheme } from '@/shared/theme';

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
    <Screen modal header={<NavHeader title="3 of 3" right={null} />}>
      <View className="gap-2">
        <Text className="font-body-semibold text-label text-muted">
          {name}
        </Text>
        <Text className="font-heading text-display-md text-ink">What would make you feel like you’re living as {name.toLowerCase().startsWith('a ') ? name.slice(2) : name}?</Text>
      </View>
      <View className="gap-2">
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
        <View className="gap-2">
          <Overline>Already tracking</Overline>
          <Text className="font-body text-caption text-muted">
            Link a metric you already track. It won’t be duplicated.
          </Text>
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
                    className={cx('h-6 w-6 items-center justify-center rounded-full border-2', on ? 'border-selected bg-selected' : 'border-neutral-400')}>
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
