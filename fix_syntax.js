const fs = require('fs');
const file = '/Users/kavya/Desktop/Dev-Zone/Kavya/Strawlabs/meenakshi/hooks/useVoiceSession.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /console\.trace\('\[useVoiceSession\] console\.trace\('\[useVoiceSession\] ws\.close\(\) called from:'\); ws\.close\(\) called from:'\);/g,
  "console.trace('[useVoiceSession] ws.close() called from:');"
);

fs.writeFileSync(file, content);
console.log('Fixed syntax');
