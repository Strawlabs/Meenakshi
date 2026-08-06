import { useAppTheme } from '../context/ThemeContext';
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Easing,
  Dimensions,
  Platform,
  ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Spacing, Radius } from '../constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle as SvgCircle, Line, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import GlassCard from '../components/GlassCard';
import AIOrb from '../components/AIOrb';
import StitchIcon from '../components/StitchIcon';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Welcome'>;
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Stitch: Central orb = w-32 h-32 = 128px
const ORB_SIZE = 128;

// Stitch: Illustration area max-h-[340px]
const ILLUSTRATION_MAX_HEIGHT = 340;

// Stitch floating data point icons with Material Symbol names
// Positions: top:15%, left/right:15%, bottom:15%
// Delays: 0s (Wealth), 1s (Gmail), 2s (Events), 3s (Docs) — from Stitch CSS classes
const DATA_POINTS = [
  { icon: 'mail', label: 'Gmail', pos: { top: '15%', left: '15%' }, delay: 1000 },
  { icon: 'calendar_today', label: 'Events', pos: { top: '15%', right: '15%' }, delay: 2000 },
  { icon: 'description', label: 'Docs', pos: { bottom: '15%', left: '15%' }, delay: 3000 },
  { icon: 'account_balance_wallet', label: 'Wealth', pos: { bottom: '15%', right: '15%' }, delay: 0 },
];

function FloatingCard({
  icon,
  label,
  pos,
  delay }: {
  icon: string;
  label: string;
  pos: object;
  delay: number;
}) {
  const { colors: Colors, typography } = useAppTheme();

  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Stitch: float animation — 6s total, translateY(0 → -15px), ease-in-out
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -15,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          delay }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        pos as any,
        { transform: [{ translateY: floatAnim }], position: 'absolute', zIndex: 10 },
      ]}
    >
      {/* Stitch: glass-card p-4 rounded-xl (p-4 = 16px, rounded-xl = 12px) */}
      <GlassCard borderRadius={12} style={floatingCardStyles.card}>
        <View style={floatingCardStyles.cardInner}>
          {/* Stitch: Material Symbol icon, text-secondary, filled */}
          <StitchIcon name={icon} size={24} color={Colors.secondary} />
          {/* Stitch: font-label-sm text-label-sm mt-1 text-on-surface-variant */}
          <Text style={[
            typography.labelSm,
            { color: Colors.onSurfaceVariant, marginTop: 4 }
          ]}>{label}</Text>
        </View>
      </GlassCard>
    </Animated.View>
  );
}

const floatingCardStyles = StyleSheet.create({
  card: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: {
        elevation: 0,
      }
    })
  },
  cardInner: {
    padding: 16,
    alignItems: 'center',
  },
});

export default function WelcomeScreen({ navigation }: Props) {
  const { colors: Colors, typography } = useAppTheme();
  const styles = getStyles(Colors, typography);

  // Ambient glow — pulse + smooth wandering across entire screen
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0.7)).current;
  // Multi-waypoint wandering — visits all areas of the screen
  const glowDriftX = useRef(new Animated.Value(0)).current;
  const glowDriftY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse: gentle scale + opacity breathe
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 1.15,
            duration: 10000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true }),
          Animated.timing(glowOpacity, {
            toValue: 1,
            duration: 10000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(glowScale, {
            toValue: 1,
            duration: 10000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true }),
          Animated.timing(glowOpacity, {
            toValue: 0.7,
            duration: 10000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true }),
        ]),
      ])
    ).start();

    // Wandering path — 6 waypoints visiting all screen areas
    // Each leg 10-14s for ultra-smooth, barely-perceptible drift
    // Total loop ~70s so it never feels repetitive
    const wander = (
      x: Animated.Value,
      y: Animated.Value,
    ) => {
      Animated.loop(
        Animated.sequence([
          // Waypoint 1: drift to upper-right
          Animated.parallel([
            Animated.timing(x, { toValue: 120, duration: 12000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(y, { toValue: -100, duration: 12000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
          // Waypoint 2: sweep down to lower-center
          Animated.parallel([
            Animated.timing(x, { toValue: 20, duration: 11000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(y, { toValue: 140, duration: 11000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
          // Waypoint 3: drift to upper-left
          Animated.parallel([
            Animated.timing(x, { toValue: -110, duration: 13000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(y, { toValue: -60, duration: 13000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
          // Waypoint 4: move to center-right
          Animated.parallel([
            Animated.timing(x, { toValue: 90, duration: 10000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(y, { toValue: 40, duration: 10000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
          // Waypoint 5: sweep to lower-left
          Animated.parallel([
            Animated.timing(x, { toValue: -80, duration: 12000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(y, { toValue: 120, duration: 12000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
          // Waypoint 6: rise to upper-center then loop
          Animated.parallel([
            Animated.timing(x, { toValue: 0, duration: 11000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(y, { toValue: 0, duration: 11000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
        ])
      ).start();
    };

    wander(glowDriftX, glowDriftY);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Ambient glow — multi-layered soft radial gradients
          Stitch uses filter:blur(60px) on a gradient — we simulate with
          SVG RadialGradient that feathers from lavender core to transparent edges.
          Multiple layers create depth and richness. */}

      {/* Layer 1: Large outer halo — soft lavender wash, wanders around screen */}
      <Animated.View style={[
        styles.ambientGlowOuter,
        { transform: [
          { scale: glowScale },
          { translateX: glowDriftX },
          { translateY: glowDriftY },
        ], opacity: glowOpacity }
      ]}>
        <Svg width={700} height={700} viewBox="0 0 700 700">
          <Defs>
            <RadialGradient id="outerGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#c4a7ff" stopOpacity="0.7" />
              <Stop offset="25%" stopColor="#d0bcff" stopOpacity="0.5" />
              <Stop offset="50%" stopColor="#ddd0ff" stopOpacity="0.3" />
              <Stop offset="75%" stopColor="#e9ddff" stopOpacity="0.12" />
              <Stop offset="100%" stopColor="#f0eaff" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <SvgCircle cx="350" cy="350" r="350" fill="url(#outerGlow)" />
        </Svg>
      </Animated.View>

      {/* Layer 2: Inner core glow — deeper purple, concentrated, also wanders */}
      <Animated.View style={[
        styles.ambientGlowInner,
        { transform: [
          { scale: glowScale },
          { translateX: glowDriftX },
          { translateY: glowDriftY },
        ], opacity: glowOpacity }
      ]}>
        <Svg width={450} height={450} viewBox="0 0 450 450">
          <Defs>
            <RadialGradient id="innerGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#6b38d4" stopOpacity="0.55" />
              <Stop offset="25%" stopColor="#8455ef" stopOpacity="0.35" />
              <Stop offset="50%" stopColor="#b08dff" stopOpacity="0.18" />
              <Stop offset="75%" stopColor="#d0bcff" stopOpacity="0.06" />
              <Stop offset="100%" stopColor="#d0bcff" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <SvgCircle cx="225" cy="225" r="225" fill="url(#innerGlow)" />
        </Svg>
      </Animated.View>

      {/* Bottom lavender gradient wash — subtle tint behind bento/CTA area */}
      <LinearGradient
        colors={['transparent', 'rgba(208,188,255,0.12)', 'rgba(208,188,255,0.2)']}
        locations={[0, 0.5, 1]}
        style={styles.bottomGradientWash}
      />

      {/* Header — Stitch: fixed top, centered, h-16 */}
      <View style={styles.header}>
        <Text style={styles.brandName}>Meenakshi</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Central illustration area — Stitch: aspect-square, max-h-[340px] */}
        <View style={styles.illustrationArea}>
          {/* Stitch: SVG connectivity lines + dashed ring */}
          <View style={styles.svgContainer}>
            <Svg width="100%" height="100%" viewBox="0 0 400 400">
              {/* Dashed ring — Stitch: r=120, stroke-dasharray="4 4" */}
              <SvgCircle
                cx="200"
                cy="200"
                r="120"
                fill="none"
                stroke="#6b38d4"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity={0.3}
              />
              {/* Connection lines — center (200,200) to corners */}
              <Line x1="200" y1="200" x2="100" y2="100" stroke="#6b38d4" strokeWidth="1" opacity={0.3} />
              <Line x1="200" y1="200" x2="300" y2="100" stroke="#6b38d4" strokeWidth="1" opacity={0.3} />
              <Line x1="200" y1="200" x2="100" y2="300" stroke="#6b38d4" strokeWidth="1" opacity={0.3} />
              <Line x1="200" y1="200" x2="300" y2="300" stroke="#6b38d4" strokeWidth="1" opacity={0.3} />
            </Svg>
          </View>

          {/* Central Orb — Stitch: w-32 h-32, with blur_on icon */}
          <AIOrb size={ORB_SIZE}>
            <StitchIcon name="blur_on" size={48} color="#ffffff" />
          </AIOrb>

          {/* Floating Data Cards */}
          {DATA_POINTS.map(dp => (
            <FloatingCard key={dp.label} {...dp} />
          ))}
        </View>

        {/* Headline section — Stitch: space-y-stack-sm (8px) between h1 and p */}
        <View style={styles.heroText}>
          {/* Stitch: font-display-lg text-display-lg text-primary */}
          <Text style={styles.displayHeadline}>
            Meenakshi remembers your life.
          </Text>
          {/* Stitch: font-body-lg text-body-lg text-on-surface-variant px-4 */}
          <Text style={styles.bodyText}>
            Your personal second brain that{'\n'}
            seamlessly connects your Gmail,{'\n'}
            business cards, documents, and{'\n'}
            financial data into one intelligent{'\n'}
            ecosystem.
          </Text>
        </View>

        {/* Bento features — Stitch: grid grid-cols-2 gap-4 mt-stack-md */}
        <View style={styles.bentoGrid}>
          {/* Card 1: Financial Intelligence */}
          <GlassCard borderRadius={16} style={styles.bentoCard}>
            <View style={styles.bentoCardInner}>
              {/* Stitch: w-8 h-8 rounded-full bg-secondary-fixed, mb-3 */}
              <View style={styles.bentoIconWrap}>
                <StitchIcon name="insights" size={20} color={Colors.secondary} />
              </View>
              {/* Stitch: font-label-sm text-label-sm text-primary mb-1 */}
              <Text style={styles.bentoTitle}>Financial Intelligence</Text>
              {/* Stitch: text-[13px] text-on-surface-variant leading-relaxed */}
              <Text style={styles.bentoDesc}>
                Tracks every rupee, predicting goals before you set them.
              </Text>
            </View>
          </GlassCard>

          {/* Card 2: Contextual Memory */}
          <GlassCard borderRadius={16} style={styles.bentoCard}>
            <View style={styles.bentoCardInner}>
              <View style={styles.bentoIconWrap}>
                <StitchIcon name="history_edu" size={20} color={Colors.secondary} />
              </View>
              <Text style={styles.bentoTitle}>Contextual Memory</Text>
              <Text style={styles.bentoDesc}>
                Retrieves information from years ago, instantly.
              </Text>
            </View>
          </GlassCard>
        </View>

        {/* CTA — Stitch: w-full pt-stack-md (24px top padding) */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => navigation.navigate('Onboarding')}
            activeOpacity={0.85}
          >
            {/* Stitch: font-headline-lg-mobile text-headline-lg-mobile (28px, 600) */}
            <Text style={styles.ctaText}>Get Started</Text>
            {/* Stitch: Material Symbol arrow_forward */}
            <StitchIcon name="arrow_forward" size={24} color={Colors.onPrimary} />
          </TouchableOpacity>
          {/* Stitch: mt-4, label-sm, text-on-surface-variant/60, uppercase, tracking-widest */}
          <Text style={styles.securityNote}>
            SECURE & END-TO-END ENCRYPTED
          </Text>
        </View>
      </ScrollView>

      {/* Footer dots — Stitch: fixed bottom-0, p-8, flex gap-2 */}
      <View style={styles.footerDots}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={[styles.dot, styles.dotFaint]} />
        <View style={[styles.dot, styles.dotFainter]} />
      </View>
    </SafeAreaView>
  );
}

const getStyles = (Colors: any, typography: any) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background },

  // Ambient glow — starts offset to upper-right, wanders across screen
  // SVG RadialGradient handles soft feathered edges naturally

  // Layer 1: Large outer halo — offset right from center
  ambientGlowOuter: {
    position: 'absolute',
    top: '15%',
    left: SCREEN_WIDTH * 0.1,  // Start slightly right of center
    width: 700,
    height: 700,
  },

  // Layer 2: Inner concentrated glow — offset slightly different for depth
  ambientGlowInner: {
    position: 'absolute',
    top: '22%',
    left: SCREEN_WIDTH * 0.05,
    width: 450,
    height: 450,
  },

  // Bottom lavender wash — subtle tint behind lower content area
  bottomGradientWash: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%',
  },

  // Stitch: fixed top, h-16 (64px), centered
  header: {
    height: 64,
    alignItems: 'center',
    justifyContent: 'center' },

  // Stitch: font-headline-lg-mobile (28px, 600, tracking-tight)
  brandName: {
    ...typography.headlineLgMobile,
    color: Colors.primary,
    letterSpacing: -0.3 },

  scrollContent: {
    paddingHorizontal: Spacing.containerMobile, // 20px
    paddingBottom: 80,
    alignItems: 'center' },

  // === Illustration area ===
  // Stitch: aspect-square, max-h-[340px], flex items-center justify-center, relative
  illustrationArea: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: ILLUSTRATION_MAX_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 8 }, // Stitch: mb-base (8px)

  // SVG container for lines + dashed ring
  svgContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0 },

  // === Hero text ===
  // Stitch: space-y-stack-sm (8px) between headline and body
  heroText: {
    alignItems: 'center',
    gap: Spacing.sm, // 8px — Stitch: space-y-stack-sm
    paddingHorizontal: Spacing.md }, // 16px — Stitch: px-4

  // Stitch: font-display-lg text-display-lg text-primary
  // 48px, weight 700, line-height 1.1, letter-spacing -0.02em
  displayHeadline: {
    ...typography.displayLg,
    color: Colors.primary,
    textAlign: 'center' },

  // Stitch: font-body-lg text-body-lg text-on-surface-variant
  // 18px, weight 400, line-height 1.6
  bodyText: {
    ...typography.bodyLg,
    color: Colors.onSurfaceVariant,
    textAlign: 'center' },

  // === Bento grid ===
  // Stitch: grid grid-cols-2 gap-4 w-full mt-stack-md
  bentoGrid: {
    flexDirection: 'row',
    gap: 16, // Stitch: gap-4 = 16px
    width: '100%',
    marginTop: 24 }, // Stitch: mt-stack-md = 24px

  // Stitch: glass-card rounded-2xl text-left
  bentoCard: {
    flex: 1 },

  // Stitch: p-5 (20px padding)
  bentoCardInner: {
    padding: 20,
    gap: 0 },

  // Stitch: w-8 h-8 (32px) rounded-full bg-secondary-fixed, mb-3 (12px)
  bentoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.secondaryFixed, // #e9ddff
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12 },

  // Stitch: font-label-sm text-label-sm text-primary mb-1 (4px)
  bentoTitle: {
    ...typography.labelSm,
    color: Colors.primary,
    marginBottom: 4 },

  // Stitch: text-[13px] text-on-surface-variant leading-relaxed
  bentoDesc: {
    ...typography.bentoDesc, // 13px, lineHeight 21.125
    color: Colors.onSurfaceVariant },

  // === CTA ===
  // Stitch: w-full pt-stack-md (24px top padding)
  ctaSection: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 24, // Stitch: pt-stack-md
    gap: 16 }, // Stitch: between button and security note = mt-4

  // Stitch: w-full h-16 (64px), rounded-full, bg-primary (#000),
  // font-headline-lg-mobile (28px, 600), gap-3 (12px), shadow-xl
  ctaButton: {
    width: '100%',
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12, // Stitch: gap-3
    // Stitch: shadow-xl
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 12 },

  ctaText: {
    ...typography.headlineLgMobile, // 28px, 600
    color: Colors.onPrimary },

  // Stitch: mt-4 (built into gap), label-sm, text-on-surface-variant/60,
  // uppercase, tracking-widest (0.1em = ~1.2px at 12px)
  securityNote: {
    ...typography.labelSm,
    color: `${Colors.onSurfaceVariant}99`, // ~60% opacity
    letterSpacing: 1.2, // Stitch: tracking-widest ≈ 0.1em
    textTransform: 'uppercase' },

  // === Footer dots ===
  // Stitch: fixed bottom-0, p-8 (32px), flex gap-2 (8px), opacity-30
  footerDots: {
    position: 'absolute',
    bottom: 32, // Stitch: p-8
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 8, // Stitch: gap-2
    opacity: 0.3 },

  // Stitch: w-1.5 h-1.5 (6px) rounded-full
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3 },

  dotActive: { backgroundColor: Colors.primary },
  dotFaint: { backgroundColor: Colors.primary, opacity: 0.4 },
  dotFainter: { backgroundColor: Colors.primary, opacity: 0.2 } });
