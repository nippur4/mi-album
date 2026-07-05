// Estado del sobre diario para un álbum + acción de reclamar.
//
// Los hooks de lectura del daily viven en player-album (bundle detalle) y en
// packs-tab (bundle Home Sobres). Este archivo mantiene el tipo, el parser
// del shape crudo de las RPCs y la mutation para reclamar.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/query-client';

export interface DailyPackStatus {
  enabled: boolean;
  canClaim: boolean;
  nextAvailableAt: number | null; // ms epoch
  count: number;                  // cuántos sobres se otorgan
  cooldownHours: number;
}

// Parsea el objeto `daily` crudo que emiten fn_my_packs_tab_data y
// fn_player_album_sidedata. null/undefined devuelve el estado deshabilitado.
export function parseDailyStatus(raw: any): DailyPackStatus {
  const d = raw ?? {};
  const enabled = !!d.enabled;
  const nextMs = d.next_available_at ? new Date(d.next_available_at).getTime() : null;
  return {
    enabled,
    canClaim: enabled && (nextMs === null || nextMs <= Date.now()),
    nextAvailableAt: nextMs,
    count: Number(d.count ?? 1),
    cooldownHours: Number(d.cooldown_hours ?? 24),
  };
}

export async function claimDailyPack(albumId: string) {
  return supabase.rpc('fn_claim_daily_pack', { p_album_id: albumId });
}

// Wrapper de mutation: al reclamar, invalida el bundle Home Sobres y el
// sidedata del álbum (ambos exponen el daily y packs disponibles).
export function useClaimDailyPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (albumId: string) => claimDailyPack(albumId),
    onSuccess: (_data, albumId) => {
      qc.invalidateQueries({ queryKey: ['packs-tab'] });
      qc.invalidateQueries({ queryKey: qk.playerAlbum.sideData(albumId) });
    },
  });
}
