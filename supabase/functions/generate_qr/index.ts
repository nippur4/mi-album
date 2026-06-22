// Mi Álbum de Figuritas — Edge Function: generar token QR del álbum.
//
// Solo el owner puede pedirlo. Lee qr_secret server-side (el cliente no tiene
// acceso por column-level revoke), firma el payload con HMAC y devuelve el
// token listo para meter en el QR. El user que lo escanea pasa por
// redeem_qr → fn_apply_qr_redeem (HMAC verify + grant packs).
//
// Contrato:
//   POST  body: { album_id: string }
//   200   { token: string }
//   4xx   { error: string }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { encodeQrToken } from '../_shared/qr.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return jsonError('method_not_allowed', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonError('auth_required', 401);

  let albumId: string | undefined;
  try {
    const body = await req.json();
    albumId = body?.album_id;
  } catch {
    return jsonError('invalid_body', 400);
  }
  if (!albumId || typeof albumId !== 'string') {
    return jsonError('album_id_required', 400);
  }

  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userResult } = await userSupabase.auth.getUser();
  const callerId = userResult?.user?.id;
  if (!callerId) return jsonError('auth_required', 401);

  // Service role para leer qr_secret (revoke select(qr_secret) to authenticated)
  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: album, error: albErr } = await adminSupabase
    .from('albums')
    .select('id, owner_id, status, pack_config, qr_secret')
    .eq('id', albumId)
    .maybeSingle();

  if (albErr) return jsonError(albErr.message, 500);
  if (!album) return jsonError('album_not_found', 404);
  if (album.owner_id !== callerId) return jsonError('not_album_owner', 403);
  if (album.status !== 'published') {
    return jsonError(`album_not_available_${album.status}`, 403);
  }

  const qrEnabled = (album.pack_config as any)?.qr?.enabled === true;
  if (!qrEnabled) return jsonError('qr_not_enabled', 422);
  if (!album.qr_secret) return jsonError('qr_not_configured', 422);

  const nonce = crypto.randomUUID();
  const token = await encodeQrToken(
    { album_id: albumId, nonce, issued_at: new Date().toISOString() },
    album.qr_secret,
  );

  return jsonOk({ token });
});

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
