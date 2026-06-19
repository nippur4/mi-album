// Wrapper sobre la Edge Function upload_image.
//
// El cliente hace TODO el procesamiento de imagen (resize + JPEG + compress)
// con expo-image-manipulator y envía los dos tamaños ya listos como base64.
// La Edge Function pasa a ser un proxy R2 trivial (sin sharp/imagescript/wasm).
//
// Esto evita libs nativas en el runtime de Edge Functions, que era frágil.

import * as ImageManipulator from 'expo-image-manipulator';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export type ImageKind = 'cover' | 'pack' | 'sticker';

export interface UploadedKeys {
  thumb_key: string;
  large_key: string;
}

export interface UploadAsset {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}

// Tamaños target por tipo de imagen. El cliente resizea + comprime.
const SIZES: Record<ImageKind, { thumb: number; large: number }> = {
  cover:   { thumb: 400, large: 1200 },
  pack:    { thumb: 400, large: 1200 },
  sticker: { thumb: 300, large: 1000 },
};
const JPEG_QUALITY = 0.85;

async function resizeToBase64(uri: string, width: number): Promise<string> {
  const t0 = Date.now();
  console.log(`[upload] resize ${width}px start`);
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width } }],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );
  console.log(
    `[upload] resize ${width}px done in ${Date.now() - t0}ms; b64len=${result.base64?.length ?? 0}`,
  );
  if (!result.base64) throw { error: 'manipulator_no_base64' };
  return result.base64;
}

export async function uploadImage(
  albumId: string,
  kind: ImageKind,
  asset: UploadAsset,
): Promise<UploadedKeys> {
  console.log(`[upload] start kind=${kind} albumId=${albumId} uri=${asset.uri.slice(0, 60)}`);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw { error: 'auth_required' };

  // Resize + comprimir a JPEG en cliente, para 2 tamaños en paralelo.
  const sizes = SIZES[kind];
  let thumb_base64: string;
  let large_base64: string;
  try {
    [thumb_base64, large_base64] = await Promise.all([
      resizeToBase64(asset.uri, sizes.thumb),
      resizeToBase64(asset.uri, sizes.large),
    ]);
  } catch (err: any) {
    console.error('[upload] resize threw', err);
    throw { error: `image_resize_failed: ${err?.message ?? String(err)}` };
  }

  console.log(
    `[upload] posting to edge: thumb=${thumb_base64.length}B, large=${large_base64.length}B`,
  );

  // Timeout para no quedar esperando infinito si la Edge Function se cuelga.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  let res: Response;
  try {
    res = await fetch(`${env.supabaseUrl}/functions/v1/upload_image`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: env.supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        album_id: albumId,
        kind,
        thumb_base64,
        large_base64,
      }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === 'AbortError') {
      throw { error: 'upload_timeout_60s (server never responded)' };
    }
    throw { error: `fetch_failed: ${err?.message ?? String(err)}` };
  }
  clearTimeout(timeout);

  const text = await res.text();
  console.log(`[upload] edge responded status=${res.status} bodyLen=${text.length}`);
  let body: any = {};
  try { body = JSON.parse(text); } catch {}

  if (!res.ok) {
    console.warn('[upload] edge error body:', text);
    throw { error: body.error ?? `upload_failed_${res.status}: ${text.slice(0, 200)}` };
  }
  return body as UploadedKeys;
}
