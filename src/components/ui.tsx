import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  type StyleProp,
  Text,
  TextInput,
  type TextInputProps,
  type TextProps,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { elevation, layout, radius, space, type, useTheme } from '@/theme';

export const ICON_STROKE = 2.75;

type Variant = keyof typeof type;

export function T({
  v = 'bodyMd',
  color,
  muted,
  style,
  ...rest
}: TextProps & { v?: Variant; color?: string; muted?: boolean }) {
  const p = useTheme();
  return <Text {...rest} style={[type[v], { color: color ?? (muted ? p.textMuted : p.text) }, style]} />;
}

/** Space kept between a focused input and the keyboard toolbar. */
export const KEYBOARD_OFFSET = 64;

/**
 * Prev / Next / Done above the keyboard. Render once at the bottom of any screen with inputs;
 * number pads have no return key, so this is how they get dismissed.
 */
export function KeyboardBar() {
  const p = useTheme();
  // The app can override the system scheme, so give the toolbar the active palette for both modes.
  const colors = { primary: p.accentText, disabled: p.neutral[500], background: p.cardRaised, ripple: p.divider };
  return <KeyboardToolbar theme={{ light: colors, dark: colors }} />;
}

export function Screen({
  children,
  header,
  bottomInset = 0,
  contentStyle,
  ...rest
}: ComponentProps<typeof KeyboardAwareScrollView> & { header?: ReactNode; bottomInset?: number; contentStyle?: StyleProp<ViewStyle> }) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top }}>
      {header}
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_OFFSET}
        {...rest}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          { paddingHorizontal: layout.screenGutter, paddingBottom: insets.bottom + space.xxl + bottomInset, gap: layout.sectionGap },
          contentStyle,
        ]}>
        {children}
      </KeyboardAwareScrollView>
    </View>
  );
}

export function NavHeader({
  title,
  back = true,
  backLabel = 'Back',
  left,
  right,
}: {
  title?: string;
  back?: boolean;
  backLabel?: string;
  left?: ReactNode;
  right?: ReactNode;
}) {
  const p = useTheme();
  return (
    <View
      style={{
        height: layout.headerHeight,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: layout.screenGutter - space.sm,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minWidth: 80 }}>
        {left ??
          (back ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityRole="button"
              style={{ flexDirection: 'row', alignItems: 'center', padding: space.sm }}>
              <ChevronLeft size={22} color={p.text} strokeWidth={ICON_STROKE} />
              <T v="label" style={{ fontSize: 15 }}>
                {backLabel}
              </T>
            </Pressable>
          ) : null)}
      </View>
      {title ? (
        <T v="label" muted>
          {title}
        </T>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', minWidth: 80, gap: space.xs }}>
        {right}
      </View>
    </View>
  );
}

export function HeaderAction({ label, onPress, bold }: { label: string; onPress: () => void; bold?: boolean }) {
  const p = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" style={{ padding: space.sm }}>
      <T v="label" style={{ fontSize: 15, fontFamily: bold ? 'Figtree_700Bold' : undefined }} color={p.accentText}>
        {label}
      </T>
    </Pressable>
  );
}

export function Card({ children, style, onPress, tint }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tint?: string }) {
  const p = useTheme();
  const base: ViewStyle = { backgroundColor: tint ?? p.card, borderRadius: radius.card, padding: layout.cardPadding, gap: space.md };
  if (!onPress) return <View style={[base, p.scheme === 'light' && elevation.sm, style]}>{children}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [base, pressed ? [elevation.md, { transform: [{ scale: 0.98 }] }] : p.scheme === 'light' && elevation.sm, style]}>
      {children}
    </Pressable>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'dashed';

export function Button({
  label,
  kind = 'primary',
  disabled,
  loading,
  icon,
  style,
  ...rest
}: PressableProps & { label: string; kind?: ButtonKind; loading?: boolean; icon?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = useTheme();
  const isPrimary = kind === 'primary';
  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        {
          height: isPrimary ? layout.buttonHeight + 2 : 48,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: space.sm,
          paddingHorizontal: space.xl,
          opacity: disabled ? 0.45 : 1,
        },
        isPrimary && { backgroundColor: pressed ? p.accentPressed : p.accent },
        kind === 'secondary' && { borderWidth: 1.5, borderColor: p.fieldBorder, backgroundColor: pressed ? p.chip : 'transparent' },
        kind === 'ghost' && { backgroundColor: pressed ? p.chip : 'transparent' },
        kind === 'dashed' && {
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: p.fieldBorder,
          height: 46,
          backgroundColor: pressed ? p.chip : 'transparent',
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={isPrimary ? p.onAccent : p.text} /> : icon}
      <T
        v={isPrimary ? 'headingButton' : 'label'}
        style={!isPrimary ? { fontSize: kind === 'dashed' ? 14 : 15, fontFamily: 'Figtree_700Bold' } : undefined}
        color={isPrimary ? p.onAccent : kind === 'dashed' ? p.accentText : p.text}>
        {label}
      </T>
    </Pressable>
  );
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
  accessibilityLabel?: string;
}) {
  const p = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: p.chip }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={[
              { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.pill },
              on && [{ backgroundColor: p.card }, elevation.sm],
            ]}>
            <T v="label" style={{ fontSize: 14 }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  tint,
  fg,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tint?: string;
  fg?: string;
}) {
  const p = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected: !!selected }}
      style={{
        paddingVertical: 9,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        backgroundColor: selected ? p.selected : (tint ?? p.chip),
      }}>
      <T v="label" style={{ fontSize: 14 }} color={selected ? p.onSelected : (fg ?? p.text)}>
        {label}
      </T>
    </Pressable>
  );
}

export function Field({
  label,
  help,
  children,
}: {
  label?: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: space.sm }}>
      {label ? (
        <T v="label" muted>
          {label}
        </T>
      ) : null}
      {children}
      {help ? (
        <T v="caption" muted>
          {help}
        </T>
      ) : null}
    </View>
  );
}

export function Input({ multiline, style, ref, ...rest }: TextInputProps & { ref?: React.Ref<TextInput> }) {
  const p = useTheme();
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={p.neutral[500]}
      multiline={multiline}
      {...rest}
      style={[
        {
          minHeight: layout.inputHeight,
          paddingHorizontal: 18,
          paddingVertical: multiline ? 14 : 0,
          borderRadius: multiline ? radius.md : radius.pill,
          borderWidth: 1.5,
          borderColor: p.fieldBorder,
          backgroundColor: p.field,
          color: p.text,
          fontFamily: 'Figtree_600SemiBold',
          fontSize: 16,
          textAlignVertical: multiline ? 'top' : 'center',
        },
        style,
      ]}
    />
  );
}

export function Avatar({ marker, tint, size = 40 }: { marker: string; tint: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.48 }}>{marker}</Text>
    </View>
  );
}

export function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: bg, alignSelf: 'flex-start' }}>
      <T v="label" color={fg} style={{ fontSize: 12, fontFamily: 'Figtree_700Bold' }}>
        {label}
      </T>
    </View>
  );
}

export function Note({ children }: { children: ReactNode }) {
  const p = useTheme();
  return (
    <View style={{ paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.md, backgroundColor: p.chip }}>
      <T v="label" style={{ fontFamily: 'Figtree_400Regular', lineHeight: 19 }} color={p.scheme === 'light' ? p.neutral[800] : p.textMuted}>
        {children}
      </T>
    </View>
  );
}

export function SectionTitle({ title, caption, right }: { title: string; caption?: string; right?: ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T v="displayXs">{title}</T>
        {right}
      </View>
      {caption ? (
        <T v="bodySm" muted>
          {caption}
        </T>
      ) : null}
    </View>
  );
}

export function Overline({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <T v="overline" muted={!color} color={color}>
      {children}
    </T>
  );
}

export function Row({ children, style, ...rest }: ViewProps & { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View {...rest} style={[{ flexDirection: 'row', alignItems: 'center', gap: space.sm }, style]}>
      {children}
    </View>
  );
}

export function ListRow({
  title,
  sub,
  right,
  onPress,
  left,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  onPress?: () => void;
  left?: ReactNode;
}) {
  const p = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: space.md,
        paddingHorizontal: space.lg,
        borderRadius: radius.md,
        backgroundColor: pressed ? p.chip : p.card,
        minHeight: 56,
      })}>
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        <T v="label" style={{ fontSize: 15, fontFamily: 'Figtree_700Bold' }}>
          {title}
        </T>
        {sub ? (
          <T v="caption" muted>
            {sub}
          </T>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Stepper({
  value,
  onChange,
  step,
  unit,
}: {
  value: string;
  onChange: (v: string) => void;
  step: number;
  unit: string;
}) {
  const p = useTheme();
  const bump = (d: number) => {
    const n = Number(value) || 0;
    const next = Math.max(0, Math.round((n + d * step) * 100) / 100);
    onChange(String(next));
  };
  const btn = (label: string, d: number) => (
    <Pressable
      onPress={() => bump(d)}
      accessibilityRole="button"
      accessibilityLabel={d > 0 ? 'Increase' : 'Decrease'}
      style={({ pressed }) => ({
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: pressed ? p.neutral[300] : p.chip,
        alignItems: 'center',
        justifyContent: 'center',
      })}>
      <T v="metricSm">{label}</T>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      {btn('−', -1)}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.replace(',', '.'))}
          keyboardType="decimal-pad"
          selectTextOnFocus
          textAlign="center"
          accessibilityLabel="Value"
          style={[type.metricXl, { fontSize: 44, lineHeight: 50, color: p.text, minWidth: 100 }]}
        />
        <T v="label" muted>
          {unit}
        </T>
      </View>
      {btn('+', 1)}
    </View>
  );
}

export function Skeleton({ height, width = '100%', radius: r = radius.card }: { height: number; width?: number | `${number}%`; radius?: number }) {
  const p = useTheme();
  return <View style={{ height, width, borderRadius: r, backgroundColor: p.chip, opacity: 0.8 }} />;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  const p = useTheme();
  return (
    <View style={{ alignItems: 'flex-start', gap: space.md, padding: space.xl, borderRadius: radius.card, backgroundColor: p.card }}>
      <View style={{ flexDirection: 'row', gap: -12 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: p.accents.runner.tint }} />
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: p.accents.parent.tint, marginTop: 20 }} />
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: p.accents.writer.tint }} />
      </View>
      <T v="displaySm">{title}</T>
      <T v="bodyMd" muted>
        {body}
      </T>
      {action}
    </View>
  );
}
