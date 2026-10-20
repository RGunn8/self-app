import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewProps,
} from 'react-native';
import { KeyboardAwareScrollView, KeyboardToolbar } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cx, withDefaults } from '@/shared/lib/cx';
import { elevation, space, useTheme } from '@/shared/theme';

export const ICON_STROKE = 2.75;

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
  contentContainerClassName,
  modal = false,
  ...rest
}: ComponentProps<typeof KeyboardAwareScrollView> & {
  header?: ReactNode;
  bottomInset?: number;
  contentContainerClassName?: string;
  /** Presented as an iOS sheet/modal: the sheet already sits below the status bar, so skip the top inset. */
  modal?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: modal ? 0 : insets.top }}>
      {header}
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_OFFSET}
        {...rest}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName={cx('px-gutter gap-section', contentContainerClassName)}
        contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl + bottomInset }}>
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
    <View className="h-header flex-row items-center justify-between px-3">
      <View className="min-w-[80px] flex-row items-center">
        {left ??
          (back ? (
            <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" className="flex-row items-center p-2">
              <ChevronLeft size={22} color={p.text} strokeWidth={ICON_STROKE} />
              <Text className="font-body-semibold text-ink text-[15px]">
                {backLabel}
              </Text>
            </Pressable>
          ) : null)}
      </View>
      {title ? (
        <Text className="font-body-semibold text-label text-muted">
          {title}
        </Text>
      ) : null}
      <View className="min-w-[80px] flex-row items-center justify-end gap-1">{right}</View>
    </View>
  );
}

export function HeaderAction({ label, onPress, bold }: { label: string; onPress: () => void; bold?: boolean }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" className="p-2">
      <Text className={cx('text-[15px] leading-[18px] text-accent-text', bold ? 'font-body-bold' : 'font-body-semibold')}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, className, onPress, tint }: { children: ReactNode; className?: string; onPress?: () => void; tint?: string }) {
  const p = useTheme();
  const base = withDefaults(cx('gap-3 rounded-card p-4', !tint && 'bg-card'), className);
  const tintStyle = tint ? { backgroundColor: tint } : null;
  const lift = p.scheme === 'light' ? elevation.sm : null;
  if (!onPress) return <View className={base} style={[tintStyle, lift]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className={cx(base, 'active:scale-[0.98]')} style={[tintStyle, lift]}>
      {children}
    </Pressable>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'dashed';

const BUTTON_KIND: Record<ButtonKind, string> = {
  primary: 'h-[54px] bg-accent active:bg-accent-pressed',
  secondary: 'h-12 border-[1.5px] border-field-border active:bg-chip',
  ghost: 'h-12 active:bg-chip',
  dashed: 'h-[46px] border-[1.5px] border-dashed border-field-border active:bg-chip',
};

export function Button({
  label,
  kind = 'primary',
  disabled,
  loading,
  icon,
  className,
  ...rest
}: PressableProps & { label: string; kind?: ButtonKind; loading?: boolean; icon?: ReactNode; className?: string }) {
  const p = useTheme();
  const isPrimary = kind === 'primary';
  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      className={cx('flex-row items-center justify-center gap-2 rounded-pill px-5', BUTTON_KIND[kind], disabled && 'opacity-45', className)}>
      {loading ? <ActivityIndicator color={isPrimary ? p.onAccent : p.text} /> : icon}
      <Text
        className={cx(
          isPrimary ? 'font-heading text-heading-button text-on-accent' : 'font-body-bold leading-[18px]',
          kind === 'dashed' ? 'text-[14px] text-accent-text' : !isPrimary && 'text-[15px] text-ink',
        )}>
        {label}
      </Text>
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
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} className="flex-row rounded-pill bg-chip p-[3px]">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            className={cx('flex-1 items-center rounded-pill py-[9px]', on && 'bg-card')}
            style={on ? elevation.sm : null}>
            <Text className="font-body-semibold text-ink text-[14px]">
              {o.label}
            </Text>
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
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected: !!selected }}
      className={cx('rounded-pill px-[14px] py-[9px]', selected ? 'bg-selected' : !tint && 'bg-chip')}
      style={!selected && tint ? { backgroundColor: tint } : null}>
      <Text
        className={cx('font-body-semibold text-[14px] leading-[18px]', selected ? 'text-on-selected' : !fg && 'text-ink')}
        style={!selected && fg ? { color: fg } : null}>
        {label}
      </Text>
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
    <View className="gap-2">
      {label ? (
        <Text className="font-body-semibold text-label text-muted">
          {label}
        </Text>
      ) : null}
      {children}
      {help ? (
        <Text className="font-body text-caption text-muted">
          {help}
        </Text>
      ) : null}
    </View>
  );
}

export function Input({ multiline, className, ref, ...rest }: TextInputProps & { ref?: React.Ref<TextInput> }) {
  const p = useTheme();
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={p.neutral[500]}
      multiline={multiline}
      {...rest}
      className={cx(
        'min-h-input border-[1.5px] border-field-border bg-field px-[18px] font-body-semibold text-[16px] text-ink',
        multiline ? 'rounded-md py-[14px] align-top' : 'rounded-pill py-0 align-middle',
        className,
      )}
    />
  );
}

export function Avatar({ marker, tint, size = 40 }: { marker: string; tint: string; size?: number }) {
  return (
    <View className="items-center justify-center" style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint }}>
      <Text style={{ fontSize: size * 0.48 }}>{marker}</Text>
    </View>
  );
}

export function Pill({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View className="self-start rounded-pill px-[10px] py-1" style={{ backgroundColor: bg }}>
      <Text style={{ color: fg }} className="font-body-bold text-[12px]">
        {label}
      </Text>
    </View>
  );
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <View className="rounded-md bg-chip px-4 py-3">
      <Text className="text-label font-body leading-[19px] text-neutral-800 dark:text-muted">
        {children}
      </Text>
    </View>
  );
}

export function SectionTitle({ title, caption, right }: { title: string; caption?: string; right?: ReactNode }) {
  return (
    <View className="gap-1">
      <View className="flex-row items-center justify-between">
        <Text className="font-heading text-display-xs text-ink">{title}</Text>
        {right}
      </View>
      {caption ? (
        <Text className="font-body text-body-sm text-muted">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

export function Overline({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <Text className={cx('font-body-bold text-overline uppercase', !color && 'text-muted')} style={color ? { color } : null}>
      {children}
    </Text>
  );
}

export function Row({ children, className, ...rest }: ViewProps & { children: ReactNode }) {
  return (
    <View {...rest} className={withDefaults('flex-row items-center gap-2', className)}>
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
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      className="min-h-[56px] flex-row items-center gap-3 rounded-md bg-card px-4 py-3 active:bg-chip">
      {left}
      <View className="flex-1 gap-0.5">
        <Text className="text-ink font-body-bold text-[15px]">
          {title}
        </Text>
        {sub ? (
          <Text className="font-body text-caption text-muted">
            {sub}
          </Text>
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
      className="h-14 w-14 items-center justify-center rounded-full bg-chip active:bg-neutral-300">
      <Text className="font-body-bold text-metric-sm text-ink">{label}</Text>
    </Pressable>
  );
  return (
    <View className="flex-row items-center gap-3">
      {btn('−', -1)}
      <View className="flex-1 items-center">
        <TextInput
          value={value}
          onChangeText={(t) => onChange(t.replace(',', '.'))}
          keyboardType="decimal-pad"
          selectTextOnFocus
          textAlign="center"
          accessibilityLabel="Value"
          className="min-w-[100px] font-body-bold text-[44px] leading-[50px] text-ink"
        />
        <Text className="font-body-semibold text-label text-muted">
          {unit}
        </Text>
      </View>
      {btn('+', 1)}
    </View>
  );
}

export function Skeleton({ height, width = '100%', radius }: { height: number; width?: number | `${number}%`; radius?: number }) {
  return <View className="rounded-card bg-chip opacity-80" style={[{ height, width }, radius !== undefined ? { borderRadius: radius } : null]} />;
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  const p = useTheme();
  return (
    <View className="items-start gap-3 rounded-card bg-card p-5">
      <View className="flex-row" style={{ gap: -12 }}>
        <View className="h-14 w-14 rounded-full" style={{ backgroundColor: p.accents.runner.tint }} />
        <View className="mt-5 h-10 w-10 rounded-full" style={{ backgroundColor: p.accents.parent.tint }} />
        <View className="h-7 w-7 rounded-full" style={{ backgroundColor: p.accents.writer.tint }} />
      </View>
      <Text className="font-heading text-display-sm text-ink">{title}</Text>
      <Text className="font-body text-body-md text-muted">
        {body}
      </Text>
      {action}
    </View>
  );
}
