/**
 * Audio utilities for Gemini Live API integration.
 *
 * - encode/decode: Base64 ↔ Uint8Array
 * - decodeAudioData: PCM Int16 → AudioBuffer (Web playback)
 * - pcmToWav: Raw PCM base64 → WAV base64 (Native playback)
 */

// ─── Base64 ──────────────────────────────────────────────────────────────────

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const lookup = new Uint8Array(256);
for (let i = 0; i < chars.length; i++) {
  lookup[chars.charCodeAt(i)] = i;
}

export function decode(base64: string): Uint8Array {
  let bufferLength = base64.length * 0.75;
  let len = base64.length;
  let i = 0;
  let p = 0;
  let encoded1, encoded2, encoded3, encoded4;

  if (base64[base64.length - 1] === '=') {
    bufferLength--;
    if (base64[base64.length - 2] === '=') {
      bufferLength--;
    }
  }

  const bytes = new Uint8Array(bufferLength);

  for (i = 0; i < len; i += 4) {
    encoded1 = lookup[base64.charCodeAt(i)];
    encoded2 = lookup[base64.charCodeAt(i + 1)];
    encoded3 = lookup[base64.charCodeAt(i + 2)];
    encoded4 = lookup[base64.charCodeAt(i + 3)];

    bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
    bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
  }

  return bytes;
}

export function encode(bytes: Uint8Array): string {
  let base64 = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 3) {
    base64 += chars[bytes[i] >> 2];
    base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
    base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
    base64 += chars[bytes[i + 2] & 63];
  }

  if (len % 3 === 2) {
    base64 = base64.substring(0, base64.length - 1) + '=';
  } else if (len % 3 === 1) {
    base64 = base64.substring(0, base64.length - 2) + '==';
  }

  return base64;
}

// ─── Web: PCM → AudioBuffer ─────────────────────────────────────────────────

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// ─── Native: PCM → WAV ──────────────────────────────────────────────────────

/**
 * Write an ASCII string into a DataView at a given offset.
 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Create a 44-byte WAV file header for raw PCM data.
 *
 * Gemini Live API sends 24 kHz, mono, 16-bit little-endian PCM.
 * Native audio players (expo-audio AudioPlayer) need a valid WAV
 * container to decode the audio.
 */
export function createWavHeader(
  pcmByteLength: number,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitsPerSample: number = 16,
): ArrayBuffer {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmByteLength, true);
  writeString(view, 8, 'WAVE');

  // "fmt " sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);          // sub-chunk size (16 for PCM)
  view.setUint16(20, 1, true);           // audio format (1 = PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // "data" sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, pcmByteLength, true);

  return buffer;
}

/**
 * Wrap raw PCM base64 with a WAV header.
 * Returns a complete, playable WAV file as base64.
 *
 * @param pcmBase64    Raw PCM audio from Gemini (base64-encoded)
 * @param sampleRate   Default 24000 (Gemini Live output rate)
 * @param numChannels  Default 1 (mono)
 * @param bitsPerSample Default 16
 */
export function pcmToWav(
  pcmBase64: string,
  sampleRate: number = 24000,
  numChannels: number = 1,
  bitsPerSample: number = 16,
): string {
  const pcmBytes = decode(pcmBase64);
  const wavHeader = createWavHeader(pcmBytes.length, sampleRate, numChannels, bitsPerSample);

  // Combine: 44-byte header + PCM payload
  const wavBytes = new Uint8Array(wavHeader.byteLength + pcmBytes.length);
  wavBytes.set(new Uint8Array(wavHeader), 0);
  wavBytes.set(pcmBytes, wavHeader.byteLength);

  return encode(wavBytes);
}

/**
 * Concatenate multiple base64 PCM chunks into a single base64 PCM chunk.
 * This is used to buffer tiny chunks into larger blocks for smoother playback.
 */
export function concatPCMBase64(chunks: string[]): string {
  if (chunks.length === 0) return '';
  if (chunks.length === 1) return chunks[0];

  const decodedChunks = chunks.map(chunk => decode(chunk));
  const totalLength = decodedChunks.reduce((acc, curr) => acc + curr.byteLength, 0);
  const combined = new Uint8Array(totalLength);

  let offset = 0;
  for (const chunk of decodedChunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return encode(combined);
}
