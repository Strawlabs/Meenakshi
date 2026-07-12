import re

with open('hooks/useVoiceSession.ts', 'r') as f:
    content = f.read()

# 1. Replace sessionRef with wsRef and setupCompleteRef
content = content.replace("const sessionRef = useRef<any>(null);", "const wsRef = useRef<WebSocket | null>(null);\n  const setupCompleteRef = useRef(false);")

# 2. Update sessionRef.current.sendRealtimeInput -> wsRef.current.send
content = content.replace("sessionRef.current.sendRealtimeInput({\n          media: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' },\n        });", 
                          "wsRef.current?.send(JSON.stringify({\n          realtimeInput: { audio: { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' } }\n        }));")

content = content.replace("sessionRef.current.sendRealtimeInput({\n              media: { data: base64, mimeType: 'audio/wav' },\n            });",
                          "wsRef.current?.send(JSON.stringify({\n              realtimeInput: { audio: { data: base64, mimeType: 'audio/pcm;rate=16000' } }\n            }));")

# 3. sendText update
content = content.replace("sessionRef.current.sendClientContent({\n        turns: [{ role: 'user', parts: [{ text }] }],\n        turnComplete: true,\n      });",
                          "wsRef.current?.send(JSON.stringify({ realtimeInput: { text } }));")

# 4. cleanup sessionRef.current.close()
content = content.replace("sessionRef.current.close()", "wsRef.current?.close()")
content = content.replace("sessionRef.current = null", "wsRef.current = null")
content = content.replace("sessionRef.current", "wsRef.current")
content = content.replace("!sessionRef.current", "!wsRef.current")

# 5. startSession logic rewrite
old_start_session = """      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) throw new Error('API key missing — set EXPO_PUBLIC_GEMINI_API_KEY in .env');

      const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
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
      
      let connectResolved = false;
      let connectTimeout: ReturnType<typeof setTimeout>;

      const sessionPromise = ai.live.connect({
        model: modelName,
        callbacks: {
          onopen: async () => {
            openedAt = Date.now();
            console.log(`[useVoiceSession] ✓ Socket opened (${modelName})`);
            connectResolved = true;
            clearTimeout(connectTimeout);
            reconnectAttemptsRef.current = 0;
            setVoiceState('listening');
            setUserTranscript('');
            turnMessagesRef.current = { userText: '', aiText: '', ts: Date.now() };

            if (Platform.OS === 'web' && inputCtx && stream) {
              startWebAudioCapture(inputCtx, stream);
            } else {
              await startNativeCapture();
            }
          },

          onmessage: async (message: any) => {
            gotAnyMessageRef.current = true;
            
            // ── Audio data from Gemini ──
            const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              setVoiceState('speaking');
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
              setVoiceState('listening');
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
                isQueuePlayingRef.current = false;
                if (nativePlayerRef.current) {
                  try { nativePlayerRef.current.remove(); } catch (_) {}
                  nativePlayerRef.current = null;
                }
              }
              setVoiceState('listening');
            }
          },

          onerror: (e: any) => {
            connectResolved = true;
            clearTimeout(connectTimeout);
            console.error(`[useVoiceSession] Socket error (${modelName}):`, e);

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
          },

          onclose: (e: any) => {
            connectResolved = true;
            clearTimeout(connectTimeout);
            console.log(`[useVoiceSession] Socket closed (${modelName}):`, e);
            wsRef.current = null;
            if (Platform.OS === 'web') cleanupWeb(); else cleanupNative();

            const closedFast = Date.now() - openedAt < INSTANT_CLOSE_MS;
            if (closedFast && !gotAnyMessageRef.current && modelIndexRef.current < LIVE_MODELS.length - 1) {
              console.warn(`[useVoiceSession] ${modelName} closed instantly with no data — trying next model`);
              modelIndexRef.current += 1;
              startSession(); // retry with next model in chain
              return;
            }
            if (modelIndexRef.current >= LIVE_MODELS.length - 1 && closedFast && !gotAnyMessageRef.current) {
              console.warn('[useVoiceSession] All live models failed instant-close check.');
              setError('Voice streaming unavailable. Please try again later.');
              setVoiceState('error');
              return;
            }

            setVoiceState(prev => {
              // Only reconnect if we didn't manually stop
              if (prev !== 'idle') {
                scheduleReconnect();
                return 'error';
              }
              return 'idle';
            });
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE_NAME } },
          },
          systemInstruction: { parts: [{ text: systemPrompt }] },
        },
      });

      // Connection timeout guard (10s)
      connectTimeout = setTimeout(() => {
        if (!connectResolved) {
          console.warn(`[useVoiceSession] Handshake timeout for ${modelName}`);
          if (wsRef.current) {
            try { wsRef.current.close(); } catch (_) {}
            wsRef.current = null;
          }
        }
      }, 10000);

      // Await connection
      const session = await Promise.race([
        sessionPromise,
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('WebSocket handshake timeout')), 10000)
        ),
      ]);
      
      console.log(`[useVoiceSession] ✓ Live session connected to ${modelName}`);
      wsRef.current = session;"""

new_start_session = """      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
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
          },
        }));
      };

      ws.onmessage = async (event: MessageEvent) => {
        const message = JSON.parse(event.data as string);

        if (message.setupComplete) {
          setupCompleteRef.current = true;
          console.log(`[useVoiceSession] ✓ setupComplete (${modelName}) — starting mic`);
          setVoiceState('listening');
          setUserTranscript('');
          turnMessagesRef.current = { userText: '', aiText: '', ts: Date.now() };
          if (Platform.OS === 'web' && inputCtx && stream) {
            startWebAudioCapture(inputCtx, stream);
          } else {
            await startNativeCapture();
          }
          return;
        }

        gotAnyMessageRef.current = true;
        
        // ── Audio data from Gemini ──
        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData) {
          setVoiceState('speaking');
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
          setVoiceState('listening');
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
            isQueuePlayingRef.current = false;
            if (nativePlayerRef.current) {
              try { nativePlayerRef.current.remove(); } catch (_) {}
              nativePlayerRef.current = null;
            }
          }
          setVoiceState('listening');
        }
      };

      ws.onerror = (e: any) => {
        connectResolved = true;
        clearTimeout(connectTimeout);
        console.error(`[useVoiceSession] Raw socket error (${modelName}):`, e);

        const msg = e?.message ?? String(e) ?? '';
        const status = e?.status ?? e?.code ?? '';

        if (String(msg).includes('429') || String(status).includes('429') || String(status) === '429') {
          setError('Taking a short break... will retry in a moment ☕');
          setVoiceState('error');
          wsRef.current = null;
          if (Platform.OS === 'web') cleanupWeb(); else cleanupNative();
          retryTimerRef.current = setTimeout(() => {
            setError(null);
            startSession();
          }, RATE_LIMIT_RETRY_MS);
        } else {
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
          return;
        }

        setVoiceState(prev => {
          if (prev !== 'idle') {
            scheduleReconnect();
            return 'error';
          }
          return 'idle';
        });
      };

      // Connection timeout guard (10s)
      connectTimeout = setTimeout(() => {
        if (!connectResolved) {
          console.warn(`[useVoiceSession] Handshake timeout for ${modelName}`);
          if (wsRef.current) {
            try { wsRef.current.close(); } catch (_) {}
            wsRef.current = null;
          }
        }
      }, 10000);
      
      wsRef.current = ws;"""

if old_start_session in content:
    content = content.replace(old_start_session, new_start_session)
else:
    print("ERROR: old_start_session not found in file!")
    exit(1)

with open('hooks/useVoiceSession.ts', 'w') as f:
    f.write(content)
print("SUCCESS: useVoiceSession.ts patched!")
