import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { type Alignment, BASELINE_DAYS } from '@/features/identities/domain';
import type { IdentityView } from '@/features/identities/views';
import { formatChange, formatValue, periodLabel, STATUS_LABEL } from '@/features/metrics/domain';
import { useSettings } from '@/features/settings/useSettings';
import { Bar, Sparkline } from '@/shared/components/charts';
import { Avatar, Card, Pill, Row } from '@/shared/components/ui';
import { fmt } from '@/shared/lib/dates';
import { accentFor, useTheme } from '@/shared/theme';

export function alignmentLabel(a: Alignment, pauseEnd?: string | null): string {
  switch (a.status) {
    case 'scored':
      return `${a.score}% aligned`;
    case 'baseline':
      return `Day ${BASELINE_DAYS - a.daysToGo} of ${BASELINE_DAYS}`;
    case 'paused':
      return pauseEnd ? `Paused until ${fmt.short(pauseEnd)}` : 'Paused';
    default:
      return 'No data yet';
  }
}

export function AlignmentPill({ view }: { view: IdentityView }) {
  const p = useTheme();
  const display = useSettings((s) => s.scoreDisplay);
  const acc = accentFor(p, view.identity.accent);
  if (display === 'hidden' && view.alignment.status === 'scored') return null;
  if (display === 'bar' && view.alignment.status === 'scored') {
    return (
      <View className="w-[72px]">
        <Bar ratio={view.alignment.score / 100} color={acc.base} track={acc.tint} thickness={8} label={`${view.alignment.score}% aligned`} />
      </View>
    );
  }
  return <Pill label={alignmentLabel(view.alignment, view.pause?.endDate)} bg={acc.tint} fg={acc.deep} />;
}

export function IdentityCard({ view }: { view: IdentityView }) {
  const p = useTheme();
  const acc = accentFor(p, view.identity.accent);
  const h = view.headline;
  const paused = view.alignment.status === 'paused';
  const trendColor = h?.trend.status === 'improving' ? p.positive : p.textMuted;
  return (
    <Card onPress={() => router.push(`/identity/${view.identity.id}`)} className={paused ? 'opacity-70' : undefined}>
      <Row className="justify-between">
        <Row className="flex-1">
          <Avatar marker={view.identity.marker} tint={acc.tint} />
          <Text numberOfLines={1} className="font-heading text-heading-card text-ink shrink">
            {view.identity.name}
          </Text>
        </Row>
        <AlignmentPill view={view} />
      </Row>
      {h ? (
        <Row className="justify-between items-end">
          <View className="gap-0.5 flex-1">
            <Text numberOfLines={1} className="font-body text-caption text-muted">
              {h.metric.name} · 4-week avg
            </Text>
            <Row className="gap-1 items-baseline">
              <Text className="font-body-bold text-metric-lg text-ink">{formatValue(h.trend.current)}</Text>
              <Text className="font-body-semibold text-label text-muted">
                {periodLabel(h.metric)}
              </Text>
            </Row>
            {h.trend.current !== null ? (
              <Text style={{ color: trendColor }} className="font-body-semibold text-label">
                {formatChange(h.trend.change)}
                {h.trend.status !== 'steady' ? `  ${STATUS_LABEL[h.trend.status]}` : ''}
              </Text>
            ) : (
              <Text className="font-body-semibold text-label text-muted">
                Nothing logged yet
              </Text>
            )}
          </View>
          <Sparkline values={h.spark} color={acc.base} />
        </Row>
      ) : (
        <Text className="font-body text-body-sm text-muted">
          Add something to track to see how you’re living as {view.identity.name}.
        </Text>
      )}
    </Card>
  );
}
