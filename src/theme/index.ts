import { useColorScheme } from 'react-native';

import { useSettings } from '@/stores/settings';
import {
  colors,
  darkColors,
  elevation,
  fonts,
  identityAccents,
  identityAccentsDark,
  layout,
  radius,
  space,
  type,
} from './tokens';

export { colors, elevation, fonts, identityAccents, layout, radius, space, type };

export type AccentKey = keyof typeof identityAccents;
export const ACCENT_KEYS = Object.keys(identityAccents) as AccentKey[];

export interface Palette {
  scheme: 'light' | 'dark';
  bg: string;
  surface: string;
  card: string;
  cardRaised: string;
  text: string;
  textMuted: string;
  divider: string;
  accent: string;
  accentPressed: string;
  accentText: string;
  onAccent: string;
  positive: string;
  neutral: typeof colors.neutral;
  /** Selected chip / segmented fill (neutral 800 in light). */
  selected: string;
  onSelected: string;
  /** Input and row fills. */
  field: string;
  fieldBorder: string;
  chip: string;
  accents: Record<AccentKey, { base: string; tint: string; deep: string }>;
}

const light: Palette = {
  scheme: 'light',
  bg: colors.bg,
  surface: colors.surface,
  card: colors.neutral[100],
  cardRaised: colors.neutral[200],
  text: colors.text,
  textMuted: colors.neutral[700],
  divider: colors.divider,
  accent: colors.accent,
  accentPressed: colors.accentRamp[600],
  accentText: colors.accentRamp[700],
  onAccent: colors.neutral[100],
  positive: colors.accent2Ramp[700],
  neutral: colors.neutral,
  selected: colors.neutral[800],
  onSelected: colors.neutral[100],
  field: colors.neutral[100],
  fieldBorder: colors.neutral[400],
  chip: colors.neutral[200],
  accents: identityAccents,
};

const dark: Palette = {
  scheme: 'dark',
  bg: darkColors.bg,
  surface: darkColors.surface,
  card: darkColors.card,
  cardRaised: darkColors.cardRaised,
  text: darkColors.text,
  textMuted: darkColors.textMuted,
  divider: darkColors.divider,
  accent: darkColors.accent,
  accentPressed: colors.accentRamp[400],
  accentText: darkColors.accentText,
  onAccent: darkColors.bg,
  positive: darkColors.accent2Text,
  neutral: colors.neutral,
  selected: colors.neutral[200],
  onSelected: colors.neutral[900],
  field: darkColors.cardRaised,
  fieldBorder: colors.neutral[700],
  chip: darkColors.cardRaised,
  accents: identityAccentsDark,
};

export function useTheme(): Palette {
  const system = useColorScheme();
  const appearance = useSettings((s) => s.appearance);
  const scheme = appearance === 'system' ? (system === 'dark' ? 'dark' : 'light') : appearance;
  return scheme === 'dark' ? dark : light;
}

export function accentFor(p: Palette, key: string | null | undefined) {
  return p.accents[(key as AccentKey) in p.accents ? (key as AccentKey) : 'runner'];
}
