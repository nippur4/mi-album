// Helpers compartidos para tokens de QR de sobres.
//
// Formato del token (string codificado en el QR):
//   <base64url(payload_json)>.<base64url(hmac_sha256(payload_json, qr_secret))>
//
// Lo usan dos Edge Functions:
//   - generate_qr (futuro): el owner genera el QR fijo de su álbum.
//   - redeem_qr: el user lo escanea y la function lo valida.

export interface QrPayload {
  album_id: string;
  nonce: string;
  issued_at: string; // ISO timestamp
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s + pad).replaceAll('-', '+').replaceAll('_', '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function encodeQrToken(
  payload: QrPayload,
  secret: string,
): Promise<string> {
  const payloadBytes = enc.encode(JSON.stringify(payload));
  const key = await importHmacKey(secret);
  const sigBytes = new Uint8Array(await crypto.subtle.sign('HMAC', key, payloadBytes));
  return `${base64UrlEncode(payloadBytes)}.${base64UrlEncode(sigBytes)}`;
}

// Devuelve el payload validado, o null si el formato/firma son inválidos.
// El caller es responsable de validar campos del payload (album_id, nonce, etc.)
// y de chequear políticas de uso (cooldown, etc.).
export async function decodeQrToken(
  token: string,
  secret: string,
): Promise<QrPayload | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  let payloadBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    payloadBytes = base64UrlDecode(parts[0]);
    sigBytes = base64UrlDecode(parts[1]);
  } catch {
    return null;
  }

  const key = await importHmacKey(secret);
  const ok = await crypto.subtle.verify('HMAC', key, sigBytes, payloadBytes);
  if (!ok) return null;

  try {
    const obj = JSON.parse(dec.decode(payloadBytes));
    if (
      typeof obj?.album_id === 'string' &&
      typeof obj?.nonce === 'string' &&
      typeof obj?.issued_at === 'string'
    ) {
      return obj as QrPayload;
    }
    return null;
  } catch {
    return null;
  }
}
