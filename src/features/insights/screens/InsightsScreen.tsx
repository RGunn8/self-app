import { router } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { identityInputs } from '@/features/identities/views';
import { computeInsights, earlyObservations, INSIGHTS_MIN_DAYS } from '@/features/insights/domain';
import { Bar } from '@/shared/components/charts';
import { Card, EmptyState, Overline, Row, Screen } from '@/shared/components/ui';
import { today } from '@/shared/lib/dates';
import { useData } from '@/shared/store/data';
import { accentFor, useTheme } from '@/shared/theme';

export default function InsightsTab() {
  const p = useTheme();
  const s = useData();
  const result = useMemo(
    () => computeInsights(identityInputs(s), s.points, today()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.version],
  );
  const early = useMemo(
    () => (result.status === 'waiting' ? earlyObservations(identityInputs(s), s.points, today()) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.version, result.status],
  );

  return (
    <Screen contentContainerClassName="pt-3" bottomInset={80}>
      <View className="gap-2">
        <Text className="font-body text-body-sm text-muted">
          Patterns in your data
        </Text>
        <Text className="font-heading text-display-lg text-ink">Insights</Text>
      </View>
      {result.status === 'waiting' ? (
        <>
          <Card>
            <Text className="font-body-bold text-overline uppercase text-muted">Full insights</Text>
            <Text className="font-heading text-heading-card text-ink">
              {result.daysToGo} {result.daysToGo === 1 ? 'day' : 'days'} to go
            </Text>
            <Bar
              ratio={(INSIGHTS_MIN_DAYS - result.daysToGo) / INSIGHTS_MIN_DAYS}
              color={p.neutral[700]}
              track={p.chip}
              thickness={8}
              label="Progress toward full insights"
            />
            <Text className="font-body text-caption text-muted">
              Patterns appear after about 4 weeks of data. Until then, here’s what’s already true.
            </Text>
          </Card>
          {early.length === 0 ? (
            <EmptyState title="Early observations start soon" body="Log a few times and small facts about your week will show up here." />
          ) : (
            early.map((n, i) => {
              const identity = s.identities.find((x) => x.id === n.identityIds[0]);
              const acc = accentFor(p, identity?.accent);
              return (
                <Card key={i} onPress={identity ? () => router.push(`/identity/${identity.id}`) : undefined}>
                  <Overline color={acc.deep}>{n.who}</Overline>
                  <Text className="font-body text-body-lg text-ink">{n.text}</Text>
                  <Text className="font-body text-caption text-muted">{n.basis}</Text>
                </Card>
              );
            })
          )}
        </>
      ) : result.insights.length === 0 ? (
        <EmptyState title="Nothing stands out yet" body="Keep logging. When something changes or lines up, it’ll show here." />
      ) : (
        result.insights.map((n, i) => {
          const identity = s.identities.find((x) => x.id === n.identityIds[0]);
          const acc = accentFor(p, identity?.accent);
          return (
            <Card key={i} onPress={identity ? () => router.push(`/identity/${identity.id}`) : undefined}>
              <Overline color={acc.deep}>{n.who}</Overline>
              <Text className="font-body text-body-lg text-ink">{n.text}</Text>
              {n.type === 'split' ? (
                <View className="gap-3">
                  {n.bars.map((b, j) => (
                    <View key={b.label} className="gap-1">
                      <Row className="justify-between">
                        <Text className="font-body-semibold text-label text-muted">
                          {b.label}
                        </Text>
                        <Text className="text-label text-ink font-body-bold">
                          {b.value}
                        </Text>
                      </Row>
                      <Bar ratio={b.ratio} color={j === 0 ? acc.base : p.neutral[500]} track={p.chip} thickness={10} label={b.label} />
                    </View>
                  ))}
                </View>
              ) : null}
              <Text className="font-body text-caption text-muted">
                {n.basis}
              </Text>
            </Card>
          );
        })
      )}
    </Screen>
  );
}
