// Wrappers sobre fn_update_album_economy + tipo del pack_config.
//
// El RPC backend (fn_update_album_economy) acepta pack_config completo y
// trade_config completo (cualquiera puede ser null para no tocarse). El
// gate de pro al habilitar QR se enforza server-side.

import { supabase } from '@/lib/supabase';

export type DeliveryMode = 'daily' | 'qr' | 'both' | 'none';

export interface PackConfig {
  daily: { enabled: boolean; count: number; cooldown_hours: number };
  qr: { enabled: boolean; count: number; cooldown_hours: number };
  welcome?: { enabled: boolean; count: number };
  pack_size?: number;
}

export const DEFAULT_PACK_CONFIG: PackConfig = {
  daily: { enabled: true, count: 1, cooldown_hours: 24 },
  qr: { enabled: false, count: 3, cooldown_hours: 24 },
  welcome: { enabled: true, count: 1 },
  pack_size: 5,
};

// Free vs Pro: el cliente refleja el gate para no permitir intentos que
// el server va a rechazar. La frecuencia semanal y el QR son pro-only.
export const PACK_SIZE_OPTIONS = [1, 3, 5, 7, 10] as const;
export type PackSize = (typeof PACK_SIZE_OPTIONS)[number];

export function modeFromConfig(cfg: PackConfig): DeliveryMode {
  const d = cfg.daily?.enabled === true;
  const q = cfg.qr?.enabled === true;
  if (d && q) return 'both';
  if (d) return 'daily';
  if (q) return 'qr';
  return 'none';
}

export function applyMode(cfg: PackConfig, mode: DeliveryMode): PackConfig {
  return {
    ...cfg,
    daily: { ...cfg.daily, enabled: mode === 'daily' || mode === 'both' },
    qr: { ...cfg.qr, enabled: mode === 'qr' || mode === 'both' },
  };
}

export async function updateAlbumEconomy(albumId: string, packConfig: PackConfig) {
  return supabase.rpc('fn_update_album_economy', {
    p_album_id: albumId,
    p_pack_config: packConfig as any,
    p_trade_config: null,
  });
}
