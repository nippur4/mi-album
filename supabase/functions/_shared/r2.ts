// Mi Álbum de Figuritas — helpers R2 compartidos (upload_image, upload_preset_image).
//
// aws4fetch: wrapper de fetch que firma con AWS Signature V4. Liviano y
// estable en runtimes Deno/edge, a diferencia del SDK npm que tiene
// problemas de cold start y reintentos colgados.

import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

export const MAX_BYTES_PER_FILE = 10 * 1024 * 1024;

const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!;
const R2_BUCKET = Deno.env.get('R2_BUCKET_NAME')!;
const r2 = new AwsClient({
  accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
  secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
  service: 's3',
  region: 'auto',
});

export async function putToR2(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const url = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
  const res = await r2.fetch(url, {
    method: 'PUT',
    body,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`r2_put_failed_${res.status}: ${text.slice(0, 200)}`);
  }
}

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
