import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Easing,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Spacing, Radius, Typography } from '../constants/theme';

const { width, height } = Dimensions.get('window');

const QUICK_CHIPS = [
  'Optimize Savings',
  'Market Summary',
  'Connect Wallet',
  'Due bills',
];

const DEMO_RESPONSES = [
  'Analyzing your asset distribution and recent market trends. One moment.',
  'Your credit card payment is due in 4 days. Should I schedule a transfer?',
  'Home loan EMI of ₹42,500 processed successfully. Net worth up 2.4% this week.',
  'Rajesh from HDFC followed up 2 days ago. I\'ve drafted a reply for your review.',
];

const DEMO_QUERIES = [
  '"How is my portfolio performance today?"',
  '"What bills are due this week?"',
  '"What do I know about Rajesh Kumar?"',
  '"Summarize my finances"',
];

const NUM_BARS = 7;
const BAR_HEIGHTS = [12, 24, 36, 48, 32, 20, 10];

/**
 * VoiceScreen — Stitch "Voice Intelligence" design
 * Dark bg: #131b2e (primaryContainer)
 * Purple orb with glow, waveform bars, glass panels
 */
export default function VoiceScreen() {
  const navigation = useNavigation();

  const [isActive, setIsActive] = useState(false);
  const [userText, setUserText] = useState(DEMO_QUERIES[0]);
  const [modelText, setModelText] = useState(
    'Tap the microphone to start your conversation with Meenakshi.'
  );
  const [demoIdx, setDemoIdx] = useState(0);

  // Orb breathing animation
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbOpacity = useRef(new Animated.Value(0.8)).current;
  const orbShadow = useRef(new Animated.Value(0.4)).current;
  // Waveform bars
  const barAnims = useRef(Array.from({ length: NUM_BARS }, () => new Animated.Value(8))).current;
  // Ping ring
  const pingScale = useRef(new Animated.Value(1)).current;
  const pingOpacity = useRef(new Animated.Value(0.3)).current;
  // Ambient orbs
  const ambientLeft = useRef(new Animated.Value(0)).current;
  const ambientRight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Orb breath — matches Stitch @keyframes breathe
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 1.08, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orbOpacity, { toValue: 1, duration: 2000, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orbOpacity, { toValue: 0.8, duration: 2000, useNativeDriver: true }),
        ]),
      ])
    ).start();

    // Ping ring — Stitch animate-ping
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pingScale, { toValue: 1.3, duration: 1500, useNativeDriver: true }),
          Animated.timing(pingOpacity, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pingScale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pingOpacity, { toValue: 0.3, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();

    // Start waveform animation
    animateBars();
  }, []);

  const animateBars = () => {
    barAnims.forEach((anim, i) => {
      const animateBar = () => {
        Animated.sequence([
          Animated.timing(anim, {
            toValue: 8 + Math.random() * 40,
            duration: 150 + i * 50,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: BAR_HEIGHTS[i],
            duration: 150 + i * 50,
            useNativeDriver: false,
          }),
        ]).start(({ finished }) => {
          if (finished) animateBar();
        });
      };
      setTimeout(() => animateBar(), i * 100);
    });
  };

  const handleMic = () => {
    const nextActive = !isActive;
    setIsActive(nextActive);
    if (nextActive) {
      const next = demoIdx % DEMO_RESPONSES.length;
      setUserText(DEMO_QUERIES[next]);
      setModelText(DEMO_RESPONSES[next]);
      setDemoIdx(prev => prev + 1);
    } else {
      setModelText('Session paused. Tap to continue.');
    }
  };

  const handleChip = (text: string) => {
    const next = demoIdx % DEMO_RESPONSES.length;
    setUserText(`"${text}"`);
    setModelText(DEMO_RESPONSES[next]);
    setDemoIdx(prev => prev + 1);
    if (!isActive) setIsActive(true);
  };

  return (
    <View style={styles.container}>
      {/* Stitch: gradient from transparent → primaryContainer/20 → primaryContainer */}
      <View style={styles.bgGradientOverlay} />

      {/* Ambient floating orbs — Stitch */}
      <View style={styles.ambientLeft} />
      <View style={styles.ambientRight} />

      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.headerBtnText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Meenakshi</Text>
            <Text style={[styles.headerStatus, isActive && styles.headerStatusActive]}>
              {isActive ? '● Listening...' : 'Ready'}
            </Text>
          </View>
          <TouchableOpacity style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Main content */}
        <View style={styles.main}>
          {/* Transcription area — Stitch */}
          <View style={styles.transcriptArea}>
            <Text style={styles.userTranscript}>{userText}</Text>
            <Text style={styles.modelTranscript}>{modelText}</Text>
          </View>

          {/* Central Orb — Stitch .orb-glow */}
          <View style={styles.orbContainer}>
            {/* Outer aura */}
            <Animated.View style={[styles.orbAura, { opacity: pingOpacity }]} />
            {/* Ping ring */}
            <Animated.View
              style={[
                styles.pingRing,
                { transform: [{ scale: pingScale }], opacity: pingOpacity },
              ]}
            />
            {/* Main orb */}
            <Animated.View
              style={[
                styles.orb,
                {
                  transform: [{ scale: orbScale }],
                  opacity: orbOpacity,
                },
                isActive && styles.orbActive,
              ]}
            >
              <View style={styles.orbGradientOverlay} />
            </Animated.View>
          </View>

          {/* Waveform — Stitch */}
          <View style={styles.waveform}>
            {barAnims.map((anim, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.waveBar,
                  { height: anim },
                  i === 3 && styles.waveBarPrimary,
                  (i === 2 || i === 4) && styles.waveBarWhite,
                ]}
              />
            ))}
          </View>
        </View>

        {/* Footer — Stitch */}
        <View style={styles.footer}>
          {/* Quick chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {QUICK_CHIPS.map((chip, i) => (
              <TouchableOpacity
                key={i}
                style={styles.chip}
                onPress={() => handleChip(chip)}
                activeOpacity={0.8}
              >
                <Text style={styles.chipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Controls */}
          <View style={styles.controls}>
            {/* Text mode */}
            <TouchableOpacity
              style={styles.controlSide}
              onPress={() => navigation.navigate('Chat' as never)}
            >
              <View style={styles.controlPill}>
                <Text style={styles.controlPillIcon}>⌨️</Text>
              </View>
              <Text style={styles.controlLabel}>Text</Text>
            </TouchableOpacity>

            {/* Mic — Stitch main button */}
            <TouchableOpacity
              style={[styles.micBtn, isActive && styles.micBtnActive]}
              onPress={handleMic}
              activeOpacity={0.85}
            >
              <Text style={styles.micBtnIcon}>{isActive ? '⏹' : '🎙️'}</Text>
            </TouchableOpacity>

            {/* Audio */}
            <TouchableOpacity style={styles.controlSide}>
              <View style={styles.controlPill}>
                <Text style={styles.controlPillIcon}>🔊</Text>
              </View>
              <Text style={styles.controlLabel}>Audio</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryContainer, // #131b2e
    overflow: 'hidden',
  },
  bgGradientOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: `${Colors.primaryContainer}33`,
  },
  // Stitch ambient floating orbs
  ambientLeft: {
    position: 'absolute',
    top: '25%',
    left: -80,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: `${Colors.secondary}1A`, // 10% opacity
  },
  ambientRight: {
    position: 'absolute',
    bottom: '25%',
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: `${Colors.primaryFixedDim}0D`, // 5% opacity
  },
  safe: { flex: 1 },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.containerMobile,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.glassPanel,
    borderWidth: 1,
    borderColor: Colors.glassPanelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnText: { ...Typography.bodyMd, color: Colors.onSecondary },
  headerCenter: { alignItems: 'center', gap: 3 },
  headerTitle: {
    ...Typography.headlineLgMobile,
    color: Colors.onSecondary,
  },
  headerStatus: {
    ...Typography.labelSm,
    color: Colors.onPrimaryContainer,
  },
  headerStatusActive: { color: Colors.secondaryFixedDim },
  // Main
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    paddingHorizontal: Spacing.containerMobile,
  },
  // Transcripts — Stitch
  transcriptArea: {
    alignItems: 'center',
    gap: Spacing.sm,
    maxWidth: 300,
  },
  userTranscript: {
    ...Typography.bodyMd,
    color: Colors.onPrimaryContainer,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  modelTranscript: {
    ...Typography.headlineLgMobile,
    color: Colors.onSecondary,
    textAlign: 'center',
    lineHeight: 36,
  },
  // Orb — Stitch .orb-glow
  orbContainer: {
    width: 192,
    height: 192,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  orbAura: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: Colors.secondary,
    opacity: 0.12,
  },
  pingRing: {
    position: 'absolute',
    width: 210,
    height: 210,
    borderRadius: 105,
    borderWidth: 1,
    borderColor: `${Colors.secondary}33`,
  },
  orb: {
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: Colors.secondaryContainer, // #8455ef
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    // Stitch: box-shadow 0 0 80px 20px rgba(132,85,239,0.4)
    shadowColor: Colors.secondaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 14,
  },
  orbActive: {
    shadowOpacity: 0.8,
    shadowRadius: 40,
  },
  orbGradientOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: `${Colors.secondaryContainer}66`,
  },
  // Waveform — Stitch
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 48,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: Colors.secondaryFixedDim, // #d0bcff
  },
  waveBarPrimary: {
    backgroundColor: Colors.secondary,
  },
  waveBarWhite: {
    backgroundColor: Colors.onSecondary,
  },
  // Footer
  footer: {
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  chipsRow: {
    paddingHorizontal: Spacing.containerMobile,
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: Colors.glassPanel,
    borderWidth: 1,
    borderColor: Colors.glassPanelBorder,
    borderRadius: Radius.full,
  },
  chipText: {
    ...Typography.labelSm,
    color: Colors.secondaryFixedDim,
    letterSpacing: 0.3,
  },
  // Controls
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  controlSide: { alignItems: 'center', gap: 6 },
  controlPill: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.glassPanel,
    borderWidth: 1,
    borderColor: Colors.glassPanelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlPillIcon: { fontSize: 20 },
  controlLabel: {
    ...Typography.labelSm,
    color: Colors.onPrimaryContainer,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  micBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    // Stitch: shadow-[0_0_40px_rgba(107,56,212,0.6)]
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  micBtnActive: {
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
  },
  micBtnIcon: { fontSize: 32 },
});
