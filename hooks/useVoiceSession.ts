/**
 * useVoiceSession — Web-only Gemini Live WebSocket hook
 *
 * Encapsulates real-time audio streaming to gemini-3-flash-preview.
 * Only use this on Platform.OS === 'web'.
 * On Android/iOS, use expo-av in VoiceScreen instead.
 */

import { useState, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { encode, decode, decodeAudioData } from '../services/audioUtils';
import { MEENAKSHI_SYSTEM_PROMPT } from '../constants';
import { buildMemoryContext } from '../services/memoryService';

export interface VoiceSessionState {
  isActive: boolean;
  transcript: string;
  error: string | null;
  startSession: () => Promise<void>;
  stopSession: () => void;
}

export function useVoiceSession(): VoiceSessionState {
  const [isActive, setIsActive] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const cleanup = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (inputCtxRef.current) {
      inputCtxRef.current.close().catch(console.error);
      inputCtxRef.current = null;
    }
    sourcesRef.current.forEach(s => {
      try { s.stop(); } catch (e) { }
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  };

  const stopSession = () => {
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) { }
      sessionRef.current = null;
    }
    setIsActive(false);
    cleanup();
  };

  const startSession = async () => {
    try {
      setError(null);

      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error('API key missing — set EXPO_PUBLIC_GEMINI_API_KEY in .env');

      const ai = new GoogleGenAI({ apiKey });

      const memCtx = await buildMemoryContext();
      const today = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });
      const systemPrompt = MEENAKSHI_SYSTEM_PROMPT
        + `\n\nTODAY'S DATE: ${today}`
        + (memCtx ? `\n\n${memCtx}` : '');

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioCtx({ sampleRate: 16000 });
      const outputCtx = new AudioCtx({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      audioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const sessionPromise = ai.live.connect({
        model: 'gemini-3-flash-preview',
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setTranscript('Seri, I\'m listening da... Speak now!');

            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              if (!sessionRef.current) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              try {
                sessionRef.current.sendRealtimeInput({
                  media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' },
                });
              } catch (err) {
                console.error('[useVoiceSession] sendRealtimeInput error:', err);
              }
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);
          },

          onmessage: async (message: any) => {
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              const nextTime = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const src = outputCtx.createBufferSource();
              src.buffer = buffer;
              src.connect(outputCtx.destination);
              src.onended = () => sourcesRef.current.delete(src);
              src.start(nextTime);
              nextStartTimeRef.current = nextTime + buffer.duration;
              sourcesRef.current.add(src);
            }

            const textPart = message.serverContent?.modelTurn?.parts?.find((p: any) => p.text);
            if (textPart?.text) setTranscript(textPart.text);

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch (e) { } });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },

          onerror: (e: any) => {
            console.error('[useVoiceSession] error:', e);
            setError(`Connection error: ${e.message || 'Please try again'}`);
            stopSession();
          },

          onclose: () => {
            setIsActive(false);
            setTranscript('Session ended. Tap the mic to start again.');
            cleanup();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          systemInstruction: systemPrompt,
        },
      });

      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error('[useVoiceSession] startSession error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session.');
      setIsActive(false);
    }
  };

  return { isActive, transcript, error, startSession, stopSession };
}
