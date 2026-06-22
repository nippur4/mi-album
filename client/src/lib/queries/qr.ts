// Wrappers de las Edge Functions de QR.
//
// generateQrToken: el owner pide el token firmado para mostrarlo como QR.
// redeemQrToken:   el user (post-scan) lo manda y se le otorgan sobres.

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

export interface RedeemQrResult {
  packs: number;
  next_available_at: string;
  joined: boolean;
  welcome_packs: number;
  album_id: string;
}

async function bearer(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (!t) throw { error: 'auth_required' };
  return t;
}

export async function generateQrToken(albumId: string): Promise<string> {
  const token = await bearer();
  const res = await fetch(`${env.supabaseUrl}/functions/v1/generate_qr`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ album_id: albumId }),
  });
  const text = await res.text();
  let body: any = {};
  try { body = JSON.parse(text); } catch {}
  if (!res.ok) {
    throw { error: body.error ?? `generate_qr_failed_${res.status}` };
  }
  return body.token as string;
}

export async function redeemQrToken(qrToken: string): Promise<RedeemQrResult> {
  const token = await bearer();
  const res = await fetch(`${env.supabaseUrl}/functions/v1/redeem_qr`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: env.supabaseAnonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: qrToken }),
  });
  const text = await res.text();
  let body: any = {};
  try { body = JSON.parse(text); } catch {}
  if (!res.ok) {
    throw { error: body.error ?? `redeem_qr_failed_${res.status}` };
  }
  return body as RedeemQrResult;
}

// Helper para activar QR desde el owner sin tener que armar pack_config a mano.
// Lee el config actual y mergea qr.enabled = true.
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
    qr: { ...(cur.qr ?? {}), enabled: true, count: cur.qr?.count ?? 3, cooldown_hours: cur.qr?.cooldown_hours ?? 24 },
  };
  const { error: updErr } = await supabase.rpc('fn_update_album_economy', {
    p_album_id: albumId,
    p_pack_config: next,
    p_trade_config: null,
  });
  if (updErr) throw updErr;
}
