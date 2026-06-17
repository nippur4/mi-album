// Mi Álbum de Figuritas — Edge Function: canjear QR de sobres
//
// Responsabilidad: parsear el token del QR, validar su firma HMAC con el
// qr_secret del álbum, y delegar la persistencia a fn_apply_qr_redeem
// (migración 0005).
//
// Contrato:
//   POST  body: { token: string }
//   200   { packs, next_available_at, joined, welcome_packs, album_id }
//   4xx   { error: string }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { decodeQrToken } from '../_shared/qr.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }
  if (req.method !== 'POST') {
    return jsonError('method_not_allowed', 405);
  }

  let token: string | undefined;
  try {
    const body = await req.json();
    token = body?.token;
  } catch {
    return jsonError('invalid_body', 400);
  }
  if (!token || typeof token !== 'string') {
    return jsonError('token_required', 400);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonError('auth_required', 401);
  }

  // Parsear el album_id del token sin validar firma todavía (necesitamos saber
  // qué álbum es para buscar su qr_secret). Después validamos.
  const albumIdGuess = peekAlbumId(token);
  if (!albumIdGuess) {
    return jsonError('invalid_token', 400);
  }

  // Service-role para leer qr_secret (no expuesto vía RLS).
  const adminSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: album, error: albErr } = await adminSupabase
    .from('albums')
    .select('id, status, qr_secret')
    .eq('id', albumIdGuess)
    .maybeSingle();

  if (albErr) return jsonError(albErr.message, 500);
  if (!album) return jsonError('album_not_found', 404);
  if (!album.qr_secret) return jsonError('qr_not_configured', 422);
  if (album.status !== 'published') {
    return jsonError(`album_not_available_${album.status}`, 403);
  }

  // Validar firma HMAC.
  const payload = await decodeQrToken(token, album.qr_secret);
  if (!payload) return jsonError('invalid_signature', 401);
  if (payload.album_id !== album.id) return jsonError('token_album_mismatch', 400);

  // Aplicar con el JWT del caller para que auth.uid() funcione en el RPC.
  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: result, error: rpcErr } = await userSupabase.rpc(
    'fn_apply_qr_redeem',
    {
      p_album_id: payload.album_id,
      p_nonce: payload.nonce,
      p_issued_at: payload.issued_at,
    },
  );

  if (rpcErr) {
    const status = rpcErr.code === 'P0097' ? 429
      : rpcErr.code === 'P0095' ? 403
      : rpcErr.code === 'P0096' ? 422
      : rpcErr.code === 'P0082' ? 403
      : rpcErr.code === 'P0002' ? 404
      : 500;
    return jsonError(rpcErr.message, status);
  }

  return jsonOk({ ...result, album_id: payload.album_id });
});

// ---------------------------------------------------------------------------

// Intenta extraer album_id sin validar firma. Si el formato está mal, null.
// La validación real (HMAC) ocurre después.
function peekAlbumId(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const payloadStr = atob(
      parts[0].replaceAll('-', '+').replaceAll('_', '/')
        + '='.repeat((4 - (parts[0].length % 4)) % 4),
    );
    const obj = JSON.parse(payloadStr);
    return typeof obj?.album_id === 'string' ? obj.album_id : null;
  } catch {
    return null;
  }
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
