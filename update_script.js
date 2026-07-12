const fs = require('fs');
const file = '/Users/kavya/Desktop/Dev-Zone/Kavya/Strawlabs/meenakshi/hooks/useVoiceSession.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Add refs
content = content.replace(
  '  const audioQueueRef = useRef<string[]>([]); // Array of WAV base64 strings\n  const isQueuePlayingRef = useRef(false);',
  `  const audioQueueRef = useRef<string[]>([]); // Array of WAV base64 strings awaiting write to disk
  const preloadedQueueRef = useRef<{ uri: string; durationMs: number }[]>([]); // Array of preloaded files ready for instant playback
  const isPreloadingRef = useRef(false);
  const isQueuePlayingRef = useRef(false);`
);

// 2. update cleanupNative
content = content.replace(
  '    audioQueueRef.current = [];\n    if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current);',
  `    audioQueueRef.current = [];
    preloadedQueueRef.current.forEach(item => {
      FileSystem?.deleteAsync(item.uri, { idempotent: true }).catch(() => {});
    });
    preloadedQueueRef.current = [];
    if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current);`
);

// 3. update interrupted handler
content = content.replace(
  '              if (nativePlayerRef.current) {\n                try { nativePlayerRef.current.pause(); } catch (_) {}\n              }\n              audioQueueRef.current = [];',
  `              if (nativePlayerRef.current) {
                try { nativePlayerRef.current.pause(); } catch (_) {}
              }
              audioQueueRef.current = [];
              preloadedQueueRef.current.forEach(item => {
                FileSystem?.deleteAsync(item.uri, { idempotent: true }).catch(() => {});
              });
              preloadedQueueRef.current = [];`
);

// 4. Update playNextFromQueue
const newPlayNext = `  const playNextFromQueue = useCallback(async () => {
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
      const player = (expoAudio as any).createAudioPlayer({ uri });
      nativePlayerRef.current = player;

      let isDone = false;

      const finishChunk = () => {
        if (isDone) return;
        isDone = true;
        FileSystem!.deleteAsync(uri, { idempotent: true }).catch(() => {});
        if (nativePlayerRef.current === player) nativePlayerRef.current = null;

        setTimeout(() => {
          try { player.remove(); } catch (_) {}
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

      // Safety-net fallback
      setTimeout(finishChunk, durationMs + PLAYER_REMOVAL_PADDING_MS);

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
        const uri = FileSystem.cacheDirectory + \`gemini_\${Date.now()}_\${Math.random().toString(36).slice(2, 7)}.wav\`;
        
        await FileSystem.writeAsStringAsync(uri, wavBase64, {
          encoding: (FileSystem as any).EncodingType.Base64,
        });

        const wavBytes = decode(wavBase64);
        const audioDataBytes = Math.max(0, wavBytes.length - 44);
        const durationMs = (audioDataBytes / (24000 * 2)) * 1000;
        
        // Fire and forget preload — expo-audio will cache the AVPlayer/bytes
        if ((expoAudio as any).preload) {
          (expoAudio as any).preload(uri).catch(() => {});
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
  }, [playNextFromQueue]);`;

// Regex replacement for playNextFromQueue
const oldPlayNextRegex = /  const playNextFromQueue = useCallback\(async \(\) => \{[\s\S]*?  \}, \[\]\);/;
content = content.replace(oldPlayNextRegex, newPlayNext);

// 5. Update flushPcmBuffer to call processPreloadPipeline
content = content.replace(
  /      audioQueueRef\.current\.push\(wavBase64\);\n      if \(\!isQueuePlayingRef\.current\) \{\n        playNextFromQueue\(\);\n      \}/,
  `      audioQueueRef.current.push(wavBase64);
      processPreloadPipeline();`
);

// also fix dependency array of flushPcmBuffer
content = content.replace(
  '  }, [playNextFromQueue]);',
  '  }, [processPreloadPipeline]);'
);

fs.writeFileSync(file, content);
console.log('Update script completed.');
