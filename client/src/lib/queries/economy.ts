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

// trade_config default: enabled sin límite. Free NO puede editar esto (el
// límite es pro-only, ni siquiera el toggle). Pro puede desactivar o poner
// un límite N por período.
export interface TradeConfig {
  enabled: boolean;
  limit?: { count: number; period: 'day' | 'week' | 'month' } | null;
}

export const DEFAULT_PACK_CONFIG: PackConfig = {
  daily: { enabled: true, count: 1, cooldown_hours: 24 },
  qr: { enabled: false, count: 3, cooldown_hours: 24 },
  welcome: { enabled: true, count: 1 },
  pack_size: 5,
};

export const DEFAULT_TRADE_CONFIG: TradeConfig = {
  enabled: true,
  limit: null,
};

// Opciones de UI para pack size (todos), welcome free vs pro, y trade limits.
export const PACK_SIZE_OPTIONS = [1, 3, 5, 7, 10] as const;
export type PackSize = (typeof PACK_SIZE_OPTIONS)[number];

export const WELCOME_FREE_OPTIONS = [0, 1, 3] as const;
export const WELCOME_PRO_OPTIONS = [0, 1, 3, 5, 7, 10] as const;

// null = sin límite. Se serializa como `limit: null` en la DB.
export type TradeLimitPreset = null | { count: number; period: 'day' | 'week' };

export const TRADE_LIMIT_OPTIONS: Array<{ key: string; label: string; value: TradeLimitPreset }> = [
  { key: 'unlimited', label: 'Sin límite',        value: null },
  { key: 'd1',        label: '1 por día',         value: { count: 1, period: 'day' } },
  { key: 'd3',        label: '3 por día',         value: { count: 3, period: 'day' } },
  { key: 'd5',        label: '5 por día',         value: { count: 5, period: 'day' } },
  { key: 'w1',        label: '1 por semana',      value: { count: 1, period: 'week' } },
  { key: 'w3',        label: '3 por semana',      value: { count: 3, period: 'week' } },
  { key: 'w5',        label: '5 por semana',      value: { count: 5, period: 'week' } },
  { key: 'w10',       label: '10 por semana',     value: { count: 10, period: 'week' } },
];

export function limitToPresetKey(limit: TradeConfig['limit']): string {
  if (!limit) return 'unlimited';
  const match = TRADE_LIMIT_OPTIONS.find(
    (o) => o.value && limit.count === o.value.count && limit.period === o.value.period,
  );
  return match?.key ?? 'unlimited';
}

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

export async function updateAlbumEconomy(
  albumId: string,
  packConfig: PackConfig,
  tradeConfig?: TradeConfig | null,
) {
  return supabase.rpc('fn_update_album_economy', {
    p_album_id: albumId,
    p_pack_config: packConfig as any,
    p_trade_config: tradeConfig ? (tradeConfig as any) : null,
  });
}
