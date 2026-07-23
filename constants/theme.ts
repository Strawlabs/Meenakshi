// ============================================================
// Stitch Design System Tokens — Meenakshi AI
// Light: Ambient Intelligence System
// Dark: Kinetic Finance
// ============================================================

export type ThemeColors = typeof LightColors;

export const LightColors = {
  // ---- Core Palette ----
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

  // ---- Computed helpers ----
  glass: 'rgba(255,255,255,0.70)',
  glassBorder: 'rgba(255,255,255,0.50)',
  glassPanel: 'rgba(255,255,255,0.05)',
  glassPanelBorder: 'rgba(255,255,255,0.10)',
  secondaryGlow: 'rgba(107,56,212,0.4)',
  secondaryFaint: 'rgba(14, 165, 233, 0.1)',

  // Legacy Aliases
  purple: '#8B5CF6',
  purpleLight: 'rgba(139, 92, 246, 0.15)',
  bgCardAlt: 'rgba(255,255,255,0.05)',
  textMuted: '#9CA3AF',
};

export const DarkColors: ThemeColors = {
  // ---- Core Palette ----
  primary: '#c0c1ff',
  onPrimary: '#1000a9',
  primaryContainer: '#8083ff',
  onPrimaryContainer: '#0d0096',
  primaryFixed: '#e1e0ff',
  primaryFixedDim: '#c0c1ff',
  onPrimaryFixed: '#07006c',
  onPrimaryFixedVariant: '#2f2ebe',

  secondary: '#d0bcff',
  onSecondary: '#3c0091',
  secondaryContainer: '#571bc1',
  onSecondaryContainer: '#c4abff',
  secondaryFixed: '#e9ddff',
  secondaryFixedDim: '#d0bcff',
  onSecondaryFixed: '#23005c',
  onSecondaryFixedVariant: '#5516be',

  tertiary: '#66dd8b',
  onTertiary: '#003919',
  tertiaryContainer: '#25a55a',
  onTertiaryContainer: '#003115',
  tertiaryFixed: '#83fba5',
  tertiaryFixedDim: '#66dd8b',
  onTertiaryFixed: '#00210c',
  onTertiaryFixedVariant: '#005227',

  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#93000a',
  onErrorContainer: '#ffdad6',

  // ---- Surfaces ----
  background: '#0b1326',
  onBackground: '#dae2fd',
  surface: '#0b1326',
  surfaceBright: '#31394d',
  surfaceDim: '#0b1326',
  surfaceVariant: '#2d3449',
  onSurface: '#dae2fd',
  onSurfaceVariant: '#c7c4d7',
  surfaceContainer: '#171f33',
  surfaceContainerLow: '#131b2e',
  surfaceContainerHigh: '#222a3d',
  surfaceContainerHighest: '#2d3449',
  surfaceContainerLowest: '#060e20',

  // ---- Misc ----
  outline: '#908fa0',
  outlineVariant: '#464554',
  inverseSurface: '#dae2fd',
  inverseOnSurface: '#283044',
  inversePrimary: '#494bd6',
  surfaceTint: '#c0c1ff',

  // ---- Computed helpers ----
  glass: 'rgba(34, 42, 61, 0.70)', // Dark mode glass equivalent
  glassBorder: 'rgba(255,255,255,0.15)',
  glassPanel: 'rgba(255,255,255,0.03)',
  glassPanelBorder: 'rgba(255,255,255,0.08)',
  secondaryGlow: 'rgba(208,188,255,0.4)',
  secondaryFaint: 'rgba(59, 130, 246, 0.08)',

  // Legacy Aliases
  purple: '#8B5CF6',
  purpleLight: 'rgba(139, 92, 246, 0.15)',
  bgCardAlt: '#F5F5F5',
  textMuted: '#6B7280',
};

// Default export for non-refactored files
export const Colors = LightColors;

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
  bodySm: 14,
  bodyMd: 16,
  bodyLg: 18,
  headlineSm: 20,
  headlineLg: 32,
  headlineMobile: 28,
  displayLg: 48,
};

export const LightTypography = {
  displayLg: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 48,
    lineHeight: 52.8,
    letterSpacing: -0.96,
  },
  headlineLg: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 32,
    lineHeight: 38.4,
    letterSpacing: -0.32,
  },
  headlineLgMobile: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 28,
    lineHeight: 33.6,
  },
  headlineSm: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  bodyLg: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 18,
    lineHeight: 28.8,
  },
  bodyMd: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 16,
    lineHeight: 25.6,
  },
  bodySm: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  labelSm: {
    fontFamily: 'Manrope_600SemiBold',
    fontSize: 12,
    lineHeight: 12,
    letterSpacing: 0.6,
  },
};

export const DarkTypography = {
  displayLg: {
    fontFamily: 'HankenGrotesk_700Bold',
    fontSize: 48,
    lineHeight: 52.8,
    letterSpacing: -0.96,
  },
  headlineLg: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 32,
    lineHeight: 38.4,
    letterSpacing: -0.32,
  },
  headlineLgMobile: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 28,
    lineHeight: 33.6,
  },
  headlineSm: {
    fontFamily: 'HankenGrotesk_600SemiBold',
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  bodyLg: {
    fontFamily: 'Inter_400Regular',
    fontSize: 18,
    lineHeight: 28.8,
  },
  bodyMd: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    lineHeight: 25.6,
  },
  bodySm: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  labelSm: {
    fontFamily: 'JetBrainsMono_500Medium',
    fontSize: 12,
    lineHeight: 12,
    letterSpacing: 0.6,
  },
};

export type ThemeTypography = typeof LightTypography;
export const Typography = LightTypography;
