// Mi Álbum de Figuritas — Edge Function: subir preset de admin a R2
//
// Análogo a upload_image pero para imágenes que el admin sube como plantilla
// global (carátula / sobre). El cliente resizea local con expo-image-manipulator
// y manda los dos tamaños en base64. Esta función:
//   - valida que el caller sea is_admin
//   - genera un UUID para el preset
//   - sube ambos archivos a R2 bajo presets/<uuid>/
//   - devuelve { preset_id, thumb_key, large_key }
//
// El cliente después llama fn_admin_create_preset() con esas keys para
// persistir la fila en preset_images.
//
// Contrato:
//   POST  application/json:
//     - kind: 'cover' | 'pack'
//     - thumb_base64: string (JPEG ya redimensionado)
//     - large_base64: string (JPEG ya redimensionado)
//   200   { preset_id, thumb_key, large_key }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { CORS, getCallerId, jsonError, jsonOk, userClient } from '../_shared/http.ts';
import { base64ToBytes, MAX_BYTES_PER_FILE, putToR2 } from '../_shared/r2.ts';

type Kind = 'cover' | 'pack' | 'avatar';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return jsonError('method_not_allowed', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('auth_required', 401);

  let payload: { kind?: unknown; thumb_base64?: unknown; large_base64?: unknown };
  try {
    payload = await req.json();
  } catch {
    return jsonError('invalid_json', 400);
  }

  const kindRaw = payload.kind;
  const thumbB64 = payload.thumb_base64;
  const largeB64 = payload.large_base64;

  if (kindRaw !== 'cover' && kindRaw !== 'pack' && kindRaw !== 'avatar') {
    return jsonError('invalid_kind', 400);
  }
  if (typeof thumbB64 !== 'string' || thumbB64.length === 0) return jsonError('thumb_required', 400);
  if (typeof largeB64 !== 'string' || largeB64.length === 0) return jsonError('large_required', 400);
  const kind = kindRaw as Kind;

  const userSupabase = userClient(authHeader);

  const callerId = await getCallerId(userSupabase);
  if (!callerId) return jsonError('auth_required', 401);

  const { data: prof, error: profErr } = await userSupabase
    .from('profiles')
    .select('is_admin')
    .eq('id', callerId)
    .maybeSingle();

  if (profErr) return jsonError(profErr.message, 500);
  if (!prof?.is_admin) return jsonError('admin_required', 403);

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

  const presetId = crypto.randomUUID();
  const thumbKey = `presets/${presetId}/${kind}-thumb.jpg`;
  const largeKey = `presets/${presetId}/${kind}-large.jpg`;

  try {
    await Promise.all([
      putToR2(thumbKey, thumbBytes, 'image/jpeg'),
      putToR2(largeKey, largeBytes, 'image/jpeg'),
    ]);
  } catch (err) {
    return jsonError(`r2_upload_failed:${(err as Error).message}`, 502);
  }

  return jsonOk({ preset_id: presetId, thumb_key: thumbKey, large_key: largeKey });
});
