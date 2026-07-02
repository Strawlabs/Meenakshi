/**
 * VoiceScreen.tsx
 *
 * Platform behavior:
 *   - Web:            useVoiceSession hook → Gemini Live WebSocket bidirectional audio
 *   - iOS / Android:  expo-audio record → Gemini REST (gemini-3-flash-preview) → expo-speech TTS
 *
 * Key guards:
 *   - isStoppingRef prevents double-stop crashes on Android
 *   - 800 ms flush wait + size polling before reading the audio file
 *   - All file I/O via 'expo-file-system/legacy' (NOT 'expo-file-system')
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system/legacy';
import { GoogleGenAI } from '@google/genai';

import { Colors, Spacing, Radius, Typography } from '../constants/theme';
import { MEENAKSHI_SYSTEM_PROMPT } from '../constants';
import {
  buildMemoryContext,
  saveSession,
  MemoryMessage,
} from '../services/memoryService';
import { getLatestSnapshot } from '../services/financialHealthService';
import supabase from '../lib/supabase';

// ─── Web-only import (tree-shaken on native) ────────────────────────────────

let useVoiceSession: (() => any) | null = null;
if (Platform.OS === 'web') {
  useVoiceSession = require('../hooks/useVoiceSession').useVoiceSession;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-3-flash-preview';

const QUICK_CHIPS = [
  'What bills are due?',
  'Summarize my finances',
  'Who should I follow up with?',
  'What did we discuss last time?',
];

type VoiceState = 'idle' | 'recording' | 'processing' | 'speaking';

// ─── Component ───────────────────────────────────────────────────────────────

export default function VoiceScreen() {
  const navigation = useNavigation();

  // ── State ──────────────────────────────────────────────────────────────────
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [userText, setUserText] = useState('Tap the mic to speak');
  const [modelText, setModelText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const isStoppingRef = useRef<boolean>(false);
  const recordingStopTimeRef = useRef<number>(0);
  const sessionIdRef = useRef<string | undefined>(undefined);

  // ── Native recorder ────────────────────────────────────────────────────────
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // ── Web session (no-op on native) ──────────────────────────────────────────
  const webSession =
    Platform.OS === 'web' && useVoiceSession ? useVoiceSession() : null;

  // ── Derived ────────────────────────────────────────────────────────────────
  const isActive = voiceState !== 'idle';

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
    return () => {
      Speech.stop();
      if (recorder?.isRecording) {
        try { recorder.stop(); } catch (_) {}
      }
    };
  }, []);

  // ── System prompt builder ──────────────────────────────────────────────────

  const buildSystemPrompt = async (): Promise<string> => {
    const today = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });

    let prompt = MEENAKSHI_SYSTEM_PROMPT + `\n\nTODAY'S DATE: ${today}`;

    const memCtx = await buildMemoryContext().catch(() => '');
    if (memCtx) prompt += `\n\n${memCtx}`;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const snapshot = await getLatestSnapshot(user.id).catch(() => null);
        if (snapshot) {
          const obligations = (snapshot.upcoming_obligations ?? [])
            .map((o: any) =>
              `- ${o.description ?? o.subject ?? o.category} due ${o.due_date} (₹${o.amount ?? 0})`
            )
            .join('\n') || 'None';

          prompt +=
            `\n\nFINANCIAL CONTEXT: ${snapshot.summary ?? 'No summary available.'}` +
            `\n\nUPCOMING OBLIGATIONS:\n${obligations}`;
        }
      }
    } catch (_) {}

    return prompt;
  };

  // ── TTS helper ────────────────────────────────────────────────────────────

  const speak = (text: string) => {
    setModelText(text);
    setVoiceState('speaking');
    Speech.speak(text, {
      language: 'en-IN',
      rate: 0.95,
      pitch: 1.05,
      onDone: () => setVoiceState('idle'),
      onError: () => setVoiceState('idle'),
    });
  };

  // ── Gemini REST call (shared for voice + text chips) ──────────────────────

  const callGemini = async (
    content: { text?: string; audioBase64?: string; mimeType?: string }
  ): Promise<string> => {
    const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) throw new Error('API key missing — set EXPO_PUBLIC_GEMINI_API_KEY in .env');

    const ai = new GoogleGenAI({ apiKey });
    const systemPrompt = await buildSystemPrompt();

    let parts: any[];
    if (content.audioBase64 && content.mimeType) {
      parts = [{ inlineData: { mimeType: content.mimeType, data: content.audioBase64 } }];
    } else {
      parts = [{ text: content.text ?? '' }];
    }

    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      config: { systemInstruction: systemPrompt },
      contents: [{ role: 'user', parts }],
    });

    return result.text ?? 'Illa pa, I could not understand that. Try again da.';
  };

  // ── Save exchange to memory ───────────────────────────────────────────────

  const saveToMemory = (userMsg: string, aiMsg: string, userTs: number) => {
    const mem: MemoryMessage[] = [
      { role: 'user', text: userMsg, timestamp: userTs },
      { role: 'model', text: aiMsg, timestamp: Date.now() },
    ];
    saveSession(mem, sessionIdRef.current)
      .then(id => { if (!sessionIdRef.current) sessionIdRef.current = id; })
      .catch(err => console.warn('[VoiceScreen] saveSession failed:', err));
  };

  // ── Native: start recording ───────────────────────────────────────────────

  const startNativeRecording = async () => {
    setError(null);
    Speech.stop();

    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setError('Please allow microphone access in Settings.');
      return;
    }

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    await recorder.record();

    setVoiceState('recording');
    setUserText('Listening… tap again to send');
    setModelText('');
  };

  // ── Native: stop recording + process ──────────────────────────────────────

  const stopNativeSession = async () => {
    // Guard: prevent double-stop
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    try {
      if (!recorder.isRecording) {
        setVoiceState('idle');
        return;
      }

      recordingStopTimeRef.current = Date.now();
      await recorder.stop();

      const uri = recorder.uri;
      setVoiceState('processing');
      setUserText('Processing your voice…');

      if (!uri) {
        setError('Recording failed. Please try again.');
        setVoiceState('idle');
        return;
      }

      console.log('[VoiceScreen] Recording URI:', uri);

      // Android needs time to flush file to disk
      await new Promise(r => setTimeout(r, 800));

      // Poll until file is ready (max 5 s)
      let info: FileSystem.FileInfo | undefined;
      for (let i = 0; i < 20; i++) {
        info = await FileSystem.getInfoAsync(uri);
        const size = info.exists ? (info as any).size ?? 0 : 0;
        console.log(`[VoiceScreen] File poll ${i}: exists=${info.exists}, size=${size}`);
        if (info.exists && size > 1000) break;
        await new Promise(r => setTimeout(r, 250));
      }

      if (!info?.exists) {
        setError('Recording failed. Please try again.');
        setVoiceState('idle');
        return;
      }

      const size = (info as any).size ?? 0;
      if (size <= 1000) {
        setError('Recording too short. Please try again.');
        setVoiceState('idle');
        return;
      }

      let base64: string;
      try {
        // Copy to app's own cacheDirectory first — expo-file-system/legacy
        // can't read from host.exp.exponent/cache/Audio/ on Android (Expo Go sandbox).
        const destUri =
          FileSystem.cacheDirectory + `voice_${Date.now()}.m4a`;
        await FileSystem.copyAsync({ from: uri, to: destUri });

        base64 = await FileSystem.readAsStringAsync(destUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Clean up the copy
        FileSystem.deleteAsync(destUri, { idempotent: true }).catch(() => {});
      } catch (e) {
        console.error('[VoiceScreen] File read error:', e);
        setError('Recording failed. Please try again.');
        setVoiceState('idle');
        return;
      }

      await setAudioModeAsync({ allowsRecording: false });

      const userTs = recordingStopTimeRef.current;
      const aiText = await callGemini({ audioBase64: base64, mimeType: 'audio/m4a' });

      const latency = Date.now() - userTs;
      console.log(`[VoiceScreen] Response latency: ${latency}ms`);

      saveToMemory('[Voice Message]', aiText, userTs);
      speak(aiText);
    } catch (err: any) {
      console.error('[VoiceScreen] stopNativeSession error:', err);

      if (String(err?.message ?? '').includes('429') || String(err?.status ?? '').includes('429')) {
        setError('Meenakshi is taking a break. Try again in a moment.');
      } else {
        setError('Something went wrong. Please try again.');
      }
      setVoiceState('idle');
    } finally {
      isStoppingRef.current = false;
    }
  };

  // ── Quick chip → text path ────────────────────────────────────────────────

  const handleChip = async (chip: string) => {
    setError(null);
    Speech.stop();

    if (Platform.OS === 'web' && webSession) {
      setUserText(`"${chip}"`);
      if (!webSession.isActive) {
        await webSession.startSession();
        await new Promise(r => setTimeout(r, 600));
      }
      try {
        webSession.session?.sendClientContent({ turns: [{ parts: [{ text: chip }] }] });
      } catch (_) {
        await sendTextToGemini(chip);
      }
    } else {
      await sendTextToGemini(chip);
    }
  };

  const sendTextToGemini = async (query: string) => {
    const userTs = Date.now();
    setUserText(`"${query}"`);
    setVoiceState('processing');
    setModelText('Oru nimisham…');

    try {
      const aiText = await callGemini({ text: query });

      const latency = Date.now() - userTs;
      console.log(`[VoiceScreen] Response latency: ${latency}ms`);

      saveToMemory(query, aiText, userTs);
      speak(aiText);
    } catch (err: any) {
      console.error('[VoiceScreen] sendTextToGemini error:', err);
      if (String(err?.message ?? '').includes('429')) {
        setError('Meenakshi is taking a break. Try again in a moment.');
      } else {
        setError('Something went wrong. Please try again.');
      }
      setVoiceState('idle');
    }
  };

  // ── Mic button handler ────────────────────────────────────────────────────

  const handleMic = async () => {
    if (Platform.OS === 'web' && webSession) {
      if (webSession.isActive) {
        webSession.stopSession();
      } else {
        await webSession.startSession();
      }
      return;
    }

    if (voiceState === 'recording') {
      await stopNativeSession();
    } else if (voiceState === 'speaking') {
      Speech.stop();
      setVoiceState('idle');
    } else if (voiceState === 'idle') {
      await startNativeRecording();
    }
  };

  const handleStop = () => {
    Speech.stop();
    if (voiceState === 'speaking') setVoiceState('idle');
    if (Platform.OS === 'web' && webSession?.isActive) webSession.stopSession();
  };

  // ── Status label ──────────────────────────────────────────────────────────

  const statusLabel = (() => {
    if (Platform.OS === 'web' && webSession) {
      return webSession.isActive ? '● Streaming' : 'Ready';
    }
    switch (voiceState) {
      case 'recording':   return '● Recording…';
      case 'processing':  return '● Processing…';
      case 'speaking':    return '● Speaking…';
      default:            return 'Ready';
    }
  })();

  const displayText =
    Platform.OS === 'web' && webSession
      ? webSession.transcript || modelText
      : modelText;

  const displayError =
    Platform.OS === 'web' && webSession ? webSession.error ?? error : error;

  // ── Orb color by state ────────────────────────────────────────────────────
  const orbBg =
    voiceState === 'recording'
      ? Colors.error
      : voiceState === 'speaking'
      ? Colors.secondaryContainer
      : Colors.secondary;

  // ── Mic icon ──────────────────────────────────────────────────────────────
  const micIcon =
    voiceState === 'recording'
      ? '⏹'
      : voiceState === 'speaking'
      ? '🔊'
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
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.headerBtnText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Meenakshi</Text>
            <Text style={[styles.headerStatus, isActive && styles.headerStatusActive]}>
              {statusLabel}
            </Text>
          </View>

          <TouchableOpacity style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* ── Main ── */}
        <View style={styles.main}>

          {/* Transcript area */}
          <View style={styles.transcriptArea}>
            <Text style={styles.userText} numberOfLines={2}>{userText}</Text>
            {displayText ? (
              <Text style={styles.modelText} numberOfLines={5}>{displayText}</Text>
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
          {displayError && (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{displayError}</Text>
              <TouchableOpacity
                onPress={() => setError(null)}
                style={styles.errorRetry}
              >
                <Text style={styles.errorRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Mode hint */}
          <Text style={styles.hint}>
            {Platform.OS === 'web'
              ? 'Web: Real-time streaming'
              : voiceState === 'recording'
              ? 'Tap mic again to send'
              : 'Tap and speak — Meenakshi will reply'}
          </Text>

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
              onPress={() => navigation.navigate('Chat' as never)}
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
                voiceState === 'recording' && styles.micBtnRecording,
                voiceState === 'speaking'  && styles.micBtnSpeaking,
              ]}
              onPress={handleMic}
              activeOpacity={0.85}
            >
              <Text style={styles.micIcon}>{micIcon}</Text>
            </TouchableOpacity>

            {/* Stop / mute */}
            <TouchableOpacity style={styles.sideBtn} onPress={handleStop}>
              <View style={styles.sidePill}>
                <Text style={styles.sidePillIcon}>🔇</Text>
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
  micBtnRecording: {
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
  },
  micBtnSpeaking: {
    backgroundColor: Colors.secondaryContainer,
    shadowColor: Colors.secondaryContainer,
  },
  micIcon: { fontSize: 34 },
});
