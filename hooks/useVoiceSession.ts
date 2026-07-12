/**
 * useVoiceSession — Cross-platform Gemini Live API hook
 *
 * Works on: Web (AudioContext), iOS and Android (expo-audio).
 *
 * Model: gemini-3.1-flash-live-preview (v1alpha BidiGenerateContent)
 * Voice: Kore (speechConfig)
 * Response modalities: AUDIO only (Gemini speaks back directly)
 *
 * Architecture:
 *   Web:    navigator.mediaDevices → AudioContext/ScriptProcessorNode → sendRealtimeInput
 *           onmessage PCM → AudioContext.decodeAudioData → BufferSource.start()
 *
 *   Native: expo-audio useAudioStream (continuous PCM stream via onBuffer) → base64 → sendRealtimeInput
 *           onmessage PCM → concatPCMBase64 → pcmToWav → temp .wav file → sequential AudioPlayer queue
 *           First-chunk threshold: ~2s (fast time-to-first-word)
 *           Subsequent-chunk threshold: ~4.5s (reduces mid-sentence gaps)
 *
 * Error handling:
 *   429   → auto-retry after 60 seconds
 *   close → auto-reconnect after 2 seconds (up to 3 attempts)
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
// @ts-ignore
import { GoogleGenAI, Modality } from '@google/genai';
import { encode, decode, decodeAudioData, pcmToWav, concatPCMBase64, downsampleInt16 } from '../services/audioUtils';
import { saveSession, MemoryMessage } from '../services/memoryService';
import { buildSystemPrompt } from '../services/systemPromptService';

// ─── Native-only imports (tree-shaken on web via Platform guard at runtime) ──
let expoAudio: typeof import('expo-audio') | null = null;
let useAudioStream: any = () => ({ stream: null, isStreaming: false });
let FileSystem: typeof import('expo-file-system/legacy') | null = null;
if (Platform.OS !== 'web') {
  expoAudio = require('expo-audio');
  useAudioStream = require('expo-audio').useAudioStream;
  FileSystem = require('expo-file-system/legacy');
}

// ─── Add near the top of the file, outside the component ──────────────────
function utf8BytesToString(bytes: Uint8Array): string {
  // Prefer the platform TextDecoder when available (modern Hermes has it)
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-8').decode(bytes);
  }
  // Manual fallback — correct for multi-byte UTF-8 (Tamil, etc.)
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const c = bytes[i++];
    if (c < 0x80) {
      result += String.fromCharCode(c);
    } else if (c < 0xe0) {
      const c2 = bytes[i++];
      result += String.fromCharCode(((c & 0x1f) << 6) | (c2 & 0x3f));
    } else if (c < 0xf0) {
      const c2 = bytes[i++], c3 = bytes[i++];
      result += String.fromCharCode(((c & 0x0f) << 12) | ((c2 & 0x3f) << 6) | (c3 & 0x3f));
    } else {
      const c2 = bytes[i++], c3 = bytes[i++], c4 = bytes[i++];
      let cp = ((c & 0x07) << 18) | ((c2 & 0x3f) << 12) | ((c3 & 0x3f) << 6) | (c4 & 0x3f);
      cp -= 0x10000;
      result += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return result;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Live API model. A single entry — no 2.5-flash variants (20 req/day, confirmed
// "model not found" in prior testing). Add a gemini-3.x alternative here
// only after validating on the Live API.
const LIVE_MODELS = [
  'gemini-3.1-flash-live-preview',
];
const VOICE_NAME = 'Kore';
const CHUNK_INTERVAL_MS = 200;        // Native mic chunk recording duration
const ANDROID_STOP_DELAY_MS = 500;    // Android filesystem flush delay after recorder.stop()
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 2000;
const RATE_LIMIT_RETRY_MS = 60000;
const SYSTEM_PROMPT_CACHE_MS = 5 * 60 * 1000; // 5 minutes

// ─── Native audio buffering thresholds ───────────────────────────────────────
// Asymmetric strategy: first chunk flushes fast (time-to-first-word),
// subsequent chunks buffer longer (fewer file I/O round-trips = fewer gaps).
// 24 kHz · 16-bit mono = 48 000 bytes/s of raw PCM.
const FIRST_CHUNK_THRESHOLD_BYTES = 96_000;      // ~2 s — fast first word
const SUBSEQUENT_CHUNK_THRESHOLD_BYTES = 216_000; // ~4.5 s — close mid-sentence gaps
const FIRST_CHUNK_FLUSH_MS = 600;                // Short-response safety flush
const SUBSEQUENT_CHUNK_FLUSH_MS = 1_500;         // Wider window for longer segments
// Fallback padding added to computed audio duration when scheduling finishChunk.
// 500 ms is enough hardware-buffer slack; reduce further only after on-device
// confirmation that didJustFinish is reliably on-time across OEM Android skins.
const PLAYER_REMOVAL_PADDING_MS = 500;

// ─── Module-level system prompt cache ────────────────────────────────────────
// Shared across all hook instances. Only rebuilt after SYSTEM_PROMPT_CACHE_MS.
let _cachedSystemPrompt: string | null = null;
let _cachedSystemPromptAt = 0;

// Language detection + Meenakshi personality for Live sessions
const LANGUAGE_INSTRUCTION = `

LANGUAGE DETECTION:
Detect the language the user is speaking and respond naturally in the same language.
- If English → respond in clear, warm English
- If Tamil or Tanglish → respond naturally in Tanglish (mix Tamil words like 'oru nimisham',
  'nalla kelvi', 'seri', 'paathukkalam', 'aama da' naturally into English sentences)
- If Hindi → respond in simple Hindi with English financial terms
Never announce that you are switching languages. Just switch naturally.
Your voice is warm, confident, empathetic, and sounds like a knowledgeable friend who happens to
know everything about your finances. Speak at a natural pace. Responses are short and
conversational — under 4 sentences unless detailed analysis is requested.`;

// ─── Types ────────────────────────────────────────────────────────────────────

export type VoiceState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'error';

export interface VoiceSessionState {
  voiceState: VoiceState;
  /** @deprecated — use voiceState instead */
  isActive: boolean;
  userTranscript: string;
  aiTranscript: string;
  /** Legacy: combined AI transcript for older consumers */
  transcript: string;
  error: string | null;
  isMuted: boolean;
  audioLevel: number;
  startSession: () => Promise<void>;
  stopSession: () => void;
  forceTurnComplete: () => void;
  interrupt: () => void;
  sendText: (text: string) => void;
  toggleMute: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param _deprecated — No longer needed.
 */
export function useVoiceSession(_deprecated?: any): VoiceSessionState {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const voiceStateRef = useRef<VoiceState>('idle');

  const setVoiceStateSync = useCallback((state: VoiceState) => {
    voiceStateRef.current = state;
    setVoiceState(state);
  }, []);

  const [userTranscript, setUserTranscript] = useState('');
  const [aiTranscript, setAiTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);

  // Use the native AudioStream hook (dummy on Web)
  const { stream: nativeStream } = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: 'int16',
    onBuffer: (buffer: any) => {
      if (!isRecordingActiveRef.current || !wsRef.current) return;
      if (isMutedRef.current) return;
      if (voiceStateRef.current === 'speaking') return; // Prevent echo self-interruption

      try {
        const isBase64 = typeof buffer.data === 'string';
        const byteLen = buffer.data?.byteLength;
        
        let b64 = '';
        if (isBase64) {
          b64 = buffer.data;
        } else {
          let bytes: Uint8Array;
          if (buffer.data instanceof ArrayBuffer) {
            bytes = new Uint8Array(buffer.data);
          } else if (buffer.data?.buffer instanceof ArrayBuffer) {
            bytes = new Uint8Array(buffer.data.buffer, buffer.data.byteOffset, buffer.data.byteLength);
          } else if (Array.isArray(buffer.data)) {
            bytes = new Uint8Array(buffer.data.length * 2);
            const view = new DataView(bytes.buffer);
            for (let i = 0; i < buffer.data.length; i++) {
              view.setInt16(i * 2, buffer.data[i], true);
            }
          } else {
            bytes = new Uint8Array(buffer.data);
          }
          
          if (buffer.sampleRate && buffer.sampleRate > 16000) {
            bytes = downsampleInt16(bytes, buffer.sampleRate, 16000);
          }
          
          b64 = encode(bytes);
        }
        
        // Log first few frames to see what's happening
        if (Math.random() < 0.05) {
          console.log(`[AudioStream] Sending chunk. IsBase64=${isBase64}, byteLength=${byteLen}, b64=${b64.substring(0, 30)}...`);
        }
        
        wsRef.current.send(JSON.stringify({
          realtimeInput: { audio: { data: b64, mimeType: 'audio/pcm;rate=16000' } },
        }));
      } catch (err) {
        console.error('[AudioStream] Error encoding buffer:', err);
      }
    }
  });

  // iOS AVAudioEngine can sometimes silently pause recording when AI audio playback
  // finishes or interrupts. This ensures the mic is always awake when we return to listening.
  useEffect(() => {
    if (voiceState === 'listening' && isRecordingActiveRef.current && nativeStream) {
      try {
        nativeStream.start();
      } catch (err) {
        console.warn('[useVoiceSession] Error restarting native stream:', err);
      }
    }
  }, [voiceState, nativeStream]);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const setupCompleteRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionIdRef = useRef<string | undefined>(undefined);
  const isMutedRef = useRef(false);
  const turnMessagesRef = useRef<{ userText: string; aiText: string; ts: number } | null>(null);
  const lastTurnCompleteRef = useRef(0);
  const turnCompletePendingRef = useRef(false);
  const turnTimingRef = useRef<{ userSpeechEndTs: number | null; firstAudioByteTs: number | null }>({
    userSpeechEndTs: null,
    firstAudioByteTs: null,
  });
  
  // Model Fallback Refs
  const modelIndexRef = useRef(0);
  const gotAnyMessageRef = useRef(false);
  const INSTANT_CLOSE_MS = 4000;

  // Web-specific refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const inputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // Native-specific refs
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativePlayerRef = useRef<any>(null);
  const isRecordingActiveRef = useRef(false);
  // Timestamp when the microphone stream actually started (set in setupComplete).
  // Used by forceTurnComplete to guard against sub-1.5s accidental taps.
  const recordingStartedAtRef = useRef(0);

  // Native audio playback queue
  const audioQueueRef = useRef<string[]>([]); // Array of WAV base64 strings awaiting write to disk
  const preloadedQueueRef = useRef<{ uri: string; durationMs: number }[]>([]); // Array of preloaded files ready for instant playback
  const isPreloadingRef = useRef(false);
  const isQueuePlayingRef = useRef(false);
  const pcmBufferRef = useRef<string[]>([]); // Array of raw PCM base64 strings
  const pcmBufferTotalLengthRef = useRef(0);
  const pcmFlushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // true until the first PCM flush of each AI turn — controls asymmetric threshold
  const isFirstChunkOfTurnRef = useRef(true);

  // ── Mute sync ──────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      isMutedRef.current = !prev;
      return !prev;
    });
  }, []);

  // ── Memory save ────────────────────────────────────────────────────────────

  const persistTurn = useCallback((userText: string, aiText: string, ts: number) => {
    if (!userText && !aiText) return;
    const messages: MemoryMessage[] = [
      { role: 'user', text: userText || '[Voice input]', timestamp: ts },
      { role: 'model', text: aiText, timestamp: Date.now() },
    ];
    saveSession(messages, sessionIdRef.current)
      .then(id => { if (!sessionIdRef.current) sessionIdRef.current = id; })
      .catch(err => console.warn('[useVoiceSession] saveSession failed:', err));
  }, []);

  // ── Web: cleanup ───────────────────────────────────────────────────────────

  const cleanupWeb = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(() => {});
      inputCtxRef.current = null;
    }
    sourcesRef.current.forEach(s => { try { s.stop(); } catch (_) {} });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  }, []);

  // ── Native: cleanup ────────────────────────────────────────────────────────

  const cleanupNative = useCallback(() => {
    if (nativeStream && isRecordingActiveRef.current) {
      try { nativeStream.stop(); } catch (err) { console.warn('[useVoiceSession] Error stopping native stream:', err); }
    }
    isRecordingActiveRef.current = false;

    // Stop player
    audioQueueRef.current = [];
    isQueuePlayingRef.current = false;
    if (nativePlayerRef.current) {
      try { nativePlayerRef.current.remove(); } catch (_) {}
      nativePlayerRef.current = null;
    }
    turnCompletePendingRef.current = false;
  }, [nativeStream]);

  // ── Shared: stop session ───────────────────────────────────────────────────

  const stopSession = useCallback(() => {
    // Cancel pending retries
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
    reconnectAttemptsRef.current = 0;
    modelIndexRef.current = 0;
    gotAnyMessageRef.current = false;

    // Save any in-progress turn
    if (turnMessagesRef.current) {
      const { userText, aiText, ts } = turnMessagesRef.current;
      persistTurn(userText, aiText, ts);
      turnMessagesRef.current = null;
    }

    if (wsRef.current) {
      try { console.trace('[useVoiceSession] ws.close() called from:'); wsRef.current.close(); } catch (_) {}
      wsRef.current = null;
    }

    if (Platform.OS === 'web') {
      cleanupWeb();
    } else {
      cleanupNative();
    }

    setVoiceStateSync('idle');
    setError(null);
    setAudioLevel(0);
  }, [cleanupWeb, cleanupNative, persistTurn, setVoiceStateSync]);
  // ── Manual Stream End ("Stop and answer now" override) ────────────────────
  //
  // With automaticActivityDetection enabled, Gemini ends turns on its own
  // after silence. This function is the explicit user override ("I'm done,
  // don't wait"). It should only be called after ≥ 1.5 s of mic activity so
  // an accidental tap right after connecting can't cut off speech instantly.
  //
  // Uses realtimeInput.audioStreamEnd — the correct signal for ending a
  // streaming audio turn. clientContent.turnComplete is for typed text only
  // and was causing the socket to close.
  const forceTurnComplete = useCallback(() => {
    if (!wsRef.current || !setupCompleteRef.current) return;

    const msSinceRecordingStarted = Date.now() - recordingStartedAtRef.current;
    if (msSinceRecordingStarted < 1500) {
      console.log(`[useVoiceSession] audioStreamEnd suppressed — only ${msSinceRecordingStarted}ms of mic activity`);
      return;
    }
    if (Date.now() - lastTurnCompleteRef.current < 2000) return;
    lastTurnCompleteRef.current = Date.now();

    console.log('[useVoiceSession] audioStreamEnd sent, waiting for final turnComplete before any close');
            console.log('[useVoiceSession] Sending audioStreamEnd (user override)...');
    try {
      wsRef.current.send(JSON.stringify({
        realtimeInput: { audioStreamEnd: true },
      }));
    } catch (err) {
      console.error('[useVoiceSession] Failed to send audioStreamEnd:', err);
    }
  }, []);

  // ── Manual Interrupt (Stop AI speaking) ────────────────────────────────────
  const interrupt = useCallback(() => {
    if (voiceStateRef.current !== 'speaking' && voiceStateRef.current !== 'processing') return;
    console.log('[useVoiceSession] Interrupting AI playback...');

    // Clear native playback queues
    audioQueueRef.current = [];
    preloadedQueueRef.current = [];
    isQueuePlayingRef.current = false;
    
    // Stop active native player
    if (nativePlayerRef.current) {
      try { nativePlayerRef.current.remove(); } catch (_) {}
      nativePlayerRef.current = null;
    }

    // Clear Web playback queues
    if (Platform.OS === 'web') {
      sourcesRef.current.forEach(src => {
        try { src.stop(); } catch (_) {}
      });
      sourcesRef.current.clear();
      nextStartTimeRef.current = 0;
    }

    setVoiceStateSync('listening');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      stopSession();
    };
  }, []);

  // ── Web: send PCM chunk via ScriptProcessorNode ────────────────────────────

  const startWebAudioCapture = useCallback((inputCtx: AudioContext, stream: MediaStream) => {
    const source = inputCtx.createMediaStreamSource(stream);
    const processor = inputCtx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;

    processor.onaudioprocess = (e) => {
      if (!wsRef.current || isMutedRef.current) return;
      const inputData = e.inputBuffer.getChannelData(0);

      // Calculate RMS audio level for orb visualizer
      let sumSquares = 0;
      const int16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
        sumSquares += inputData[i] * inputData[i];
      }
      const rms = Math.sqrt(sumSquares / inputData.length);
      setAudioLevel(Math.min(1, rms * 4));

      try {
        wsRef.current?.send(JSON.stringify({
          realtimeInput: { audio: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } },
        }));
      } catch (err) {
        console.error('[useVoiceSession] sendRealtimeInput error:', err);
      }
    };

    source.connect(processor);
    processor.connect(inputCtx.destination);
  }, []);

  // ── Web: play PCM chunk from Gemini ───────────────────────────────────────

  const playWebAudioChunk = useCallback(async (audioData: string) => {
    if (isMutedRef.current) return;
    const ctx = audioContextRef.current;
    if (!ctx) return;
    try {
      const nextTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
      const buffer = await decodeAudioData(decode(audioData), ctx, 24000, 1);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.onended = () => {
        sourcesRef.current.delete(src);
        if (sourcesRef.current.size === 0 && turnCompletePendingRef.current) {
          setVoiceStateSync('listening');
          turnCompletePendingRef.current = false;
        }
      };
      src.start(nextTime);
      nextStartTimeRef.current = nextTime + buffer.duration;
      sourcesRef.current.add(src);
    } catch (err) {
      console.error('[useVoiceSession] playWebAudioChunk error:', err);
    }
  }, []);

  // ── Native: start native capture ───────────────────────────────────────────

  const startNativeCapture = useCallback(async () => {
    if (!expoAudio || !nativeStream) return;
    try {
      const perm = await (expoAudio as any).AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setError('Microphone access needed. Please allow in Settings.');
        setVoiceStateSync('error');
        return;
      }

      await (expoAudio as any).AudioModule.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      isRecordingActiveRef.current = true;
      nativeStream.start();
    } catch (err) {
      console.error('[useVoiceSession] Failed to start native AudioStream:', err);
    }
  }, [nativeStream]);

  // ── Native: sequential audio playback queue ───────────────────────────────
  //
  // Gemini sends PCM chunks that must play in order. We convert each to WAV,
  // write to a temp file, and play sequentially. On completion (estimated by
  // audio duration), the next chunk auto-plays from the queue.

  const playNextFromQueue = useCallback(async () => {
    if (preloadedQueueRef.current.length === 0) {
      isQueuePlayingRef.current = false;
      // Switch back to listening only if the write pipeline is also empty
      if (audioQueueRef.current.length === 0 && turnCompletePendingRef.current) {
        setVoiceStateSync('listening');
        turnCompletePendingRef.current = false;
      }
      return;
    }

    isQueuePlayingRef.current = true;
    const { uri, durationMs } = preloadedQueueRef.current.shift()!;

    try {
      // Defer old-player removal to allow hardware audio buffer to drain.
      if (nativePlayerRef.current) {
        const oldPlayer = nativePlayerRef.current;
        setTimeout(() => {
          try { oldPlayer.remove(); } catch (_) {}
        }, PLAYER_REMOVAL_PADDING_MS);
      }

      // This hits the preload registry — hot swap, zero file I/O overhead
      const player = expoAudio!.createAudioPlayer({ uri });
      nativePlayerRef.current = player;

      let isDone = false;

      const finishChunk = () => {
        if (isDone) return;
        isDone = true;
        if (nativePlayerRef.current === player) nativePlayerRef.current = null;

        setTimeout(() => {
          try { player.remove(); } catch (_) {}
          FileSystem!.deleteAsync(uri, { idempotent: true }).catch(() => {});
        }, PLAYER_REMOVAL_PADDING_MS);

        playNextFromQueue();
      };

      if (player.addListener) {
        player.addListener('playbackStatusUpdate', (status: any) => {
          if (status.didJustFinish || status.error) {
            finishChunk();
          }
        });
      }

      player.play();

      // Safety-net fallback (very generous padding to prevent cutting off audio early on slow devices)
      setTimeout(finishChunk, durationMs + 2000);

    } catch (err) {
      console.error('[useVoiceSession] native playback error:', err);
      isQueuePlayingRef.current = false;
      if (preloadedQueueRef.current.length > 0 || audioQueueRef.current.length > 0) {
        playNextFromQueue();
      }
    }
  }, []);

  const processPreloadPipeline = useCallback(async () => {
    if (isPreloadingRef.current || audioQueueRef.current.length === 0 || !FileSystem || !expoAudio) return;
    isPreloadingRef.current = true;
    
    try {
      while (audioQueueRef.current.length > 0) {
        const wavBase64 = audioQueueRef.current.shift()!;
        const uri = FileSystem.cacheDirectory + `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.wav`;
        
        await FileSystem.writeAsStringAsync(uri, wavBase64, {
          encoding: (FileSystem as any).EncodingType.Base64,
        });

        const wavBytes = decode(wavBase64);
        const audioDataBytes = Math.max(0, wavBytes.length - 44);
        const durationMs = (audioDataBytes / (24000 * 2)) * 1000;
        
        // Fire and forget preload — expo-audio will cache the AVPlayer/bytes
        if (expoAudio && expoAudio.preload) {
          expoAudio.preload(uri).catch(() => {});
        }
        
        preloadedQueueRef.current.push({ uri, durationMs });
        
        // If playback stopped (or hasn't started), kick it off now that we have a playable URI
        if (!isQueuePlayingRef.current) {
          playNextFromQueue();
        }
      }
    } finally {
      isPreloadingRef.current = false;
    }
  }, [playNextFromQueue]);

  // ── Native: enqueue PCM from Gemini for playback ──────────────────────────

  const flushPcmBuffer = useCallback(() => {
    if (pcmBufferRef.current.length === 0 || isMutedRef.current || !FileSystem || !expoAudio) {
      pcmBufferRef.current = [];
      pcmBufferTotalLengthRef.current = 0;
      return;
    }

    try {
      // Mark that the first chunk of this turn has been flushed.
      // Subsequent chunks within the same turn use the larger buffer threshold.
      isFirstChunkOfTurnRef.current = false;

      // Concatenate all small PCM chunks into one large PCM chunk
      const combinedPcmBase64 = concatPCMBase64(pcmBufferRef.current);
      pcmBufferRef.current = [];
      pcmBufferTotalLengthRef.current = 0;

      // Wrap raw PCM with WAV header so native player can decode it
      const wavBase64 = pcmToWav(combinedPcmBase64);
      audioQueueRef.current.push(wavBase64);
      processPreloadPipeline();
    } catch (err) {
      console.error('[useVoiceSession] flushPcmBuffer error:', err);
    }
  }, [processPreloadPipeline]);

  const playNativeAudioChunk = useCallback(async (audioData: string) => {
    if (isMutedRef.current) return;

    // Accumulate raw PCM chunk
    pcmBufferRef.current.push(audioData);
    pcmBufferTotalLengthRef.current += Math.floor(audioData.length * 0.75);

    // Asymmetric threshold:
    //   First chunk of a turn → flush at ~2 s to minimise time-to-first-word.
    //   Subsequent chunks     → flush at ~4.5 s to reduce file-I/O / player-
    //                           instantiation overhead between sentences.
    const threshold = isFirstChunkOfTurnRef.current
      ? FIRST_CHUNK_THRESHOLD_BYTES
      : SUBSEQUENT_CHUNK_THRESHOLD_BYTES;
    const flushMs = isFirstChunkOfTurnRef.current
      ? FIRST_CHUNK_FLUSH_MS
      : SUBSEQUENT_CHUNK_FLUSH_MS;

    if (pcmBufferTotalLengthRef.current >= threshold) {
      if (pcmFlushTimeoutRef.current) clearTimeout(pcmFlushTimeoutRef.current);
      flushPcmBuffer();
    } else {
      if (pcmFlushTimeoutRef.current) clearTimeout(pcmFlushTimeoutRef.current);
      pcmFlushTimeoutRef.current = setTimeout(() => {
        flushPcmBuffer();
      }, flushMs);
    }
  }, [flushPcmBuffer]);

  // ── sendText (for quick chips + text fallback) ────────────────────────────

  const sendText = useCallback((text: string) => {
    if (!wsRef.current) return;
    try {
      setUserTranscript(text);
      setVoiceStateSync('processing');
      if (turnMessagesRef.current) {
        turnMessagesRef.current.userText = text;
      } else {
        turnMessagesRef.current = { userText: text, aiText: '', ts: Date.now() };
      }
      wsRef.current?.send(JSON.stringify({ realtimeInput: { text } }));
    } catch (err) {
      console.error('[useVoiceSession] sendText error:', err);
    }
  }, []);

  // ── Main: start session ────────────────────────────────────────────────────

  const startSession = useCallback(async () => {
    if (wsRef.current) return; // Already active
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }

    try {
      setError(null);
      setVoiceStateSync('connecting');
      setUserTranscript('');
      setAiTranscript('');
      setAudioLevel(0);

      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error('API key missing — set EXPO_PUBLIC_GEMINI_API_KEY in .env');

      const systemPrompt = await buildSystemPrompt();

      // Platform-specific audio setup
      let inputCtx: AudioContext | null = null;
      let outputCtx: AudioContext | null = null;
      let stream: MediaStream | null = null;

      if (Platform.OS === 'web') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        inputCtx = new AudioCtx({ sampleRate: 16000 });
        outputCtx = new AudioCtx({ sampleRate: 24000 });
        inputCtxRef.current = inputCtx;
        audioContextRef.current = outputCtx;

        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
          },
        });
        streamRef.current = stream;
      }

      const modelName = LIVE_MODELS[modelIndexRef.current];
      gotAnyMessageRef.current = false;
      let openedAt = Date.now();

      console.log('[useVoiceSession] Attempting Live API model:', modelName, '| Voice:', VOICE_NAME);
      
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
      const ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      setupCompleteRef.current = false;

      let connectResolved = false;
      let connectTimeout: ReturnType<typeof setTimeout>;

      ws.onopen = () => {
        openedAt = Date.now();
        console.log(`[useVoiceSession] ✓ Raw socket opened (${modelName})`);
        connectResolved = true;
        clearTimeout(connectTimeout);
        reconnectAttemptsRef.current = 0;
        
        ws.send(JSON.stringify({
          setup: {
            model: `models/${modelName}`,
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } } },
            },
            systemInstruction: { parts: [{ text: systemPrompt }] },
            // Gemini detects end-of-speech automatically after ~1 s of silence.
            // This makes turns end naturally without requiring a button tap.
            // Low sensitivity avoids cutting off slow/thinking speech mid-sentence.
            realtimeInputConfig: {
              automaticActivityDetection: {
                disabled: false,
                startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
                endOfSpeechSensitivity:   'END_SENSITIVITY_LOW',
                silenceDurationMs: 1000,
              },
            },
          },
        }));
      };

      ws.onmessage = async (event: MessageEvent) => {
        const raw = event.data;

        const parseMessage = (text: string) => {
          try {
            return JSON.parse(text);
          } catch (err) {
            console.error('[useVoiceSession] Failed to parse message:', text.slice(0, 200), err);
            return null;
          }
        };

        const handleMessage = async (message: any) => {
          if (!message) return;

          if (message.setupComplete) {
            setupCompleteRef.current = true;
            console.log(`[useVoiceSession] ✓ setupComplete (${modelName}) — starting mic`);
            setVoiceStateSync('listening');
            setUserTranscript('');
            turnMessagesRef.current = { userText: '', aiText: '', ts: Date.now() };

            if (Platform.OS === 'web' && inputCtx && stream) {
              startWebAudioCapture(inputCtx, stream);
            } else {
              await startNativeCapture();
            }
            // Stamp the moment the mic stream actually started so
            // forceTurnComplete can enforce the 1.5 s minimum-speech guard.
            recordingStartedAtRef.current = Date.now();
            return;
          }

          gotAnyMessageRef.current = true;
          
          // ── Audio data from Gemini ──
          const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audioData) {
            if (turnTimingRef.current.userSpeechEndTs && !turnTimingRef.current.firstAudioByteTs) {
              turnTimingRef.current.firstAudioByteTs = Date.now();
              const latencyMs = turnTimingRef.current.firstAudioByteTs - turnTimingRef.current.userSpeechEndTs;
              console.log(`[LATENCY] Time-to-first-audio-byte: ${latencyMs}ms`);
            }
            setVoiceStateSync('speaking');
            if (Platform.OS === 'web') {
              await playWebAudioChunk(audioData);
            } else {
              await playNativeAudioChunk(audioData);
            }
          }

          // ── Text transcript from model turn parts ──
          const parts: any[] = message.serverContent?.modelTurn?.parts ?? [];
          const textPart = parts.find((p: any) => p.text);
          if (textPart?.text) {
            setAiTranscript(prev => prev + textPart.text);
            if (turnMessagesRef.current) {
              turnMessagesRef.current.aiText += textPart.text;
            }
          }

          // ── Output transcription (model speech → text) ──
          const outputTranscript = message.serverContent?.outputTranscription?.text;
          if (outputTranscript) {
            setAiTranscript(prev => prev + outputTranscript);
            if (turnMessagesRef.current) {
              turnMessagesRef.current.aiText += outputTranscript;
            }
          }

          // Track end of user speech for latency metrics
          if (message.serverContent?.audioStreamEnd || (message.serverContent as any)?.activityEnd) {
            turnTimingRef.current.userSpeechEndTs = Date.now();
            turnTimingRef.current.firstAudioByteTs = null;
          }

          // ── User input transcript ──
          const inputTranscript = message.serverContent?.inputTranscription?.text;
          if (inputTranscript) {
            setUserTranscript(inputTranscript);
            if (turnMessagesRef.current) {
              turnMessagesRef.current.userText = inputTranscript;
            }
          }

          // ── Turn complete — save to memory ──
          if (message.serverContent?.turnComplete) {
            console.log('[useVoiceSession] Received turnComplete from server. Chunks in queue:', audioQueueRef.current.length, 'pcmBuffer bytes:', pcmBufferTotalLengthRef.current);
            // Force flush any remaining audio bytes immediately
            if (pcmFlushTimeoutRef.current) clearTimeout(pcmFlushTimeoutRef.current);
            flushPcmBuffer();

            // Reset to first-chunk mode so the NEXT AI turn starts with fast buffering
            isFirstChunkOfTurnRef.current = true;

            if (isQueuePlayingRef.current || (Platform.OS === 'web' && sourcesRef.current.size > 0)) {
              turnCompletePendingRef.current = true;
            } else {
              setVoiceStateSync('listening');
            }

            if (turnMessagesRef.current) {
              const { userText, aiText, ts } = turnMessagesRef.current;
              if (aiText) persistTurn(userText, aiText, ts);
              turnMessagesRef.current = { userText: '', aiText: '', ts: Date.now() };
            }
            setAiTranscript(''); // Reset for next turn display
          }

          // ── Interrupted — clear queued audio (barge-in) ──
          if (message.serverContent?.interrupted) {
            if (Platform.OS === 'web') {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch (_) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            } else {
              // Flush native audio queue on interruption
              audioQueueRef.current = [];
              pcmBufferRef.current = [];
              pcmBufferTotalLengthRef.current = 0;
              isQueuePlayingRef.current = false;
              turnCompletePendingRef.current = false;
              if (nativePlayerRef.current) {
                try { nativePlayerRef.current.remove(); } catch (_) {}
                nativePlayerRef.current = null;
              }
              // Reset to first-chunk mode so the next AI response starts fast
              isFirstChunkOfTurnRef.current = true;
            }
            setVoiceStateSync('listening');
          }
        };

        if (typeof raw === 'string') {
          await handleMessage(parseMessage(raw));
          return;
        }

        // Binary frame — arrives as ArrayBuffer since we set binaryType
        if (raw instanceof ArrayBuffer) {
          const text = utf8BytesToString(new Uint8Array(raw));
          await handleMessage(parseMessage(text));
          return;
        }

        console.warn('[useVoiceSession] Unexpected message data type:', typeof raw, raw?.constructor?.name);
      };

      ws.onerror = (e: any) => {
        connectResolved = true;
        clearTimeout(connectTimeout);
        console.error(`[useVoiceSession] Raw socket error (${modelName}):`, e);

        const msg = e?.message ?? String(e) ?? '';
        const status = e?.status ?? e?.code ?? '';

        if (String(msg).includes('429') || String(status).includes('429') || String(status) === '429') {
          // Rate limited — auto-retry after 60s
          setError('Taking a short break... will retry in a moment ☕');
          setVoiceState('error');
          wsRef.current = null;
          if (Platform.OS === 'web') cleanupWeb(); else cleanupNative();
          retryTimerRef.current = setTimeout(() => {
            setError(null);
            startSession();
          }, RATE_LIMIT_RETRY_MS);
        } else {
          // Try next model on normal error if we haven't exhausted chain
          if (modelIndexRef.current < LIVE_MODELS.length - 1) {
             console.warn(`[useVoiceSession] Error on ${modelName}, trying next in chain`);
             modelIndexRef.current += 1;
             wsRef.current = null;
             if (Platform.OS === 'web') cleanupWeb(); else cleanupNative();
             startSession();
             return;
          }
          
          setError(`Connection error: ${msg || 'Please try again'}`);
          setVoiceState('error');
          scheduleReconnect();
        }
      };

      ws.onclose = (e: any) => {
        connectResolved = true;
        clearTimeout(connectTimeout);
        console.log(`[useVoiceSession] Raw socket closed (${modelName}), code=${e.code}, setupComplete=${setupCompleteRef.current}`);
        wsRef.current = null;
        if (Platform.OS === 'web') cleanupWeb(); else cleanupNative();

        const closedFast = Date.now() - openedAt < INSTANT_CLOSE_MS;
        if (closedFast && !setupCompleteRef.current && modelIndexRef.current < LIVE_MODELS.length - 1) {
          console.warn(`[useVoiceSession] ${modelName} closed instantly with no data — trying next model`);
          modelIndexRef.current += 1;
          startSession(); // retry with next model in chain
          return;
        }
        if (modelIndexRef.current >= LIVE_MODELS.length - 1 && closedFast && !setupCompleteRef.current) {
          console.warn('[useVoiceSession] All live models failed instant-close check.');
          setError('Voice streaming unavailable. Please try again later.');
          setVoiceState('error');
          setVoiceStateSync('error');
          return;
        }

        const wasActive = voiceStateRef.current !== 'idle';
        if (wasActive) {
          scheduleReconnect();
          setVoiceStateSync('error');
        } else {
          setVoiceStateSync('idle');
        }
      };

      // Connection timeout guard (10s)
      connectTimeout = setTimeout(() => {
        if (!connectResolved) {
          console.warn(`[useVoiceSession] Handshake timeout for ${modelName}`);
          if (wsRef.current) {
            try { console.trace('[useVoiceSession] ws.close() called from:'); wsRef.current.close(); } catch (_) {}
            wsRef.current = null;
          }
        }
      }, 10000);

      wsRef.current = ws;
    } catch (err: any) {
      console.error('[useVoiceSession] startSession error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to start session.';

      if (msg.includes('429')) {
        setError('Taking a short break... will retry in a moment ☕');
        retryTimerRef.current = setTimeout(() => {
          setError(null);
          startSession();
        }, RATE_LIMIT_RETRY_MS);
      } else {
        setError(msg);
      }
      setVoiceState('error');
      if (Platform.OS === 'web') cleanupWeb(); else cleanupNative();
    }
  }, [
    startWebAudioCapture, playWebAudioChunk,
    startNativeCapture, playNativeAudioChunk,
    cleanupWeb, cleanupNative, persistTurn,
  ]);

  // ── Auto-reconnect ─────────────────────────────────────────────────────────

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setError('Connection lost. Tap the mic to reconnect.');
      setVoiceState('error');
      return;
    }
    reconnectAttemptsRef.current += 1;
    setError('Reconnecting...');
    setVoiceState('error');
    reconnectTimerRef.current = setTimeout(() => {
      if (wsRef.current) return; // Already reconnected
      setError(null);
      startSession();
    }, RECONNECT_DELAY_MS);
  }, [startSession]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const isActive = voiceState !== 'idle' && voiceState !== 'error';

  return {
    voiceState,
    isActive,
    userTranscript,
    aiTranscript,
    transcript: aiTranscript, // Legacy alias
    error,
    isMuted,
    audioLevel,
    startSession,
    stopSession,
    forceTurnComplete,
    interrupt,
    sendText,
    toggleMute,
  };
}
