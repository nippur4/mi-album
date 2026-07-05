// Wrappers de las Edge Functions de QR.
//
// generateQrToken: el owner pide el token firmado para mostrarlo como QR.
// redeemQrToken:   el user (post-scan) lo manda y se le otorgan sobres.

import { callEdgeFunction } from '@/lib/edge';
import { DEFAULT_PACK_CONFIG } from '@/lib/queries/economy';
import { supabase } from '@/lib/supabase';

export interface RedeemQrResult {
  packs: number;
  next_available_at: string;
  joined: boolean;
  welcome_packs: number;
  album_id: string;
}

export async function generateQrToken(albumId: string): Promise<string> {
  const body = await callEdgeFunction<{ token: string }>('generate_qr', {
    album_id: albumId,
  });
  return body.token;
}

export async function redeemQrToken(qrToken: string): Promise<RedeemQrResult> {
  return callEdgeFunction<RedeemQrResult>('redeem_qr', { token: qrToken });
}

// Helper para activar QR desde el owner sin tener que armar pack_config a mano.
// Lee el config actual y mergea qr.enabled = true (defaults de economy.ts
// para count/cooldown si el álbum nunca tuvo sección qr).
export async function enableQrForAlbum(albumId: string): Promise<void> {
  const { data: album, error } = await supabase
    .from('albums')
    .select('pack_config, trade_config')
    .eq('id', albumId)
    .maybeSingle();
  if (error || !album) throw error ?? { error: 'album_not_found' };

  const cur = (album.pack_config as any) ?? {};
  const next = {
    ...cur,
    qr: {
      ...(cur.qr ?? {}),
      enabled: true,
      count: cur.qr?.count ?? DEFAULT_PACK_CONFIG.qr.count,
      cooldown_hours: cur.qr?.cooldown_hours ?? DEFAULT_PACK_CONFIG.qr.cooldown_hours,
    },
  };
  const { error: updErr } = await supabase.rpc('fn_update_album_economy', {
    p_album_id: albumId,
    p_pack_config: next,
    p_trade_config: null,
  });
  if (updErr) throw updErr;
}
