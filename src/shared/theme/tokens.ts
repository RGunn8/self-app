// Generated from the Identity Dashboard Spec (theme.ts). Edit tokens here, not inline.
export const colors = {
  bg: '#f5f6f8',
  surface: '#eceef1',
  text: '#18181b',
  accent: '#c67139',
  accent2: '#7a8a5e',
  divider: 'rgba(24,24,27,0.16)',
  neutral: { 100: '#ffffff', 200: '#eef0f3', 300: '#d3d4d7', 400: '#b6b7ba', 500: '#97989b', 600: '#797a7d', 700: '#5c5d5f', 800: '#414245', 900: '#2a2b2d' },
  accentRamp: { 100: '#fff2eb', 200: '#ffe1d0', 300: '#ffc6a5', 400: '#f6a06b', 500: '#d67f48', 600: '#b2622d', 700: '#8c491a', 800: '#643312', 900: '#402310' },
  accent2Ramp: { 100: '#f0fae1', 200: '#e1eecc', 300: '#ccdbb2', 400: '#aebf92', 500: '#8fa073', 600: '#728157', 700: '#56633f', 800: '#3d472b', 900: '#272e1b' },
} as const;

// Per-identity accents: user picks one when creating an identity
export const identityAccents = {
  runner: { base: '#b7684c', tint: '#fcdfd5', deep: '#713d2a' },
  parent: { base: '#5b904f', tint: '#daecd6', deep: '#34582c' },
  writer: { base: '#4984bf', tint: '#d5e9fd', deep: '#285077' },
  financial: { base: '#9e7a23', tint: '#f1e5cc', deep: '#61490c' },
  musician: { base: '#a5679f', tint: '#f4def2', deep: '#653c62' },
  teal: { base: '#009494', tint: '#cceeed', deep: '#005a5b' },
} as const;

export const darkColors = {
  bg: '#141416', surface: '#1c1c1f', card: '#2a2b2d', cardRaised: '#2e2e33',
  text: '#ffffff', textMuted: '#b6b7ba', divider: 'rgba(250,250,250,0.14)',
  accent: '#d67f48', accentText: '#f6a06b', accent2Text: '#aebf92',
} as const;

export const identityAccentsDark = {
  runner: { base: '#df8c6f', tint: '#452c23', deep: '#fdd4c6' },
  parent: { base: '#7fb673', tint: '#283824', deep: '#cde7c7' },
  writer: { base: '#6da9e7', tint: '#233447', deep: '#c6e1ff' },
  financial: { base: '#c49f4d', tint: '#3c311a', deep: '#eddcb9' },
  musician: { base: '#cc8bc5', tint: '#3f2b3d', deep: '#f2d3ee' },
  teal: { base: '#36baba', tint: '#173939', deep: '#b8e9e8' },
} as const;

export const fonts = {
  heading: 'Caprasimo_400Regular',
  body: 'Figtree_400Regular',
  bodySemibold: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
} as const;

export const type = {
  displayXl: { fontFamily: fonts.heading, fontSize: 36, lineHeight: 40 },
  displayLg: { fontFamily: fonts.heading, fontSize: 31, lineHeight: 34 },
  displayMd: { fontFamily: fonts.heading, fontSize: 28, lineHeight: 32 },
  displaySm: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 28 },
  displayXs: { fontFamily: fonts.heading, fontSize: 22, lineHeight: 26 },
  headingCard: { fontFamily: fonts.heading, fontSize: 19, lineHeight: 23 },
  headingButton: { fontFamily: fonts.heading, fontSize: 17, lineHeight: 20 },
  metricXl: { fontFamily: fonts.bodyBold, fontSize: 34, lineHeight: 38 },
  metricLg: { fontFamily: fonts.bodyBold, fontSize: 30, lineHeight: 33 },
  metricMd: { fontFamily: fonts.bodyBold, fontSize: 26, lineHeight: 30 },
  metricSm: { fontFamily: fonts.bodyBold, fontSize: 22, lineHeight: 26 },
  bodyLg: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  bodyMd: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23 },
  bodySm: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14, letterSpacing: 1.3, textTransform: 'uppercase' },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { sm: 8, md: 20, lg: 24, card: 28, sheet: 32, pill: 999 } as const;

const shadowColor = '#2a2b2d';
export const elevation = {
  sm: { shadowColor, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.14, shadowRadius: 1, elevation: 1 },
  md: { shadowColor, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 5, elevation: 3 },
  lg: { shadowColor, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 16, elevation: 8 },
} as const;

export const layout = {
  screenGutter: space.xl,     // 20
  sectionGap: space.xxl,      // 24
  cardPadding: space.lg,      // 16
  minHitTarget: 44,
  headerHeight: 48,
  tabBarHeight: 50,           // + safe-area bottom
  fabHeight: 56,
  buttonHeight: 52,
  inputHeight: 50,
} as const;
