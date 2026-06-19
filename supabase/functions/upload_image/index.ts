// Mi Álbum de Figuritas — Edge Function: proxy de upload a R2
//
// El procesamiento de imagen (resize + compress + format) lo hace el cliente
// con expo-image-manipulator. Esta función solo recibe los 2 tamaños ya
// listos como base64, valida ownership y los sube a R2.
//
// Contrato:
//   POST  application/json:
//     - album_id: uuid
//     - kind: 'cover' | 'pack' | 'sticker'
//     - thumb_base64: string  (JPEG ya redimensionado)
//     - large_base64: string  (JPEG ya redimensionado)
//   200   { thumb_key, large_key }
//   4xx   { error: string }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

type Kind = 'cover' | 'pack' | 'sticker';

const MAX_BYTES_PER_FILE = 10 * 1024 * 1024;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// aws4fetch: wrapper de fetch que firma con AWS Signature V4. Liviano y
// estable en runtimes Deno/edge, a diferencia del SDK npm que tiene
// problemas de cold start y reintentos colgados.
const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')!;
const R2_BUCKET = Deno.env.get('R2_BUCKET_NAME')!;
const r2 = new AwsClient({
  accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
  secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
  service: 's3',
  region: 'auto',
});

async function putToR2(key: string, body: Uint8Array, contentType: string): Promise<void> {
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

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return jsonError('method_not_allowed', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('auth_required', 401);

  let payload: {
    album_id?: unknown;
    kind?: unknown;
    thumb_base64?: unknown;
    large_base64?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return jsonError('invalid_json', 400);
  }

  const albumId = payload.album_id;
  const kindRaw = payload.kind;
  const thumbB64 = payload.thumb_base64;
  const largeB64 = payload.large_base64;

  if (typeof albumId !== 'string') return jsonError('album_id_required', 400);
  if (kindRaw !== 'cover' && kindRaw !== 'pack' && kindRaw !== 'sticker') {
    return jsonError('invalid_kind', 400);
  }
  if (typeof thumbB64 !== 'string' || thumbB64.length === 0) {
    return jsonError('thumb_required', 400);
  }
  if (typeof largeB64 !== 'string' || largeB64.length === 0) {
    return jsonError('large_required', 400);
  }
  const kind = kindRaw as Kind;

  // Validar caller + álbum vía cliente con JWT del usuario
  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userResult } = await userSupabase.auth.getUser();
  const callerId = userResult?.user?.id;
  if (!callerId) return jsonError('auth_required', 401);

  const { data: album, error: albErr } = await userSupabase
    .from('albums')
    .select('id, owner_id, status')
    .eq('id', albumId)
    .maybeSingle();

  if (albErr) return jsonError(albErr.message, 500);
  if (!album) return jsonError('album_not_found', 404);
  if (album.owner_id !== callerId) return jsonError('not_album_owner', 403);
  if (album.status !== 'draft') return jsonError('album_not_draft', 403);

  // Decodear los dos tamaños
  let thumbBytes: Uint8Array;
  let largeBytes: Uint8Array;
  try {
    thumbBytes = base64ToBytes(thumbB64);
    largeBytes = base64ToBytes(largeB64);
  } catch {
    return jsonError('invalid_base64', 400);
  }
  if (thumbBytes.byteLength > MAX_BYTES_PER_FILE || largeBytes.byteLength > MAX_BYTES_PER_FILE) {
    return jsonError('file_too_large', 413);
  }

  // Subir a R2
  const id = crypto.randomUUID();
  const thumbKey = `albums/${album.id}/${kind}/${id}-thumb.jpg`;
  const largeKey = `albums/${album.id}/${kind}/${id}-large.jpg`;

  try {
    await Promise.all([
      putToR2(thumbKey, thumbBytes, 'image/jpeg'),
      putToR2(largeKey, largeBytes, 'image/jpeg'),
    ]);
  } catch (err) {
    return jsonError(`r2_upload_failed:${(err as Error).message}`, 502);
  }

  return jsonOk({ thumb_key: thumbKey, large_key: largeKey });
});

// ---------------------------------------------------------------------------

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function jsonOk(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function jsonError(code: string, status: number) {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
