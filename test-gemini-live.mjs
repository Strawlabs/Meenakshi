import WebSocket from 'ws';
import dotenv from 'dotenv';
dotenv.config();
const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) { console.error("No API key"); process.exit(1); }

const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;
const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('Opened');
  ws.send(JSON.stringify({
    setup: {
      model: 'models/gemini-2.0-flash-exp', // Or try gemini-3.1-flash-live-preview if valid? Wait, 2.0-flash-exp is the current known one.
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } },
      },
      systemInstruction: { parts: [{ text: 'You are a helpful assistant.' }] },
    }
  }));
});

ws.on('message', (data) => {
  console.log('RAW Message:', data.toString());
});

ws.on('close', (code, reason) => {
  console.log(`Closed: code=${code}, reason=${reason}`);
});

ws.on('error', (err) => {
  console.error('Error:', err);
});
