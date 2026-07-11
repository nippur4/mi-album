// Wrappers de las Edge Functions de QR.
//
// generateQrToken: el owner pide el token firmado para mostrarlo como QR.
// redeemQrToken:   el user (post-scan) lo manda y se le otorgan sobres.

import { callEdgeFunction } from '@/lib/edge';
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
// El merge (qr.enabled=true + defaults de count/cooldown) es server-side y
// atómico — ver migración 0055. Antes era read-modify-write en el cliente:
// 2 round trips y carrera potencial con la edición de economía.
export async function enableQrForAlbum(albumId: string): Promise<void> {
  const { error } = await supabase.rpc('fn_enable_album_qr', { p_album_id: albumId });
  if (error) throw error;
}
