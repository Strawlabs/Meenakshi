const fs = require('fs');
const file = '/Users/kavya/Desktop/Dev-Zone/Kavya/Strawlabs/meenakshi/hooks/useVoiceSession.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Wherever audioStreamEnd is sent
content = content.replace(
  /console.log\('\[useVoiceSession\] Sending audioStreamEnd/g,
  "console.log('[useVoiceSession] audioStreamEnd sent, waiting for final turnComplete before any close');\n            console.log('[useVoiceSession] Sending audioStreamEnd"
);

// 2. In the turnComplete handler
content = content.replace(
  /          \/\/ ── Turn complete — save to memory ──\n          if \(message\.serverContent\?\.turnComplete\) \{/g,
  `          // ── Turn complete — save to memory ──
          if (message.serverContent?.turnComplete) {
            console.log('[useVoiceSession] Received turnComplete from server. Chunks in queue:', audioQueueRef.current.length, 'pcmBuffer bytes:', pcmBufferTotalLengthRef.current);`
);

// 3. Wherever ws.close() or close() on wsRef is called
// Need to find wsRef.current.close() or ws.close()
content = content.replace(
  /wsRef\.current\.close\(/g,
  `console.trace('[useVoiceSession] ws.close() called from:'); wsRef.current.close(`
);
content = content.replace(
  /ws\.close\(/g,
  `console.trace('[useVoiceSession] ws.close() called from:'); ws.close(`
);

fs.writeFileSync(file, content);
console.log('Added logs');
