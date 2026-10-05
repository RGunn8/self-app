import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';

import { Bar } from '@/components/charts';
import { Card, EmptyState, Overline, Row, Screen, T } from '@/components/ui';
import { computeInsights } from '@/domain/insights';
import { today } from '@/lib/dates';
import { useData } from '@/stores/data';
import { identityInputs } from '@/stores/derived';
import { accentFor, space, useTheme } from '@/theme';

export default function InsightsTab() {
  const p = useTheme();
  const s = useData();
  const result = useMemo(
    () => computeInsights(identityInputs(s), s.points, today()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.version],
  );

  return (
    <Screen contentStyle={{ paddingTop: space.md }} bottomInset={80}>
      <View style={{ gap: space.sm }}>
        <T v="bodySm" muted>
          Patterns in your data
        </T>
        <T v="displayLg">Insights</T>
      </View>
      {result.status === 'waiting' ? (
        <EmptyState
          title="Insights need a few weeks"
          body={`Patterns appear once there are about 4 weeks of data. About ${result.daysToGo} days to go.`}
        />
      ) : result.insights.length === 0 ? (
        <EmptyState title="Nothing stands out yet" body="Keep logging. When something changes or lines up, it’ll show here." />
      ) : (
        result.insights.map((n, i) => {
          const identity = s.identities.find((x) => x.id === n.identityIds[0]);
          const acc = accentFor(p, identity?.accent);
          return (
            <Card key={i} onPress={identity ? () => router.push(`/identity/${identity.id}`) : undefined}>
              <Overline color={acc.deep}>{n.who}</Overline>
              <T v="bodyLg">{n.text}</T>
              {n.type === 'split' ? (
                <View style={{ gap: space.md }}>
                  {n.bars.map((b, j) => (
                    <View key={b.label} style={{ gap: space.xs }}>
                      <Row style={{ justifyContent: 'space-between' }}>
                        <T v="label" muted>
                          {b.label}
                        </T>
                        <T v="label" style={{ fontFamily: 'Figtree_700Bold' }}>
                          {b.value}
                        </T>
                      </Row>
                      <Bar ratio={b.ratio} color={j === 0 ? acc.base : p.neutral[500]} track={p.chip} thickness={10} label={b.label} />
                    </View>
                  ))}
                </View>
              ) : null}
              <T v="caption" muted>
                {n.basis}
              </T>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
