const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();

function stripHexPrefix(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = stripHexPrefix(hex).toLowerCase();
  if (clean.length % 2 !== 0) {
    throw new Error('Hex value must have an even length');
  }

  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(buffer: ArrayBuffer | Uint8Array): string {
  const view = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(view)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveAesKey(address: string): Promise<CryptoKey> {
  const addressBytes = hexToBytes(address);
  const hashBuffer = await crypto.subtle.digest('SHA-256', addressBytes);
  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptLocationText(location: string, address: string): Promise<string> {
  const key = await deriveAesKey(address);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = TEXT_ENCODER.encode(location);
  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return `${bytesToHex(iv)}:${bytesToHex(cipherBuffer)}`;
}

export async function decryptLocationText(payload: string, address: string): Promise<string> {
  const [ivHex, cipherHex] = payload.split(':');
  if (!ivHex || !cipherHex) {
    throw new Error('Invalid encrypted payload');
  }

  const key = await deriveAesKey(address);
  const iv = hexToBytes(ivHex);
  const ciphertext = hexToBytes(cipherHex);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return TEXT_DECODER.decode(plainBuffer);
}
