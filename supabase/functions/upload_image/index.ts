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
import { CORS, getCallerId, jsonError, jsonOk, userClient } from '../_shared/http.ts';
import { base64ToBytes, MAX_BYTES_PER_FILE, putToR2 } from '../_shared/r2.ts';

type Kind = 'cover' | 'pack' | 'sticker';

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
  const userSupabase = userClient(authHeader);

  const callerId = await getCallerId(userSupabase);
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
