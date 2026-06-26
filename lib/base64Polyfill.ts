const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function atob(input: string): string {
  const str = input.replace(/=+$/, '');
  let output = '';
  if (str.length % 4 === 1) {
    throw new Error("'atob' failed: The string to be decoded is not correctly encoded.");
  }
  for (
    let bc = 0, bs = 0, buffer, idx = 0;
    (buffer = str.charAt(idx++));
    ~buffer && ((bs = bc % 4 ? bs * 64 + buffer : buffer),
      bc++ % 4)
      ? (output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6))))
      : 0
  ) {
    buffer = chars.indexOf(buffer);
  }
  return output;
}

export function btoa(input: string): string {
  let output = '';
  for (
    let block = 0, charCode, idx = 0, map = chars;
    input.charAt(idx | 0) || ((map = '='), idx % 1);
    output += map.charAt(63 & (block >> (8 - (idx % 1) * 8)))
  ) {
    charCode = input.charCodeAt((idx += 3 / 4));
    if (charCode > 255) {
      throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
    }
    block = (block << 8) | charCode;
  }
  return output;
}

// Apply globally if not already present (e.g. in React Native Hermes engine)
if (typeof (global as any).atob === 'undefined') {
  (global as any).atob = atob;
}

if (typeof (global as any).btoa === 'undefined') {
  (global as any).btoa = btoa;
}
