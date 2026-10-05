import { Pressable, Text, View } from 'react-native';

import type { Priority } from '@/db/schema';
import { PRIORITIES } from '@/stores/derived';
import { ACCENT_KEYS, type AccentKey, radius, space, useTheme } from '@/theme';
import { T } from './ui';

export const MARKERS = ['🏃', '🧸', '✍️', '💰', '🎸', '🌱', '🧘', '📚'];

export function PriorityRadio({ value, onChange, name }: { value: Priority; onChange: (p: Priority) => void; name?: string }) {
  const p = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={`Priority${name ? ` of ${name}` : ''}`} style={{ gap: space.sm }}>
      {PRIORITIES.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.md,
              padding: space.lg,
              borderRadius: radius.lg,
              backgroundColor: p.card,
              borderWidth: 2,
              borderColor: on ? p.selected : p.neutral[300],
            }}>
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: 9,
                borderWidth: 2,
                borderColor: on ? p.selected : p.neutral[400],
                backgroundColor: on ? p.selected : 'transparent',
              }}
            />
            <View style={{ flex: 1 }}>
              <T v="label" style={{ fontSize: 15, fontFamily: 'Figtree_700Bold' }}>
                {o.label}
              </T>
              <T v="caption" muted>
                {o.sub}
              </T>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MarkerPicker({ value, onChange, tint }: { value: string; onChange: (m: string) => void; tint: string }) {
  const p = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel="Marker">
      {MARKERS.map((m) => (
        <Pressable
          key={m}
          onPress={() => onChange(m)}
          accessibilityRole="radio"
          accessibilityState={{ checked: m === value }}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: m === value ? tint : p.card,
          }}>
          <Text style={{ fontSize: 21 }}>{m}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function AccentPicker({ value, onChange }: { value: AccentKey; onChange: (a: AccentKey) => void }) {
  const p = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel="Accent">
      {ACCENT_KEYS.map((k) => {
        const on = k === value;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            accessibilityRole="radio"
            accessibilityLabel={k}
            accessibilityState={{ checked: on }}
            style={{ padding: 3, borderRadius: 999, borderWidth: 2, borderColor: on ? p.selected : 'transparent' }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: p.accents[k].base }} />
          </Pressable>
        );
      })}
    </View>
  );
}
