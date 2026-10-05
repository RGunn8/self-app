import { router } from 'expo-router';
import { Settings as Gear } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, SectionList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IdentityCard } from '@/components/identity';
import { Button, Card, EmptyState, ICON_STROKE, ListRow, Overline, Row, T } from '@/components/ui';
import { formatValue } from '@/domain/metrics';
import { fmt, greeting, today } from '@/lib/dates';
import { useData } from '@/stores/data';
import { PRIORITIES, useIdentityViews } from '@/stores/derived';
import { layout, space, useTheme } from '@/theme';

export default function IdentitiesTab() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const views = useIdentityViews();
  const userName = useData((s) => s.settings.userName);
  const entries = useData((s) => s.entries);
  const metrics = useData((s) => s.metrics);

  const sections = useMemo(
    () =>
      PRIORITIES.map((pr) => ({ key: pr.key, title: pr.label, data: views.filter((v) => v.identity.priority === pr.key) })).filter(
        (s) => s.data.length > 0,
      ),
    [views],
  );

  const recent = useMemo(() => {
    const byId = new Map(metrics.map((m) => [m.id, m]));
    return entries
      .slice(0, 3)
      .map((e) => ({ e, m: byId.get(e.metricId) }))
      .filter((x) => x.m);
  }, [entries, metrics]);

  const header = (
    <View style={{ gap: space.xs, paddingBottom: space.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <T v="bodySm" muted>
          {greeting()}
          {userName ? `, ${userName}` : ''} · {fmt.dowShort(today())}
        </T>
        <Pressable onPress={() => router.push('/settings')} hitSlop={10} accessibilityLabel="Settings" accessibilityRole="button">
          <Gear size={22} color={p.textMuted} strokeWidth={ICON_STROKE} />
        </Pressable>
      </Row>
      <T v="displayLg">{views.length ? 'How are you living lately?' : 'Who do you want to become?'}</T>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top + space.md }}>
      <SectionList
        sections={sections}
        keyExtractor={(v) => v.identity.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: layout.screenGutter, paddingBottom: 120, gap: space.md }}
        ListHeaderComponent={header}
        renderSectionHeader={({ section }) => (
          <View style={{ paddingTop: space.lg }}>
            <Overline>{section.title}</Overline>
          </View>
        )}
        renderItem={({ item }) => <IdentityCard view={item} />}
        ListEmptyComponent={
          <EmptyState
            title="Start with one identity"
            body="You’ll decide what it means and what to track. For example: a runner, a present parent, a writer."
            action={<Button label="Create your first identity" onPress={() => router.push('/identity/create')} style={{ alignSelf: 'stretch' }} />}
          />
        }
        ListFooterComponent={
          views.length ? (
            <View style={{ gap: space.md, paddingTop: space.xxl }}>
              {recent.length ? (
                <>
                  <Overline>Recently logged</Overline>
                  <Card style={{ padding: space.xs, gap: 0 }}>
                    {recent.map(({ e, m }) => (
                      <ListRow
                        key={e.id}
                        title={m!.name}
                        sub={`${e.source === 'manual' ? 'Logged' : 'Apple Health'} · ${fmt.time(e.loggedAt)}`}
                        onPress={() => router.push(`/entry/${e.id}`)}
                        right={
                          <T v="label" style={{ fontFamily: 'Figtree_700Bold' }}>
                            {formatValue(e.value)} {m!.unit}
                          </T>
                        }
                      />
                    ))}
                  </Card>
                </>
              ) : null}
              <Button kind="dashed" label="+ New identity" onPress={() => router.push('/identity/create')} />
            </View>
          ) : null
        }
      />
    </View>
  );
}
