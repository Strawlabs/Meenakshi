const fs = require('fs');
const file = '/Users/kavya/Desktop/Dev-Zone/Kavya/Strawlabs/meenakshi/hooks/useVoiceSession.ts';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix imports
content = content.replace(
  "import { MEENAKSHI_SYSTEM_PROMPT } from '../constants';\nimport { buildMemoryContext, saveSession, MemoryMessage } from '../services/memoryService';\nimport { getLatestSnapshot } from '../services/financialHealthService';\nimport { getAllContacts } from '../services/relationshipService';\nimport { getFollowUps } from '../services/followUpService';\nimport supabase from '../lib/supabase';",
  "import { saveSession, MemoryMessage } from '../services/memoryService';\nimport { buildSystemPrompt } from '../services/systemPromptService';"
);

// 2. Remove the old buildSystemPrompt function completely
const startStr = "  // ── Helpers ──";
const endStr = "  const startSession = useCallback(async () => {";
const p1 = content.indexOf(startStr);
const p2 = content.indexOf(endStr);
if (p1 !== -1 && p2 !== -1) {
  content = content.substring(0, p1) + "  // ── Helpers ──\n\n" + content.substring(p2);
}

// 3. Add turnTimingRef
content = content.replace(
  '  const turnCompletePendingRef = useRef(false);',
  `  const turnCompletePendingRef = useRef(false);
  const turnTimingRef = useRef<{ userSpeechEndTs: number | null; firstAudioByteTs: number | null }>({
    userSpeechEndTs: null,
    firstAudioByteTs: null,
  });`
);

// 4. Update audioStreamEnd logic
content = content.replace(
  '          if (message.serverContent?.audioStreamEnd) {',
  `          if (message.serverContent?.audioStreamEnd || message.serverContent?.activityEnd) {
            turnTimingRef.current.userSpeechEndTs = Date.now();
            turnTimingRef.current.firstAudioByteTs = null;`
);

// 5. Update audioData logic
content = content.replace(
  "          // ── Audio data from Gemini ──\n          const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;\n          if (audioData) {",
  `          // ── Audio data from Gemini ──
          const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audioData) {
            if (turnTimingRef.current.userSpeechEndTs && !turnTimingRef.current.firstAudioByteTs) {
              turnTimingRef.current.firstAudioByteTs = Date.now();
              const latencyMs = turnTimingRef.current.firstAudioByteTs - turnTimingRef.current.userSpeechEndTs;
              console.log(\`[LATENCY] Time-to-first-audio-byte: \${latencyMs}ms\`);
            }`
);

fs.writeFileSync(file, content);
console.log('Fixed useVoiceSession');
