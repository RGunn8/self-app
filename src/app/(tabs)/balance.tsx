import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { Bar } from '@/components/charts';
import { alignmentLabel } from '@/components/identity';
import { Avatar, Overline, Row, Screen, T } from '@/components/ui';
import { formatDelta } from '@/domain/alignment';
import { fmt, today } from '@/lib/dates';
import { PRIORITIES, useIdentityViews } from '@/stores/derived';
import { accentFor, space, useTheme } from '@/theme';

// Bar thickness encodes priority, so the list reads as weighted without implying a sum.
const THICKNESS = { core: 14, important: 10, supporting: 6 } as const;

export default function BalanceTab() {
  const p = useTheme();
  const views = useIdentityViews();

  return (
    <Screen contentStyle={{ paddingTop: space.md }} bottomInset={80}>
      <View style={{ gap: space.sm }}>
        <T v="bodySm" muted>
          You · {fmt.month(today())}
        </T>
        <T v="displayLg">Identity balance</T>
        <T v="bodyMd" muted>
          Each identity is measured against your own definition. Shown side by side, never added up.
        </T>
      </View>
      {PRIORITIES.map((pr) => {
        const group = views.filter((v) => v.identity.priority === pr.key);
        if (!group.length) return null;
        return (
          <View key={pr.key} style={{ gap: space.lg }}>
            <Overline>{pr.label}</Overline>
            {group.map((v) => {
              const acc = accentFor(p, v.identity.accent);
              const score = v.alignment.status === 'scored' ? v.alignment.score : null;
              return (
                <Pressable
                  key={v.identity.id}
                  onPress={() => router.push(`/identity/${v.identity.id}`)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ gap: space.sm, opacity: pressed ? 0.7 : 1 })}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Row style={{ flex: 1 }}>
                      <Avatar marker={v.identity.marker} tint={acc.tint} size={32} />
                      <T v="label" style={{ fontSize: 16, fontFamily: 'Figtree_700Bold' }} numberOfLines={1}>
                        {v.identity.name}
                      </T>
                    </Row>
                    <Row style={{ gap: space.md }}>
                      {score !== null ? (
                        <T v="label" color={v.delta !== null && v.delta > 0 ? p.positive : p.textMuted}>
                          {formatDelta(v.delta)}
                        </T>
                      ) : null}
                      <T v="label" style={{ fontFamily: 'Figtree_700Bold', fontSize: 16 }}>
                        {score !== null ? `${score}%` : alignmentLabel(v.alignment, v.pause?.endDate)}
                      </T>
                    </Row>
                  </Row>
                  <Bar
                    ratio={(score ?? 0) / 100}
                    color={acc.base}
                    track={acc.tint}
                    thickness={THICKNESS[pr.key]}
                    label={`${v.identity.name} ${score ?? 0}% aligned`}
                  />
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </Screen>
  );
}
