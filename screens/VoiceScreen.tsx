/**
 * VoiceScreen.tsx
 *
 * All platforms (Web, iOS, Android) now use useVoiceSession hook
 * which connects to Gemini Live API (gemini-3.1-flash-live-preview, v1alpha)
 * with Kore voice — real audio in, real audio out.
 *
 * No expo-speech. No REST pipeline. One path for all platforms.
 */

import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { Colors, Spacing, Radius, Typography } from '../constants/theme';
import { useVoiceSession } from '../hooks/useVoiceSession';

// ─── Constants ───────────────────────────────────────────────────────────────

const QUICK_CHIPS = [
  'What bills are due?',
  'Summarize my finances',
  'Who should I follow up with?',
  'What did we discuss last time?',
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function VoiceScreen() {
  const navigation = useNavigation();

  // ── Voice session (all platforms) ─────────────────────────────────────────
  const session = useVoiceSession();
  const {
    voiceState,
    isActive,
    userTranscript,
    aiTranscript,
    error,
    isMuted,
    startSession,
    stopSession,
    forceTurnComplete,
    interrupt,
    sendText,
    toggleMute,
  } = session;

  // ── Animations ─────────────────────────────────────────────────────────────
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbOpacity = useRef(new Animated.Value(0.85)).current;
  const pingScale = useRef(new Animated.Value(1)).current;
  const pingOpacity = useRef(new Animated.Value(0.25)).current;
  const barAnims = useRef(
    Array.from({ length: 5 }, () => new Animated.Value(10))
  ).current;

  // Idle breathing loop
  useEffect(() => {
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 1.07, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orbOpacity, { toValue: 1, duration: 2200, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(orbScale, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(orbOpacity, { toValue: 0.85, duration: 2200, useNativeDriver: true }),
        ]),
      ])
    );
    const ping = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pingScale, { toValue: 1.35, duration: 1600, useNativeDriver: true }),
          Animated.timing(pingOpacity, { toValue: 0, duration: 1600, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pingScale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pingOpacity, { toValue: 0.25, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    breathe.start();
    ping.start();
    return () => { breathe.stop(); ping.stop(); };
  }, []);

  // Waveform bars when active
  useEffect(() => {
    if (isActive) {
      const waveLoop = Animated.loop(
        Animated.stagger(
          80,
          barAnims.map(anim =>
            Animated.sequence([
              Animated.timing(anim, { toValue: 38, duration: 280, useNativeDriver: false }),
              Animated.timing(anim, { toValue: 10, duration: 280, useNativeDriver: false }),
            ])
          )
        )
      );
      waveLoop.start();
      return () => waveLoop.stop();
    } else {
      barAnims.forEach(anim =>
        Animated.timing(anim, { toValue: 10, duration: 250, useNativeDriver: false }).start()
      );
    }
  }, [isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { stopSession(); };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleMic = async () => {
    if (!isActive) {
      await startSession();
    } else if (voiceState === 'speaking') {
      interrupt();
    }
  };

  const handleStop = () => {
    stopSession();
  };

  const handleChip = (chip: string) => {
    if (!isActive) {
      // Start session then send chip once connected
      startSession().then(() => {
        // Small delay to let the socket open
        setTimeout(() => sendText(chip), 800);
      });
    } else {
      sendText(chip);
    }
  };

  // ── Derived display values ────────────────────────────────────────────────

  const statusLabel = (() => {
    switch (voiceState) {
      case 'connecting':  return 'Connecting…';
      case 'listening':   return '● Listening';
      case 'processing':  return '● Processing…';
      case 'speaking':    return '● Speaking…';
      case 'error':       return 'Error';
      default:            return 'Ready';
    }
  })();

  const hintText = (() => {
    switch (voiceState) {
      case 'connecting':  return 'Starting Meenakshi…';
      case 'listening':   return 'Speak now — Meenakshi is listening';
      case 'processing':  return 'Thinking…';
      case 'speaking':    return 'Tap mic to interrupt';
      case 'error':       return 'Tap the mic to reconnect';
      default:            return 'Tap the mic to speak with Meenakshi';
    }
  })();

  const userDisplayText = userTranscript || (voiceState === 'idle' ? 'Tap the mic to speak' : '');

  // ── Orb color by state ────────────────────────────────────────────────────
  const orbBg =
    voiceState === 'error'
      ? Colors.error
      : voiceState === 'speaking'
      ? Colors.secondaryContainer
      : voiceState === 'listening' || voiceState === 'processing'
      ? Colors.secondary
      : Colors.secondary;

  // ── Mic icon ──────────────────────────────────────────────────────────────
  const micIcon =
    voiceState === 'connecting'
      ? '⏳'
      : voiceState === 'speaking'
      ? '🔊'
      : isActive
      ? '⏹'
      : '🎙️';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryContainer} />

      {/* Ambient glows */}
      <View style={styles.glowLeft} />
      <View style={styles.glowRight} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.headerBtn} 
            onPress={() => {
              stopSession();
              navigation.navigate('Main' as never);
            }}
          >
            <Text style={styles.headerBtnText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Meenakshi</Text>
            <Text style={[styles.headerStatus, isActive && styles.headerStatusActive]}>
              {statusLabel}
            </Text>
          </View>

          <TouchableOpacity style={styles.headerBtn} onPress={toggleMute}>
            <Text style={styles.headerBtnText}>{isMuted ? '🔇' : '🔔'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Main ── */}
        <View style={styles.main}>

          {/* Transcript area */}
          <View style={styles.transcriptArea}>
            {userDisplayText ? (
              <Text style={styles.userText} numberOfLines={2}>{userDisplayText}</Text>
            ) : null}
            {aiTranscript ? (
              <Text style={styles.modelText} numberOfLines={5}>{aiTranscript}</Text>
            ) : null}
          </View>

          {/* Orb */}
          <View style={styles.orbWrap}>
            <Animated.View
              style={[
                styles.pingRing,
                { transform: [{ scale: pingScale }], opacity: pingOpacity },
              ]}
            />
            <Animated.View
              style={[
                styles.orbAura,
                { opacity: isActive ? 0.25 : 0.12 },
              ]}
            />
            <Animated.View
              style={[
                styles.orb,
                { transform: [{ scale: orbScale }], opacity: orbOpacity },
                { backgroundColor: orbBg },
                isActive && styles.orbActive,
              ]}
            />
          </View>

          {/* Waveform */}
          <View style={styles.waveform}>
            {barAnims.map((anim, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.waveBar,
                  { height: anim },
                  i === 2 && styles.waveBarCenter,
                ]}
              />
            ))}
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>

          {/* Error banner */}
          {error && (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                onPress={() => startSession()}
                style={styles.errorRetry}
              >
                <Text style={styles.errorRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Mode hint */}
          <Text style={styles.hint}>{hintText}</Text>

          {/* Quick chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {QUICK_CHIPS.map((chip, i) => (
              <TouchableOpacity
                key={i}
                style={styles.chip}
                onPress={() => handleChip(chip)}
                activeOpacity={0.75}
              >
                <Text style={styles.chipText}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Controls row */}
          <View style={styles.controls}>
            {/* Keyboard → ChatScreen */}
            <TouchableOpacity
              style={styles.sideBtn}
              onPress={() => {
                stopSession();
                navigation.navigate('Chat' as never);
              }}
            >
              <View style={styles.sidePill}>
                <Text style={styles.sidePillIcon}>⌨️</Text>
              </View>
              <Text style={styles.sideBtnLabel}>Text</Text>
            </TouchableOpacity>

            {/* Mic (primary) */}
            <TouchableOpacity
              style={[
                styles.micBtn,
                voiceState === 'error'    && styles.micBtnError,
                voiceState === 'speaking' && styles.micBtnSpeaking,
              ]}
              onPress={handleMic}
              activeOpacity={0.85}
              disabled={voiceState === 'connecting'}
            >
              <Text style={styles.micIcon}>{micIcon}</Text>
            </TouchableOpacity>

            {/* Stop */}
            <TouchableOpacity style={styles.sideBtn} onPress={handleStop}>
              <View style={styles.sidePill}>
                <Text style={styles.sidePillIcon}>⏹</Text>
              </View>
              <Text style={styles.sideBtnLabel}>Stop</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.primaryContainer,
    overflow: 'hidden',
  },
  glowLeft: {
    position: 'absolute',
    top: '20%',
    left: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.secondaryFaint,
  },
  glowRight: {
    position: 'absolute',
    bottom: '20%',
    right: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: Colors.glassPanelBorder,
  },
  safe: { flex: 1 },

  // ── Header ──────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.containerMobile,
    paddingTop: Spacing.sm,
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
  headerBtnText: { fontSize: 16, color: Colors.onSecondary },
  headerCenter: { alignItems: 'center', gap: 2 },
  headerTitle: {
    ...Typography.headlineSm,
    color: Colors.onSecondary,
  },
  headerStatus: {
    ...Typography.labelSm,
    color: Colors.onPrimaryContainer,
  },
  headerStatusActive: { color: Colors.secondaryFixedDim },

  // ── Main ────────────────────────────────────────────────────────────────
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.containerMobile,
  },

  // Transcript
  transcriptArea: {
    alignItems: 'center',
    gap: Spacing.sm,
    maxWidth: 320,
    minHeight: 80,
  },
  userText: {
    ...Typography.bodySm,
    color: Colors.onPrimaryContainer,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  modelText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.onSecondary,
    textAlign: 'center',
    lineHeight: 28,
  },

  // Orb
  orbWrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pingRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1,
    borderColor: Colors.secondaryGlow,
  },
  orbAura: {
    position: 'absolute',
    width: 290,
    height: 290,
    borderRadius: 145,
    backgroundColor: Colors.secondary,
  },
  orb: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.secondary,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 28,
    elevation: 14,
  },
  orbActive: {
    shadowOpacity: 0.85,
    shadowRadius: 42,
  },

  // Waveform
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 50,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: Colors.secondaryFixedDim,
    opacity: 0.8,
  },
  waveBarCenter: {
    backgroundColor: Colors.secondary,
    opacity: 1,
  },

  // ── Footer ────────────────────────────────────────────────────────────
  footer: {
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },

  // Error
  errorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.containerMobile,
    backgroundColor: Colors.errorContainer,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  errorText: {
    ...Typography.bodySm,
    color: Colors.onErrorContainer,
    flex: 1,
  },
  errorRetry: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Colors.error,
    borderRadius: Radius.sm,
    marginLeft: Spacing.sm,
  },
  errorRetryText: {
    ...Typography.labelSm,
    color: Colors.onError,
  },

  // Hint
  hint: {
    ...Typography.labelSm,
    color: Colors.onPrimaryContainer,
    textAlign: 'center',
    opacity: 0.55,
    paddingHorizontal: Spacing.containerMobile,
  },

  // Chips
  chips: {
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
  },

  // Controls row
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
  },
  sideBtn: { alignItems: 'center', gap: 5 },
  sidePill: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.glassPanel,
    borderWidth: 1,
    borderColor: Colors.glassPanelBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidePillIcon: { fontSize: 20 },
  sideBtnLabel: {
    ...Typography.labelSm,
    color: Colors.onPrimaryContainer,
    letterSpacing: 0.5,
  },

  micBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.65,
    shadowRadius: 22,
    elevation: 12,
  },
  micBtnError: {
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
  },
  micBtnSpeaking: {
    backgroundColor: Colors.secondaryContainer,
    shadowColor: Colors.secondaryContainer,
  },
  micIcon: { fontSize: 34 },
});
