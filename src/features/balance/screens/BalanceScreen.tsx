import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { alignmentLabel } from '@/features/identities/components/IdentityCard';
import { formatDelta } from '@/features/identities/domain';
import { PRIORITIES, useIdentityViews } from '@/features/identities/views';
import { Bar } from '@/shared/components/charts';
import { Avatar, Overline, Row, Screen } from '@/shared/components/ui';
import { fmt, today } from '@/shared/lib/dates';
import { accentFor, useTheme } from '@/shared/theme';

// Bar thickness encodes priority, so the list reads as weighted without implying a sum.
const THICKNESS = { core: 14, important: 10, supporting: 6 } as const;

export default function BalanceTab() {
  const p = useTheme();
  const views = useIdentityViews();

  return (
    <Screen contentContainerClassName="pt-3" bottomInset={80}>
      <View className="gap-2">
        <Text className="font-body text-body-sm text-muted">
          You · {fmt.month(today())}
        </Text>
        <Text className="font-heading text-display-lg text-ink">Identity balance</Text>
        <Text className="font-body text-body-md text-muted">
          Each identity is measured against your own definition. Shown side by side, never added up.
        </Text>
      </View>
      {PRIORITIES.map((pr) => {
        const group = views.filter((v) => v.identity.priority === pr.key);
        if (!group.length) return null;
        return (
          <View key={pr.key} className="gap-4">
            <Overline>{pr.label}</Overline>
            {group.map((v) => {
              const acc = accentFor(p, v.identity.accent);
              const score = v.alignment.status === 'scored' ? v.alignment.score : null;
              return (
                <Pressable
                  key={v.identity.id}
                  onPress={() => router.push(`/identity/${v.identity.id}`)}
                  accessibilityRole="button"
                  className="gap-2 opacity-[1] active:opacity-[0.7]">
                  <Row className="justify-between">
                    <Row className="flex-1">
                      <Avatar marker={v.identity.marker} tint={acc.tint} size={32} />
                      <Text numberOfLines={1} className="text-ink text-[16px] font-body-bold">
                        {v.identity.name}
                      </Text>
                    </Row>
                    <Row className="gap-3">
                      {score !== null ? (
                        <Text style={{ color: v.delta !== null && v.delta > 0 ? p.positive : p.textMuted }} className="font-body-semibold text-label">
                          {formatDelta(v.delta)}
                        </Text>
                      ) : null}
                      <Text className="text-ink font-body-bold text-[16px]">
                        {score !== null ? `${score}%` : alignmentLabel(v.alignment, v.pause?.endDate)}
                      </Text>
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
