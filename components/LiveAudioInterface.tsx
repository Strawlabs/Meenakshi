
import React, { useState, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { encode, decode, decodeAudioData } from '../services/audioUtils';
import { MEENAKSHI_SYSTEM_PROMPT } from '../constants';
import Visualizer from './Visualizer';

const LiveAudioInterface: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionRef = useRef<any>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  const startSession = async () => {
    try {
      setError(null);
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) throw new Error("API Key is missing. Please check your .env file.");

      const ai = new GoogleGenAI({ apiKey });

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      inputCtxRef.current = inputCtx;
      audioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      console.log('Attempting to connect with API key:', apiKey.substring(0, 20) + '...');

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.0-flash-exp',
        callbacks: {
          onopen: () => {
            console.log('WebSocket OPENED successfully!');
            setIsActive(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              if (!sessionRef.current) return;

              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) int16[i] = inputData[i] * 32768;

              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };

              try {
                sessionRef.current.sendRealtimeInput({ media: pcmBlob });
              } catch (err) {
                console.error("Failed to send audio:", err);
              }
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message) => {
            const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (audioData) {
              const nextTime = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              const buffer = await decodeAudioData(decode(audioData), outputCtx, 24000, 1);
              const source = outputCtx.createBufferSource();
              source.buffer = buffer;
              source.connect(outputCtx.destination);
              source.onended = () => sourcesRef.current.delete(source);
              source.start(nextTime);
              nextStartTimeRef.current = nextTime + buffer.duration;
              sourcesRef.current.add(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => {
                try { s.stop(); } catch (e) { }
                sourcesRef.current.delete(s);
              });
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e: any) => {
            console.error('Session error FULL:', e);
            console.error('Error message:', e?.message);
            console.error('Error code:', e?.code);
            console.error('Error details:', JSON.stringify(e, null, 2));
            setError(`Error: ${e.message || 'Connection failed'}`);
            stopSession();
          },
          onclose: () => {
            console.log('Session closed - cleanup initiated');
            setIsActive(false);
            cleanup();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          // Minimal config for testing - re-enable features once connection is stable
          // tools: [{ googleSearch: {} }, { googleMaps: {} }],
          // speechConfig: {
          //   voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          // },
          // systemInstruction: MEENAKSHI_SYSTEM_PROMPT,
        }
      });

      console.log('Waiting for session to establish...');
      try {
        sessionRef.current = await sessionPromise;
        console.log('Session established successfully!', sessionRef.current);
      } catch (sessionError) {
        console.error('FAILED to establish session:', sessionError);
        console.error('Session error type:', typeof sessionError);
        console.error('Session error keys:', sessionError ? Object.keys(sessionError) : 'null');
        throw sessionError;
      }
    } catch (err) {
      console.error('START SESSION ERROR:', err);
      setError(err instanceof Error ? err.message : 'Failed to start session');
      setIsActive(false);
    }
  };

  const cleanup = () => {
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
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

  return (
    <div className="flex flex-col items-center justify-center space-y-4 md:space-y-6 p-4 md:p-6 glass rounded-[30px] md:rounded-[40px] relative overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.6)] w-full max-h-[80vh]">
      <div className={`absolute inset-0 transition-opacity duration-1000 ${isActive ? 'opacity-40' : 'opacity-0'} pointer-events-none`}>
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-radial from-cyan-500/30 to-transparent"></div>
      </div>

      <div className="text-center z-10">
        <p className="text-cyan-400 text-[10px] md:text-[11px] uppercase tracking-[0.5em] font-black opacity-80">
          {isActive ? "Meenakshi is Thinking & Searching" : "Awaiting Voice Initialization"}
        </p>
      </div>

      <div className="relative w-full aspect-square max-w-[280px] md:max-w-[320px] flex items-center justify-center z-10">
        <Visualizer active={isActive} />
      </div>

      <div className="flex flex-col items-center gap-4 md:gap-6 z-10 w-full">
        <button
          onClick={isActive ? stopSession : startSession}
          className={`group relative w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center transition-all duration-500 ${isActive
            ? 'bg-red-500/20 border-2 border-red-500 shadow-[0_0_40px_rgba(239,68,68,0.4)]'
            : 'bg-orange-500 shadow-[0_0_60px_rgba(249,115,22,0.5)] active:scale-95'
            }`}
        >
          {isActive ? (
            <div className="w-6 h-6 md:w-8 md:h-8 bg-red-500 rounded-lg"></div>
          ) : (
            <svg className="w-8 h-8 md:w-10 md:h-10 text-white group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          )}
          {!isActive && (
            <div className="absolute inset-0 rounded-full border-2 border-orange-500 animate-ping opacity-20"></div>
          )}
        </button>

        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-cyan-400 animate-pulse shadow-[0_0_15px_#22d3ee]' : 'bg-slate-700'}`}></div>
          <span className={`text-[10px] md:text-[12px] font-black uppercase tracking-[0.3em] ${isActive ? 'text-cyan-400' : 'text-slate-500'}`}>
            {isActive ? "Meenakshi is Ready" : "Start Conversation"}
          </span>
        </div>
      </div>

      {error && (
        <div className="z-10 bg-red-500/10 text-red-400 px-6 py-2 rounded-2xl text-[11px] border border-red-500/30 backdrop-blur-md">
          {error}
        </div>
      )}

      <style>{`
        .bg-gradient-radial {
          background-image: radial-gradient(circle at center, var(--tw-gradient-from) 0%, var(--tw-gradient-to) 100%);
        }
      `}</style>
    </div>
  );
};

export default LiveAudioInterface;
