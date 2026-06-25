---
name: Ambient Intelligence System
colors:
  surface: '#faf9f6'
  surface-dim: '#dbdad7'
  surface-bright: '#faf9f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f1'
  surface-container: '#efeeeb'
  surface-container-high: '#e9e8e5'
  surface-container-highest: '#e3e2e0'
  on-surface: '#1a1c1a'
  on-surface-variant: '#45464d'
  inverse-surface: '#2f312f'
  inverse-on-surface: '#f2f1ee'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#6b38d4'
  on-secondary: '#ffffff'
  secondary-container: '#8455ef'
  on-secondary-container: '#fffbff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#00201d'
  on-tertiary-container: '#0c9488'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#e9ddff'
  secondary-fixed-dim: '#d0bcff'
  on-secondary-fixed: '#23005c'
  on-secondary-fixed-variant: '#5516be'
  tertiary-fixed: '#89f5e7'
  tertiary-fixed-dim: '#6bd8cb'
  on-tertiary-fixed: '#00201d'
  on-tertiary-fixed-variant: '#005049'
  background: '#faf9f6'
  on-background: '#1a1c1a'
  surface-variant: '#e3e2e0'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.2'
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  label-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding-mobile: 20px
  container-padding-desktop: 40px
  gutter: 16px
  stack-sm: 8px
  stack-md: 24px
  stack-lg: 48px
---

## Brand & Style

This design system is built on the philosophy of **Ambient Intelligence**. It moves away from the rigid, transactional nature of traditional fintech and adopts the persona of a calm, sophisticated digital companion. The brand personality is "Intelligent Serenity"—it is knowledgeable but unobtrusive, professional but deeply human.

The visual style is a fusion of **Minimalism** and **Glassmorphism**. By using translucent layers and soft background blurs, the UI feels like an "operating system" layered over the user's life rather than a static application. The aesthetic prioritizes breathability, reduced cognitive load, and a high-end, tactile quality that evokes trust and technical sophistication.

## Colors

The palette is designed to deviate from "banking blue," opting instead for a deep, cinematic **Midnight Indigo** as the primary anchor. This provides a sense of depth and authority. 

- **Primary (Midnight Indigo):** Used for primary text, deep backgrounds, and core branding elements.
- **Secondary (Soft Violet):** Represents the "AI Brain." Used for accents, active states, and soft glows.
- **Background (Warm Off-White):** A high-quality, paper-like neutral that feels more premium and less sterile than pure white.
- **Semantic Signals:** **Teal** is used for positive financial growth and confirmation, while **Amber** provides a soft nudge for reminders without inducing anxiety.

Color application should lean heavily into translucency (60-80% opacity) for surface elements to maintain the glassmorphic effect.

## Typography

The design system utilizes **Manrope** for its balanced, modern, and technical yet friendly character. The typography scale is intentionally spacious to reinforce the premium feel.

- **Headlines:** Use generous leading and tight letter-spacing for a sophisticated, editorial look. Display sizes are reserved for AI insights and balance summaries.
- **Conversational Body Text:** Set at a slightly larger base (18px) to ensure that the AI dialogue feels comfortable and legible during long interactions.
- **Labels:** Small caps with increased tracking are used for metadata and financial categories to provide a clear distinction from conversational text.

## Layout & Spacing

The layout follows a **Mobile-First, Conversational Fluidity** model. 

- **Grid:** A 12-column fluid grid for desktop, and a single-column stack for mobile. Content is primarily card-based, with cards spanning the full width of the safe area on mobile.
- **Rhythm:** An 8px linear scale is used. However, "Oxygen" is a key component; large vertical gaps (48px+) are used between major cognitive sections to prevent the UI from feeling cluttered.
- **Conversation Thread:** The primary layout is a center-aligned thread. AI responses have wider margins than user inputs to create a distinct visual "rhythm" in the dialogue.

## Elevation & Depth

This design system rejects heavy, drop-shadow-based elevation in favor of **Tonal Layering and Backdrop Blurs**.

1.  **Level 0 (Floor):** The Warm Off-White background.
2.  **Level 1 (Cards):** White surfaces with 70% opacity and a 20px `backdrop-filter: blur()`. A 1px border of `rgba(255,255,255, 0.5)` is used to define the edge.
3.  **Level 2 (Active Orbs):** Elements that represent the AI's presence use a soft, 40px colored glow (Secondary Violet) rather than a shadow, creating a "light-emitting" effect.
4.  **Interaction:** When a user interacts with a card, it should subtly scale (1.02x) rather than rise, maintaining the glassmorphic "sheet" feel.

## Shapes

The shape language is organic and approachable. Standard UI containers use a **16px radius**, while larger content cards and the main interaction hub use a **24px radius** to feel "softer" and more evolved.

Interactive elements like buttons and "chips" should never have sharp corners. The AI "Orb" is a perfect circle, representing unity and the infinite nature of intelligence.

## Components

### The AI Orb
The central component of the design system. A floating, gradient-filled circle (Indigo to Violet) that sits at the bottom or center of the screen. It uses a "breathing" animation (subtle scale and opacity pulse) when the AI is processing or listening.

### Glass Cards
All financial data is housed in glassmorphic cards. They must include a subtle inner highlight on the top edge to simulate thickness.

### Conversational Inputs
The text input is not a boxed field but a "shelf" that expands. It should feel like a natural part of the conversation thread, using a ghost-label style that disappears when typing begins.

### Smart Chips
Used for quick financial actions (e.g., "Analyze Spend," "Save This"). These are pill-shaped with a Soft Violet tint and high-contrast Indigo text.

### Positive Signal Indicators
For successful savings or "green" financial days, use Teal glows rather than flat icons. The glow should emanate from the value itself, suggesting energy and growth.