// Mi Álbum de Figuritas — Edge Function: abrir sobre
//
// Responsabilidad: sortear los stickers de un sobre y delegar la persistencia
// a la RPC fn_apply_pack_open (migración 0004). La lógica de aleatoriedad
// vive acá para que sea fácil versionarla.
//
// Contrato:
//   POST  body: { pack_id: string }
//   200   { stickers: [{ sticker_id, number, name, rarity, large_key, was_new }] }
//   4xx   { error: string }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

// Modelo "caja de figuritas": cada figurita entra a la caja con N copias según
// su rareza. Sortear un pick = agarrar una copia al azar de la caja.
// Con estos pesos, en un álbum bien poblado (proporcional a los ratios), el
// pack se siente:
//   ~80% comunes, ~14% raras, ~4% épicas, ~0.7% legendarias.
// Cada legendaria específica es rara pero conseguible (~2 meses con daily
// para un álbum realista de 100 figuritas con 2 legendarias).
//
// Si el owner desbalancea el álbum (ej. muchas comunes vs pocas legendarias),
// el resultado degrada de forma natural: hay menos "copias" de la rareza
// escasa relativa a las abundantes, entonces sale menos. Sin dominar el pack
// como pasaba con el algoritmo anterior (peso-por-rareza total).
const STICKER_WEIGHTS: Record<Rarity, number> = {
  common: 40,
  rare: 25,
  epic: 18,
  legendary: 12,
};

const DEFAULT_PACK_SIZE = 5;
const PACK_SIZE_MIN = 1;
const PACK_SIZE_MAX = 10;

interface Sticker {
  id: string;
  number: number;
  name: string;
  rarity: Rarity;
  large_key: string;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }
  if (req.method !== 'POST') {
    return jsonError('method_not_allowed', 405);
  }

  let pack_id: string | undefined;
  try {
    const body = await req.json();
    pack_id = body?.pack_id;
  } catch {
    return jsonError('invalid_body', 400);
  }
  if (!pack_id || typeof pack_id !== 'string') {
    return jsonError('pack_id_required', 400);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonError('auth_required', 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  );

  // 1. Cargar el pack (RLS asegura que sea del caller).
  const { data: pack, error: packErr } = await supabase
    .from('packs')
    .select('id, album_id, opened_at')
    .eq('id', pack_id)
    .maybeSingle();

  if (packErr) return jsonError(packErr.message, 500);
  if (!pack) return jsonError('pack_not_found', 404);
  if (pack.opened_at) return jsonError('pack_already_opened', 409);

  // 2. Validar status del álbum y leer pack_config.
  const { data: album, error: albErr } = await supabase
    .from('albums')
    .select('status, pack_config')
    .eq('id', pack.album_id)
    .maybeSingle();

  if (albErr) return jsonError(albErr.message, 500);
  if (!album) return jsonError('album_not_found', 404);
  if (album.status !== 'published') {
    return jsonError(`album_not_available_${album.status}`, 403);
  }

  const configuredSize = album.pack_config?.pack_size;
  const packSize = clampPackSize(configuredSize);

  // 3. Cargar todos los stickers del álbum.
  const { data: stickers, error: stkErr } = await supabase
    .from('stickers')
    .select('id, number, name, rarity, large_key')
    .eq('album_id', pack.album_id);

  if (stkErr) return jsonError(stkErr.message, 500);
  if (!stickers || stickers.length === 0) {
    return jsonError('no_stickers_in_album', 422);
  }

  // 4. Sortear N stickers ponderado por rareza.
  const picked: Sticker[] = [];
  for (let i = 0; i < packSize; i++) {
    picked.push(pickSticker(stickers as Sticker[]));
  }

  // 5. Persistir transaccionalmente vía RPC.
  const { data: applied, error: applyErr } = await supabase.rpc(
    'fn_apply_pack_open',
    {
      p_pack_id: pack_id,
      p_sticker_ids: picked.map((s) => s.id),
    },
  );

  if (applyErr) {
    // Errores de negocio del RPC vienen con SQLSTATE P00XX y mensaje legible.
    const status = applyErr.code === 'P0103' ? 409
      : applyErr.code === 'P0102' ? 403
      : applyErr.code === 'P0101' ? 404
      : 500;
    return jsonError(applyErr.message, status);
  }

  // 6. Merge: combinar info del sticker con was_new del RPC (en orden).
  const appliedArr = applied as Array<{ sticker_id: string; was_new: boolean }>;
  const result = picked.map((s, i) => ({
    sticker_id: s.id,
    number: s.number,
    name: s.name,
    rarity: s.rarity,
    large_key: s.large_key,
    was_new: appliedArr[i].was_new,
  }));

  return jsonOk({ stickers: result });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampPackSize(configured: unknown): number {
  if (typeof configured !== 'number' || !Number.isFinite(configured)) {
    return DEFAULT_PACK_SIZE;
  }
  const n = Math.floor(configured);
  if (n < PACK_SIZE_MIN) return PACK_SIZE_MIN;
  if (n > PACK_SIZE_MAX) return PACK_SIZE_MAX;
  return n;
}

function pickSticker(stickers: Sticker[]): Sticker {
  // Sortear ponderado sobre TODAS las figuritas, con peso individual según
  // rareza. Equivale a "poner N copias de cada figurita en una caja y agarrar
  // una al azar" — modelo intuitivo, robusto a álbumes desbalanceados.
  let total = 0;
  for (const s of stickers) total += STICKER_WEIGHTS[s.rarity];

  let r = Math.random() * total;
  for (const s of stickers) {
    r -= STICKER_WEIGHTS[s.rarity];
    if (r <= 0) return s;
  }
  // Fallback numérico: por floating-point puede que r > 0 al final.
  return stickers[stickers.length - 1];
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
