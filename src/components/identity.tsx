import { router } from 'expo-router';
import { View } from 'react-native';

import type { Alignment } from '@/domain/alignment';
import { formatChange, formatValue, periodLabel, STATUS_LABEL } from '@/domain/metrics';
import { fmt } from '@/lib/dates';
import type { IdentityView } from '@/stores/derived';
import { useSettings } from '@/stores/settings';
import { accentFor, space, useTheme } from '@/theme';
import { Bar, Sparkline } from './charts';
import { Avatar, Card, Pill, Row, T } from './ui';

export function alignmentLabel(a: Alignment, pauseEnd?: string | null): string {
  switch (a.status) {
    case 'scored':
      return `${a.score}% aligned`;
    case 'baseline':
      return 'Building baseline';
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
      <View style={{ width: 72 }}>
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
    <Card onPress={() => router.push(`/identity/${view.identity.id}`)} style={paused && { opacity: 0.7 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row style={{ flex: 1 }}>
          <Avatar marker={view.identity.marker} tint={acc.tint} />
          <T v="headingCard" numberOfLines={1} style={{ flexShrink: 1 }}>
            {view.identity.name}
          </T>
        </Row>
        <AlignmentPill view={view} />
      </Row>
      {h ? (
        <Row style={{ justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View style={{ gap: 2, flex: 1 }}>
            <T v="caption" muted numberOfLines={1}>
              {h.metric.name} · 4-week avg
            </T>
            <Row style={{ gap: space.xs, alignItems: 'baseline' }}>
              <T v="metricLg">{formatValue(h.trend.current)}</T>
              <T v="label" muted>
                {periodLabel(h.metric)}
              </T>
            </Row>
            {h.trend.current !== null ? (
              <T v="label" color={trendColor}>
                {formatChange(h.trend.change)}
                {h.trend.status !== 'steady' ? `  ${STATUS_LABEL[h.trend.status]}` : ''}
              </T>
            ) : (
              <T v="label" muted>
                Nothing logged yet
              </T>
            )}
          </View>
          <Sparkline values={h.spark} color={acc.base} />
        </Row>
      ) : (
        <T v="bodySm" muted>
          Add something to track to see how you’re living as {view.identity.name}.
        </T>
      )}
    </Card>
  );
}
