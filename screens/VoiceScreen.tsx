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
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
import { GoogleGenAI } from '@google/genai';

import { Colors, Spacing, Radius, Typography } from '../constants/theme';
import { MEENAKSHI_SYSTEM_PROMPT } from '../constants';
import { buildMemoryContext, buildEmailContext, saveSession, MemoryMessage } from '../services/memoryService';
import { getLatestSnapshot } from '../services/financialHealthService';
import supabase from '../lib/supabase';

// Web-only: Gemini Live WebSocket hook (only imported on web)
let useVoiceSession: (() => any) | null = null;
if (Platform.OS === 'web') {
  useVoiceSession = require('../hooks/useVoiceSession').useVoiceSession;
}

const QUICK_CHIPS = [
  'What bills are due?',
  'Summarize my finances',
  'Who should I follow up with?',
  'What did we discuss last time?',
];

export default function VoiceScreen() {
  const navigation = useNavigation();

  // ─── Shared UI state ─────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [userText, setUserText] = useState('"Tap the microphone to begin"');
  const [modelText, setModelText] = useState(
    'Tap the mic to start your conversation with Meenakshi.'
  );
  const [error, setError] = useState<string | null>(null);

  const recordingStopTime = useRef<number>(0);
  const sessionIdRef = useRef<string | undefined>();

  const isActive = isRecording || isSpeaking;

  // ─── Native: expo-audio recording hook ───────────────────────────────────────
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  // ─── Web: Gemini Live hook (conditionally used) ───────────────────────────────
  const webSession = Platform.OS === 'web' && useVoiceSession ? useVoiceSession() : null;

  // ─── Orb and Waveform animations ─────────────────────────────────────────────
  const orbScale = useRef(new Animated.Value(1)).current;
  const orbOpacity = useRef(new Animated.Value(0.8)).current;
  const pingScale = useRef(new Animated.Value(1)).current;
  const pingOpacity = useRef(new Animated.Value(0.3)).current;
  const barAnims = useRef(
    Array.from({ length: 5 }).map(() => new Animated.Value(12))
  ).current;

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (isActive) {
      Animated.loop(
        Animated.stagger(
          100,
          barAnims.map(anim =>
            Animated.sequence([
              Animated.timing(anim, { toValue: 36, duration: 300, useNativeDriver: false }),
              Animated.timing(anim, { toValue: 12, duration: 300, useNativeDriver: false }),
            ])
          )
        )
      ).start();
    } else {
      barAnims.forEach(anim => {
        anim.stopAnimation();
        Animated.timing(anim, { toValue: 12, duration: 300, useNativeDriver: false }).start();
      });
    }
  }, [isActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorder) recorder.stop();
      Speech.stop();
    };
  }, []);

  // ─── Native voice helpers ─────────────────────────────────────────────────────

  const buildSystemPrompt = async (): Promise<string> => {
    const memCtx = await buildMemoryContext();
    const emailCtx = await buildEmailContext();
    
    let financialContext = '';
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const snapshot = await getLatestSnapshot(user.id);
      const healthSummary = snapshot?.summary || 'No summary available.';
      const obligations = snapshot?.upcoming_obligations || [];
      
      const obligationsStr = obligations.length > 0
        ? obligations.map((o: any) => `- ${o.description || o.subject || o.category} due ${o.due_date} (₹${o.amount || '0'})`).join('\n')
        : 'None';

      const { data: historyEvents } = await supabase
        .from('email_events')
        .select('received_at, category, amount, ai_summary, sender_name, entity_email_links(entities(name))')
        .eq('user_id', user.id)
        .order('received_at', { ascending: false })
        .limit(10);
      
      let eventsStr = 'None';
      if (historyEvents && historyEvents.length > 0) {
        eventsStr = historyEvents.map((e: any) => {
          const dateStr = new Date(e.received_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
          const amountStr = e.amount ? e.amount : '0';
          const entityStr = e.entity_email_links?.[0]?.entities?.name || e.sender_name || 'Unknown Entity';
          return `- [${dateStr}] [${e.category}] [${entityStr}]: ₹${amountStr} — [${e.ai_summary || ''}]`;
        }).join('\n');
      }

      financialContext = `FINANCIAL CONTEXT: ${healthSummary}\n\nUPCOMING OBLIGATIONS:\n${obligationsStr}\n\nRECENT FINANCIAL EVENTS:\n${eventsStr}`;
    }

    const today = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    
    let enrichedSystemPrompt = MEENAKSHI_SYSTEM_PROMPT
      + `\n\nTODAY'S DATE: ${today}`;
      
    if (memCtx) enrichedSystemPrompt += `\n\n${memCtx}`;
    if (emailCtx) enrichedSystemPrompt += `\n\n${emailCtx}`;
    if (financialContext) enrichedSystemPrompt += `\n\n${financialContext}`;

    return enrichedSystemPrompt;
  };

  const speakResponse = (text: string) => {
    setModelText(text);
    setIsSpeaking(true);
    Speech.speak(text, {
      language: 'en-IN',
      rate: 0.95,
      pitch: 1.05,
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const askGemini = async (audioBase64: string, mimeType: string) => {
    try {
      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error('API key missing — set EXPO_PUBLIC_GEMINI_API_KEY in .env');

      const ai = new GoogleGenAI({ apiKey });
      const systemPrompt = await buildSystemPrompt();

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        config: { systemInstruction: systemPrompt },
        contents: [{
          role: 'user',
          parts: [{ inlineData: { mimeType, data: audioBase64 } }],
        }],
      });

      const text = result.text ?? 'Illa pa, I could not understand that. Can you try again?';
      
      if (recordingStopTime.current > 0) {
        const latency = Date.now() - recordingStopTime.current;
        console.log(`[VoiceScreen] Response latency: ${latency}ms`);
      }

      const mem: MemoryMessage[] = [
        { role: 'user', text: '[Voice Message]', timestamp: recordingStopTime.current || Date.now() },
        { role: 'model', text, timestamp: Date.now() }
      ];
      saveSession(mem, sessionIdRef.current).then(id => {
        if (!sessionIdRef.current) sessionIdRef.current = id;
      }).catch(err => console.log('Failed to save voice session:', err));

      speakResponse(text);
    } catch (err: any) {
      console.error('[VoiceScreen] askGemini error:', err);
      setError(err instanceof Error ? err.message : 'AI request failed. Please try again.');
      setIsSpeaking(false);
    }
  };

  const sendTextToGemini = async (textQuery: string) => {
    try {
      const tsUser = Date.now();
      recordingStopTime.current = tsUser;

      setUserText(`"${textQuery}"`);
      setModelText('Oru nimisham...');
      setIsSpeaking(true);

      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error('API key missing');

      const ai = new GoogleGenAI({ apiKey });
      const systemPrompt = await buildSystemPrompt();

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        config: { systemInstruction: systemPrompt },
        contents: [{ role: 'user', parts: [{ text: textQuery }] }],
      });

      const text = result.text ?? 'Illa pa, something went wrong. Try again!';
      
      const latency = Date.now() - recordingStopTime.current;
      console.log(`[VoiceScreen] Response latency: ${latency}ms`);

      const mem: MemoryMessage[] = [
        { role: 'user', text: textQuery, timestamp: tsUser },
        { role: 'model', text, timestamp: Date.now() }
      ];
      saveSession(mem, sessionIdRef.current).then(id => {
        if (!sessionIdRef.current) sessionIdRef.current = id;
      }).catch(err => console.log('Failed to save text session:', err));

      speakResponse(text);
    } catch (err: any) {
      console.error('[VoiceScreen] sendTextToGemini error:', err);
      setError(err instanceof Error ? err.message : 'Request failed.');
      setIsSpeaking(false);
    }
  };

  const startNativeRecording = async () => {
    try {
      setError(null);
      Speech.stop();

      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission denied. Please allow in Settings.');
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      setUserText('Listening... tap again to send');
      setModelText('Romba nalla! I\'m listening da...');
    } catch (err: any) {
      console.error('[VoiceScreen] startNativeRecording error:', err);
      setError('Could not start recording. Check microphone permissions.');
    }
  };

  const stopNativeSession = async () => {
    try {
      recordingStopTime.current = Date.now();
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });

      const uri = recorder.uri;
      setIsRecording(false);

      if (!uri) {
        setError('Recording failed — no audio captured.');
        return;
      }

      setModelText('Oru nimisham, processing your voice...');

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // expo-audio HIGH_QUALITY preset usually produces an m4a file.
      await askGemini(base64, 'audio/m4a');
    } catch (err: any) {
      console.error('[VoiceScreen] stopNativeSession error:', err);
      setError('Failed to process recording.');
      setIsRecording(false);
    }
  };

  // ─── Mic button handler ───────────────────────────────────────────────────────

  const handleMic = async () => {
    if (Platform.OS === 'web' && webSession) {
      // Web: Gemini Live streaming
      if (webSession.isActive) {
        webSession.stopSession();
        setModelText('Session paused. Tap to continue.');
      } else {
        await webSession.startSession();
      }
    } else {
      // Native: expo-av record / stop
      if (isRecording) {
        await stopNativeSession();
      } else {
        if (isSpeaking) {
          Speech.stop();
          setIsSpeaking(false);
        }
        await startNativeRecording();
      }
    }
  };

  const handleChip = async (chipText: string) => {
    setError(null);
    Speech.stop();
    setIsSpeaking(false);

    if (Platform.OS === 'web' && webSession) {
      // Web: send text into live session
      setUserText(`"${chipText}"`);
      if (!webSession.isActive) {
        await webSession.startSession();
        await new Promise(r => setTimeout(r, 800));
      }
      try {
        webSession.session?.sendClientContent({
          turns: [{ parts: [{ text: chipText }] }],
        });
      } catch (e) {
        // fallback to text API
        await sendTextToGemini(chipText);
      }
    } else {
      // Native: send text directly to Gemini text API, speak response
      await sendTextToGemini(chipText);
    }
  };

  // ─── Web session state sync ───────────────────────────────────────────────────
  // On web, show transcript and error from the hook
  const displayText = Platform.OS === 'web' && webSession
    ? (webSession.transcript || modelText)
    : modelText;
  const displayError = Platform.OS === 'web' && webSession
    ? (webSession.error || error)
    : error;
  const displayActive = Platform.OS === 'web' && webSession
    ? webSession.isActive
    : isActive;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <View style={styles.bgGradientOverlay} />
      <View style={styles.ambientLeft} />
      <View style={styles.ambientRight} />

      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.headerBtnText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Meenakshi</Text>
            <Text style={[styles.headerStatus, displayActive && styles.headerStatusActive]}>
              {isRecording ? '● Recording...' : displayActive ? '● Speaking...' : 'Ready'}
            </Text>
          </View>
          <TouchableOpacity style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Main */}
        <View style={styles.main}>
          <View style={styles.transcriptArea}>
            <Text style={styles.userTranscript}>{userText}</Text>
            <Text style={styles.modelTranscript} numberOfLines={5}>{displayText}</Text>
          </View>

          {/* Orb */}
          <View style={styles.orbContainer}>
            <Animated.View style={[styles.orbAura, { opacity: pingOpacity }]} />
            <Animated.View style={[styles.pingRing, { transform: [{ scale: pingScale }], opacity: pingOpacity }]} />
            <Animated.View
              style={[styles.orb, { transform: [{ scale: orbScale }], opacity: orbOpacity }, displayActive && styles.orbActive]}
            >
              <View style={styles.orbGradientOverlay} />
            </Animated.View>
          </View>

          {/* Waveform */}
          <View style={styles.waveform}>
            {barAnims.map((anim, i) => (
              <Animated.View
                key={i}
                style={[styles.waveBar, { height: anim }, i === 2 && styles.waveBarPrimary]}
              />
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          {displayError && (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{displayError}</Text>
            </View>
          )}

          {/* Mode hint */}
          <Text style={styles.modeHint}>
            {Platform.OS === 'web'
              ? 'Web: Real-time streaming'
              : isRecording
              ? 'Tap mic again to send'
              : 'Tap and speak — Meenakshi will reply'}
          </Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
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

          <View style={styles.controls}>
            <TouchableOpacity style={styles.controlSide} onPress={() => navigation.navigate('Chat' as never)}>
              <View style={styles.controlPill}>
                <Text style={styles.controlPillIcon}>⌨️</Text>
              </View>
              <Text style={styles.controlLabel}>Text</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.micBtn, isRecording && styles.micBtnRecording, isSpeaking && styles.micBtnSpeaking]}
              onPress={handleMic}
              activeOpacity={0.85}
            >
              <Text style={styles.micBtnIcon}>
                {isRecording ? '⏹' : isSpeaking ? '🔊' : '🎙️'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlSide} onPress={() => { Speech.stop(); setIsSpeaking(false); }}>
              <View style={styles.controlPill}>
                <Text style={styles.controlPillIcon}>🔇</Text>
              </View>
              <Text style={styles.controlLabel}>Stop</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primaryContainer,
    overflow: 'hidden',
  },
  bgGradientOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: `${Colors.primaryContainer}33`,
  },
  ambientLeft: {
    position: 'absolute',
    top: '25%',
    left: -80,
    width: 256,
    height: 256,
    borderRadius: 128,
    backgroundColor: `${Colors.secondary}1A`,
  },
  ambientRight: {
    position: 'absolute',
    bottom: '25%',
    right: -80,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: `${Colors.primaryFixedDim}0D`,
  },
  safe: { flex: 1 },
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
  headerTitle: { ...Typography.headlineLgMobile, color: Colors.onSecondary },
  headerStatus: { ...Typography.labelSm, color: Colors.onPrimaryContainer },
  headerStatusActive: { color: Colors.secondaryFixedDim },
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.containerMobile,
  },
  transcriptArea: {
    alignItems: 'center',
    gap: Spacing.sm,
    maxWidth: 320,
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
    lineHeight: 32,
    fontSize: 18,
  },
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
    backgroundColor: Colors.secondaryContainer,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.secondaryContainer,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 14,
  },
  orbActive: { shadowOpacity: 0.8, shadowRadius: 40 },
  orbGradientOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: `${Colors.secondaryContainer}66`,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 48,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: Colors.secondaryFixedDim,
  },
  waveBarPrimary: { backgroundColor: Colors.secondary },
  footer: { paddingBottom: Spacing.xl, gap: Spacing.md },
  errorWrap: {
    marginHorizontal: Spacing.containerMobile,
    backgroundColor: Colors.errorContainer,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  errorText: {
    ...Typography.bodySm,
    color: Colors.onErrorContainer,
    textAlign: 'center',
  },
  modeHint: {
    ...Typography.labelSm,
    color: Colors.onPrimaryContainer,
    textAlign: 'center',
    opacity: 0.6,
    paddingHorizontal: Spacing.containerMobile,
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
    shadowColor: Colors.secondary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  micBtnRecording: {
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
  },
  micBtnSpeaking: {
    backgroundColor: Colors.secondaryContainer,
    shadowColor: Colors.secondaryContainer,
  },
  micBtnIcon: { fontSize: 32 },
});
