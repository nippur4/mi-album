// Mi Álbum de Figuritas — Edge Function: upload de imágenes a R2
//
// Genera 2 tamaños WebP de la imagen original (sharp) y los sube a Cloudflare
// R2 con el SDK de S3. Devuelve las object keys (paths dentro del bucket) para
// que el cliente las pase al RPC correspondiente (fn_add_sticker /
// fn_update_album_content). La URL pública se arma en el cliente concatenando
// EXPO_PUBLIC_R2_PUBLIC_BASE_URL + key, así si en el futuro migramos de r2.dev
// a un dominio custom no hace falta UPDATE masivo de la DB.
//
// Contrato:
//   POST  multipart/form-data:
//     - file: imagen original (jpeg/png/webp/heic, ≤ 10 MB)
//     - album_id: uuid
//     - kind: 'cover' | 'pack' | 'sticker'
//   200   { thumb_key, large_key }
//   4xx   { error: string }
//
// Reglas:
//   - El caller debe ser owner del álbum.
//   - El álbum debe estar en status='draft' (covers/packs/stickers son contenido
//     y por regla son inmutables post-publish).
//
// Env vars requeridas:
//   - R2_ACCOUNT_ID
//   - R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY
//   - R2_BUCKET_NAME
//   - R2_PUBLIC_BASE_URL   (ej: https://cdn.tuapp.com)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import sharp from 'npm:sharp@0.33.5';
import { S3Client, PutObjectCommand } from 'npm:@aws-sdk/client-s3@3.658.0';

type Kind = 'cover' | 'pack' | 'sticker';

const SIZES: Record<Kind, { thumb: number; large: number }> = {
  cover:   { thumb: 400, large: 1200 },
  pack:    { thumb: 400, large: 1200 },
  sticker: { thumb: 300, large: 1000 },
};

const MAX_BYTES = 10 * 1024 * 1024;
const WEBP_QUALITY = 85;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${Deno.env.get('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID')!,
    secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY')!,
  },
});
const R2_BUCKET = Deno.env.get('R2_BUCKET_NAME')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return jsonError('method_not_allowed', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('auth_required', 401);

  // 1. Parsear multipart
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError('invalid_multipart', 400);
  }

  const file = form.get('file');
  const albumId = form.get('album_id');
  const kindRaw = form.get('kind');

  if (!(file instanceof File)) return jsonError('file_required', 400);
  if (typeof albumId !== 'string') return jsonError('album_id_required', 400);
  if (kindRaw !== 'cover' && kindRaw !== 'pack' && kindRaw !== 'sticker') {
    return jsonError('invalid_kind', 400);
  }
  const kind = kindRaw as Kind;

  if (file.size > MAX_BYTES) return jsonError('file_too_large', 413);

  // 2. Validar caller + álbum vía cliente con JWT del usuario
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

  // 3. Procesar con sharp
  const input = new Uint8Array(await file.arrayBuffer());
  const sizes = SIZES[kind];

  let thumbBuf: Uint8Array;
  let largeBuf: Uint8Array;
  try {
    [thumbBuf, largeBuf] = await Promise.all([
      sharp(input)
        .rotate() // respeta EXIF orientation
        .resize({ width: sizes.thumb, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer(),
      sharp(input)
        .rotate()
        .resize({ width: sizes.large, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer(),
    ]);
  } catch (err) {
    return jsonError(`image_decode_failed:${(err as Error).message}`, 422);
  }

  // 4. Subir a R2
  const id = crypto.randomUUID();
  const thumbKey = `albums/${album.id}/${kind}/${id}-thumb.webp`;
  const largeKey = `albums/${album.id}/${kind}/${id}-large.webp`;

  try {
    await Promise.all([
      r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: thumbKey,
        Body: thumbBuf,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      })),
      r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: largeKey,
        Body: largeBuf,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000, immutable',
      })),
    ]);
  } catch (err) {
    return jsonError(`r2_upload_failed:${(err as Error).message}`, 502);
  }

  return jsonOk({
    thumb_key: thumbKey,
    large_key: largeKey,
  });
});

// ---------------------------------------------------------------------------

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
