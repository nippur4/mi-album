// Estado del sobre diario para un álbum + acción de reclamar.
//
// Los hooks de lectura del daily viven en player-album (bundle detalle) y en
// packs-tab (bundle Home Sobres). Este archivo mantiene solo el tipo + la
// mutation para reclamar.

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
