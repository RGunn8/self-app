import { Pressable, Text, View } from 'react-native';

import type { Priority } from '@/features/identities/model';
import { PRIORITIES } from '@/features/identities/views';
import { cx } from '@/shared/lib/cx';
import { ACCENT_KEYS, type AccentKey, useTheme } from '@/shared/theme';

export const MARKERS = ['🏃', '🧸', '✍️', '💰', '🎸', '🌱', '🧘', '📚'];

export function PriorityRadio({ value, onChange, name }: { value: Priority; onChange: (p: Priority) => void; name?: string }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={`Priority${name ? ` of ${name}` : ''}`} className="gap-2">
      {PRIORITIES.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            className={cx('flex-row items-center gap-3 rounded-lg border-2 bg-card p-4', on ? 'border-selected' : 'border-neutral-300')}>
            <View
              className={cx('h-[18px] w-[18px] rounded-full border-2', on ? 'border-selected bg-selected' : 'border-neutral-400')}
            />
            <View className="flex-1">
              <Text className="text-ink text-[15px] font-body-bold">
                {o.label}
              </Text>
              <Text className="font-body text-caption text-muted">
                {o.sub}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MarkerPicker({ value, onChange, tint }: { value: string; onChange: (m: string) => void; tint: string }) {
  return (
    <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup" accessibilityLabel="Marker">
      {MARKERS.map((m) => (
        <Pressable
          key={m}
          onPress={() => onChange(m)}
          accessibilityRole="radio"
          accessibilityState={{ checked: m === value }}
          className={cx('h-11 w-11 items-center justify-center rounded-full', m !== value && 'bg-card')}
          style={m === value ? { backgroundColor: tint } : null}>
          <Text className="text-[21px]">{m}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function AccentPicker({ value, onChange }: { value: AccentKey; onChange: (a: AccentKey) => void }) {
  const p = useTheme();
  return (
    <View className="flex-row gap-2" accessibilityRole="radiogroup" accessibilityLabel="Accent">
      {ACCENT_KEYS.map((k) => {
        const on = k === value;
        return (
          <Pressable
            key={k}
            onPress={() => onChange(k)}
            accessibilityRole="radio"
            accessibilityLabel={k}
            accessibilityState={{ checked: on }}
            className={cx('rounded-pill border-2 p-[3px]', on ? 'border-selected' : 'border-transparent')}>
            <View className="h-8 w-8 rounded-full" style={{ backgroundColor: p.accents[k].base }} />
          </Pressable>
        );
      })}
    </View>
  );
}
