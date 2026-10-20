// Tokens mirror src/shared/theme/tokens.ts. Themed colors come from CSS variables in global.css.
// Static ramps, copied from src/shared/theme/tokens.ts (this file can't import TypeScript).
const colors = {
  neutral: { 100: '#ffffff', 200: '#eef0f3', 300: '#d3d4d7', 400: '#b6b7ba', 500: '#97989b', 600: '#797a7d', 700: '#5c5d5f', 800: '#414245', 900: '#2a2b2d' },
  accentRamp: { 100: '#fff2eb', 200: '#ffe1d0', 300: '#ffc6a5', 400: '#f6a06b', 500: '#d67f48', 600: '#b2622d', 700: '#8c491a', 800: '#643312', 900: '#402310' },
  accent2Ramp: { 100: '#f0fae1', 200: '#e1eecc', 300: '#ccdbb2', 400: '#aebf92', 500: '#8fa073', 600: '#728157', 700: '#56633f', 800: '#3d472b', 900: '#272e1b' },
};

const themed = (name) => `rgb(var(--${name}) / <alpha-value>)`;
const THEMED = [
  'bg', 'surface', 'card', 'card-raised', 'ink', 'muted', 'accent', 'accent-pressed', 'accent-text',
  'on-accent', 'positive', 'selected', 'on-selected', 'field', 'field-border', 'chip',
];

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ...Object.fromEntries(THEMED.map((n) => [n, themed(n)])),
        // Light divider is ink at 16%, dark is near-white at 14%.
        divider: 'rgb(var(--divider) / 0.15)',
        neutral: colors.neutral,
        'accent-ramp': colors.accentRamp,
        'accent2-ramp': colors.accent2Ramp,
      },
      fontFamily: {
        heading: ['Caprasimo_400Regular'],
        body: ['Figtree_400Regular'],
        'body-semibold': ['Figtree_600SemiBold'],
        'body-bold': ['Figtree_700Bold'],
      },
      fontSize: {
        'display-xl': ['36px', '40px'],
        'display-lg': ['31px', '34px'],
        'display-md': ['28px', '32px'],
        'display-sm': ['24px', '28px'],
        'display-xs': ['22px', '26px'],
        'heading-card': ['19px', '23px'],
        'heading-button': ['17px', '20px'],
        'metric-xl': ['34px', '38px'],
        'metric-lg': ['30px', '33px'],
        'metric-md': ['26px', '30px'],
        'metric-sm': ['22px', '26px'],
        'body-lg': ['16px', '23px'],
        'body-md': ['15px', '23px'],
        'body-sm': ['14px', '21px'],
        label: ['13px', '18px'],
        caption: ['12px', '16px'],
        overline: ['11px', { lineHeight: '14px', letterSpacing: '1.3px' }],
      },
      borderRadius: { sm: '8px', md: '20px', lg: '24px', card: '28px', sheet: '32px', pill: '999px' },
      spacing: { gutter: '20px', section: '24px', button: '52px', input: '50px', fab: '56px', header: '48px', hit: '44px' },
    },
  },
  plugins: [],
};
