const fs = require('fs');
const file = '/Users/kavya/Desktop/Dev-Zone/Kavya/Strawlabs/meenakshi/hooks/useVoiceSession.ts';
let content = fs.readFileSync(file, 'utf8');

// Fix processPreloadPipeline deps
content = content.replace(
  '  }, [processPreloadPipeline]);\n\n  // ── Native: enqueue PCM from Gemini for playback ──────────────────────────',
  '  }, [playNextFromQueue]);\n\n  // ── Native: enqueue PCM from Gemini for playback ──────────────────────────'
);

// Fix flushPcmBuffer deps
content = content.replace(
  '      console.error(\'[useVoiceSession] flushPcmBuffer error:\', err);\n    }\n  }, [playNextFromQueue]);\n\n  const playNativeAudioChunk = useCallback',
  '      console.error(\'[useVoiceSession] flushPcmBuffer error:\', err);\n    }\n  }, [processPreloadPipeline]);\n\n  const playNativeAudioChunk = useCallback'
);

fs.writeFileSync(file, content);
console.log('Fixed deps');
