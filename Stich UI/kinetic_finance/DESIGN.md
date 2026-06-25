---
name: Kinetic Finance
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#d0bcff'
  on-secondary: '#3c0091'
  secondary-container: '#571bc1'
  on-secondary-container: '#c4abff'
  tertiary: '#66dd8b'
  on-tertiary: '#003919'
  tertiary-container: '#25a55a'
  on-tertiary-container: '#003115'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#83fba5'
  tertiary-fixed-dim: '#66dd8b'
  on-tertiary-fixed: '#00210c'
  on-tertiary-fixed-variant: '#005227'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.05em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  xxl: 64px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style
The design system is engineered for a high-performance fintech environment where precision meets modern fluidity. The brand personality is **authoritative yet visionary**, targeting sophisticated investors and institutional users who require clarity and speed. 

We utilize a **Modern Corporate** style with **Glassmorphic** accents. The interface relies on high-quality typography and a systematic hierarchy to communicate trust. Visual interest is generated through subtle depth, vibrant status indicators, and a clean, spacious layout that prevents cognitive overload during intense data analysis.

## Colors
The palette is rooted in a deep, dark environment to reduce eye strain and emphasize critical data signals. 

- **Core Brand:** Indigo (#6366F1) and Violet (#8B5CF6) serve as the primary identifiers for actions and navigation.
- **Financial Signals:** 
    - **Emerald Green (#50C878):** Used exclusively for positive growth, upward trends, and success states. It should always maintain high contrast against the dark background.
    - **Deep Bottle Green (#00674F):** Reserved for subtle accents, secondary success backgrounds, and deep structural elements that require a green hue without the "vibrancy" of the Emerald signal.
- **Neutral:** A range of Slate and Navy tones provide the structural foundation.

## Typography
The typographic system balances the warmth of **Hanken Grotesk** for headlines with the utilitarian precision of **Inter** for dense data. 

**JetBrains Mono** is employed for labels, tickers, and numerical values to emphasize the technical, data-driven nature of the platform. Numerical data should always use tabular lining to ensure columns of figures align perfectly for easy comparison.

## Layout & Spacing
This design system utilizes a **12-column fluid grid** for desktop and a **4-column grid** for mobile. 

The spacing rhythm is built on a 4px base unit. Layouts should prioritize information density without sacrificing legibility. 
- **Desktop:** 24px gutters with 48px side margins. 
- **Mobile:** 16px gutters with 16px side margins.
- **Data Tables:** Use a condensed 8px vertical padding for row items to maximize the visible data on screen.

## Elevation & Depth
Depth is created through **Tonal Layering** and **Backdrop Blurs**. Shadows are avoided in favor of subtle border treatments and inner glows.

- **Level 0 (Base):** Deep Navy (#020617).
- **Level 1 (Cards/Panels):** Slate (#0F172A) with a 1px border (#1E293B).
- **Level 2 (Modals/Popovers):** Semi-transparent Slate with a 20px backdrop blur and a bright 1px Indigo top-border to suggest light catch.
- **Positive Elevation:** Elements representing growth (using Emerald Green) can utilize a soft, 8% opacity Emerald outer glow to simulate luminescence.

## Shapes
The shape language is **Soft (0.25rem)** to maintain a professional, precise feel. Larger components like cards use **rounded-lg (0.5rem)**. 

Avoid full pill-shaping except for status tags (chips). Interactive inputs and buttons must remain slightly squared to communicate the stability of a financial instrument.

## Components
- **Buttons:** Primary buttons use the Indigo gradient. Success actions use a Deep Bottle Green base with Emerald Green text for high-contrast legibility.
- **Financial Signals:** Use "Trend Chips"—small indicators using Emerald Green for positive % change, paired with a JetBrains Mono font.
- **Input Fields:** Use a dark-fill background with a 1px border that illuminates to Indigo on focus.
- **Cards:** No shadows. Use a subtle 1px border. For "featured" growth assets, use a Deep Bottle Green subtle gradient background.
- **Lists:** Data rows should have a subtle hover state (#1E293B) and clear dividers.
- **Charts:** Use Emerald Green (#50C878) for the primary "Value" line in growth charts.