// ============================================================
// Stitch Design System Tokens — Meenakshi AI
// Source: Stitch design export (canonical UI/UX reference)
// ============================================================

export const Colors = {
  // ---- Stitch Core Palette ----
  primary: '#000000',
  onPrimary: '#ffffff',
  primaryContainer: '#131b2e',
  onPrimaryContainer: '#7c839b',
  primaryFixed: '#dae2fd',
  primaryFixedDim: '#bec6e0',
  onPrimaryFixed: '#131b2e',
  onPrimaryFixedVariant: '#3f465c',

  secondary: '#6b38d4',
  onSecondary: '#ffffff',
  secondaryContainer: '#8455ef',
  onSecondaryContainer: '#fffbff',
  secondaryFixed: '#e9ddff',
  secondaryFixedDim: '#d0bcff',
  onSecondaryFixed: '#23005c',
  onSecondaryFixedVariant: '#5516be',

  tertiary: '#000000',
  onTertiary: '#ffffff',
  tertiaryContainer: '#00201d',
  onTertiaryContainer: '#0c9488',
  tertiaryFixed: '#89f5e7',
  tertiaryFixedDim: '#6bd8cb',
  onTertiaryFixed: '#00201d',
  onTertiaryFixedVariant: '#005049',

  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',

  // ---- Surfaces ----
  background: '#faf9f6',
  onBackground: '#1a1c1a',
  surface: '#faf9f6',
  surfaceBright: '#faf9f6',
  surfaceDim: '#dbdad7',
  surfaceVariant: '#e3e2e0',
  onSurface: '#1a1c1a',
  onSurfaceVariant: '#45464d',
  surfaceContainer: '#efeeeb',
  surfaceContainerLow: '#f4f3f1',
  surfaceContainerHigh: '#e9e8e5',
  surfaceContainerHighest: '#e3e2e0',
  surfaceContainerLowest: '#ffffff',

  // ---- Misc ----
  outline: '#76777d',
  outlineVariant: '#c6c6cd',
  inverseSurface: '#2f312f',
  inverseOnSurface: '#f2f1ee',
  inversePrimary: '#bec6e0',
  surfaceTint: '#565e74',

  // ---- Dark mode (voice screen) ----
  // Primary container used as dark bg
  darkBg: '#131b2e',

  // ---- Computed helpers ----
  glass: 'rgba(255,255,255,0.70)',
  glassBorder: 'rgba(255,255,255,0.50)',
  glassPanel: 'rgba(255,255,255,0.05)',
  glassPanelBorder: 'rgba(255,255,255,0.10)',
  secondaryGlow: 'rgba(107,56,212,0.4)',
  secondaryFaint: 'rgba(107,56,212,0.10)',

  // ---- Backward compatibility aliases (old dark-theme names → Stitch tokens) ----
  bg: '#faf9f6',
  bgCard: 'rgba(255,255,255,0.70)',
  bgCardAlt: '#e9e8e5',
  bgGlass: 'rgba(255,255,255,0.05)',
  purple: '#6b38d4',
  purpleLight: '#8455ef',
  purpleFaint: '#e9ddff',
  purpleGlow: '#d0bcff',
  accent: '#6b38d4',
  textPrimary: '#1a1c1a',
  textSecondary: '#45464d',
  textMuted: '#76777d',
  border: '#c6c6cd',
  borderStrong: '#76777d',
  green: '#6bd8cb',
  greenFaint: '#00201d',
  amber: '#ba1a1a',
  amberFaint: '#ffdad6',
  red: '#ba1a1a',
  redFaint: '#ffdad6',
};


export const Spacing = {
  base: 8,
  containerMobile: 20,
  containerDesktop: 40,
  gutter: 16,
  stackSm: 8,
  stackMd: 24,
  stackLg: 48,
  
  // Legacy aliases
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 4,     // 0.25rem
  DEFAULT: 8, // 0.5rem
  md: 12,    // 0.75rem
  lg: 16,    // 1rem
  xl: 24,    // 1.5rem
  full: 9999,
};

export const FontSize = {
  labelSm: 12,
  bodyMd: 16,
  bodyLg: 18,
  headlineLg: 32,
  headlineMobile: 28,
  displayLg: 48,
};

export const Typography = {
  displayLg: {
    fontSize: 48,
    fontWeight: '700' as const,
    lineHeight: 52.8, // 48 * 1.1
    letterSpacing: -0.96, // 48 * -0.02
  },
  headlineLg: {
    fontSize: 32,
    fontWeight: '600' as const,
    lineHeight: 38.4, // 32 * 1.2
    letterSpacing: -0.32, // 32 * -0.01
  },
  headlineLgMobile: {
    fontSize: 28,
    fontWeight: '600' as const,
    lineHeight: 33.6, // 28 * 1.2
  },
  bodyLg: {
    fontSize: 18,
    fontWeight: '400' as const,
    lineHeight: 28.8, // 18 * 1.6
  },
  bodyMd: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 25.6, // 16 * 1.6
  },
  labelSm: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 12, // 12 * 1
    letterSpacing: 0.6, // 12 * 0.05
  },
};
