import { useAppTheme } from '../context/ThemeContext';
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  SafeAreaView,
  Easing,
  Dimensions,
  ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { Spacing, Radius } from '../constants/theme';
import GlassCard from '../components/GlassCard';
import AIOrb from '../components/AIOrb';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Welcome'>;
};

const { width } = Dimensions.get('window');
const ORB_SIZE = 120;

// Stitch floating data point icons
const DATA_POINTS = [
  { icon: '✉', label: 'Gmail', pos: { top: '14%', left: '10%' }, delay: 0 },
  { icon: '📅', label: 'Events', pos: { top: '14%', right: '10%' }, delay: 800 },
  { icon: '📄', label: 'Docs', pos: { bottom: '14%', left: '10%' }, delay: 1600 },
  { icon: '💳', label: 'Wealth', pos: { bottom: '14%', right: '10%' }, delay: 2400 },
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
  const styles = getStyles(Colors, typography);

  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
      <GlassCard style={styles.floatingCard}>
        <Text style={styles.floatingIcon}>{icon}</Text>
        <Text style={styles.floatingLabel}>{label}</Text>
      </GlassCard>
    </Animated.View>
  );
}

export default function WelcomeScreen({ navigation }: Props) {
  const { colors: Colors, typography } = useAppTheme();
  const styles = getStyles(Colors, typography);

  const breatheAnim = useRef(new Animated.Value(1)).current;
  const ambientGlow = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    // Orb breathe
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1.05,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true }),
        Animated.timing(breatheAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true }),
      ])
    ).start();

    // Ambient glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(ambientGlow, {
          toValue: 0.7,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true }),
        Animated.timing(ambientGlow, {
          toValue: 0.4,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Stitch: ambient glow — positioned at center */}
      <Animated.View style={[styles.ambientGlow, { opacity: ambientGlow }]} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.brandName}>Meenakshi</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Central illustration area */}
        <View style={styles.illustrationArea}>
          {/* SVG-like connectivity lines (RN approximation with absolute positioned lines) */}
          <View style={styles.linesContainer}>
            {/* Dashed ring approximation */}
            <View style={styles.dashedRing} />
            {/* Lines to corners */}
            <View style={[styles.line, styles.lineTopLeft]} />
            <View style={[styles.line, styles.lineTopRight]} />
            <View style={[styles.line, styles.lineBottomLeft]} />
            <View style={[styles.line, styles.lineBottomRight]} />
          </View>

          {/* Central Orb */}
          <AIOrb size={ORB_SIZE} />

          {/* Floating Data Cards */}
          {DATA_POINTS.map(dp => (
            <FloatingCard key={dp.label} {...dp} />
          ))}
        </View>

        {/* Headline */}
        <View style={styles.heroText}>
          <Text style={styles.displayHeadline}>
            Meenakshi remembers your life.
          </Text>
          <Text style={styles.bodyText}>
            Your personal second brain that seamlessly connects your Gmail,
            business cards, documents, and financial data into one intelligent
            ecosystem.
          </Text>
        </View>

        {/* Bento feature cards — Stitch grid */}
        <View style={styles.bentoGrid}>
          <GlassCard style={styles.bentoCard}>
            <View style={styles.bentoIconWrap}>
              <Text style={styles.bentoIcon}>📈</Text>
            </View>
            <Text style={styles.bentoTitle}>Financial Intelligence</Text>
            <Text style={styles.bentoDesc}>
              Tracks every rupee, predicting goals before you set them.
            </Text>
          </GlassCard>
          <GlassCard style={styles.bentoCard}>
            <View style={styles.bentoIconWrap}>
              <Text style={styles.bentoIcon}>🧠</Text>
            </View>
            <Text style={styles.bentoTitle}>Contextual Memory</Text>
            <Text style={styles.bentoDesc}>
              Retrieves information from years ago, instantly.
            </Text>
          </GlassCard>
        </View>

        {/* CTA */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={() => navigation.navigate('Onboarding')}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaText}>Get Started</Text>
            <Text style={styles.ctaArrow}>→</Text>
          </TouchableOpacity>
          <Text style={styles.securityNote}>
            SECURE &amp; END-TO-END ENCRYPTED
          </Text>
        </View>
      </ScrollView>

      {/* Footer dots — Stitch decoration */}
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
  ambientGlow: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: Colors.secondary,
    opacity: 0.15 },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm },
  brandName: {
    ...typography.headlineLgMobile,
    color: Colors.primary,
    letterSpacing: -0.3 },
  scrollContent: {
    paddingHorizontal: Spacing.containerMobile,
    paddingBottom: 80,
    alignItems: 'center',
    gap: Spacing.lg },
  // === Illustration ===
  illustrationArea: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 300,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative' },
  linesContainer: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.3 },
  dashedRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: Colors.secondary,
    borderStyle: 'dashed' },
  line: {
    position: 'absolute',
    width: 100,
    height: 1,
    backgroundColor: Colors.secondary },
  lineTopLeft: {
    top: '35%',
    left: '15%',
    transform: [{ rotate: '-45deg' }] },
  lineTopRight: {
    top: '35%',
    right: '15%',
    transform: [{ rotate: '45deg' }] },
  lineBottomLeft: {
    bottom: '35%',
    left: '15%',
    transform: [{ rotate: '45deg' }] },
  lineBottomRight: {
    bottom: '35%',
    right: '15%',
    transform: [{ rotate: '-45deg' }] },
  centralOrb: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10 },
  centralOrbIcon: {
    fontSize: 44,
    color: Colors.onSecondary },
  // Floating glass cards
  floatingCard: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  floatingIcon: { fontSize: 22 },
  floatingLabel: {
    ...typography.labelSm,
    color: Colors.onSurfaceVariant },
  // === Hero text ===
  heroText: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md },
  displayHeadline: {
    ...typography.displayLg,
    color: Colors.primary,
    textAlign: 'center' },
  bodyText: {
    ...typography.bodyLg,
    color: Colors.onSurfaceVariant,
    textAlign: 'center' },
  // === Bento grid ===
  bentoGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%' },
  bentoCard: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.sm },
  bentoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.secondaryFixed,
    alignItems: 'center',
    justifyContent: 'center' },
  bentoIcon: { fontSize: 18 },
  bentoTitle: {
    ...typography.labelSm,
    color: Colors.primary },
  bentoDesc: {
    ...typography.bodySm,
    color: Colors.onSurfaceVariant,
    lineHeight: 20 },
  // === CTA ===
  ctaSection: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.md },
  ctaButton: {
    width: '100%',
    height: 64,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8 },
  ctaText: {
    ...typography.headlineLgMobile,
    color: Colors.onPrimary },
  ctaArrow: {
    fontSize: 22,
    color: Colors.onPrimary },
  securityNote: {
    ...typography.labelSm,
    color: `${Colors.onSurfaceVariant}99`,
    letterSpacing: 2,
    textTransform: 'uppercase' },
  // === Footer dots ===
  footerDots: {
    position: 'absolute',
    bottom: 24,
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 6,
    opacity: 0.3 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3 },
  dotActive: { backgroundColor: Colors.primary },
  dotFaint: { backgroundColor: Colors.primary, opacity: 0.4 },
  dotFainter: { backgroundColor: Colors.primary, opacity: 0.2 } });
