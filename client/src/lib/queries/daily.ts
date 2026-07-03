// Estado del sobre diario para un álbum + acción de reclamar.
// Migrado a react-query: dedup entre callers y invalidación selectiva.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/query-client';

export interface DailyPackStatus {
  enabled: boolean;
  canClaim: boolean;
  nextAvailableAt: number | null; // ms epoch
  count: number;                  // cuántos sobres se otorgan
  cooldownHours: number;
}

// Batch: una sola RPC para varios álbumes. Se usa en el tab Sobres.
export function useMyDailyStatusBatch(albumIds: string[]) {
  const q = useQuery({
    queryKey: qk.daily.batch(albumIds),
    enabled: albumIds.length > 0,
    staleTime: 10_000,
    queryFn: async () => {
      const { data } = await supabase.rpc('fn_my_daily_status', { p_album_ids: albumIds });
      const map = new Map<string, DailyPackStatus>();
      for (const row of (data ?? []) as any[]) {
        const nextMs = row.next_available_at ? new Date(row.next_available_at).getTime() : null;
        map.set(row.album_id, {
          enabled: !!row.enabled,
          canClaim: !!row.enabled && (nextMs === null || nextMs <= Date.now()),
          nextAvailableAt: nextMs,
          count: Number(row.count ?? 1),
          cooldownHours: Number(row.cooldown_hours ?? 24),
        });
      }
      return map;
    },
  });
  return { byAlbum: q.data ?? new Map(), isLoading: q.isLoading, refetch: q.refetch };
}

export async function claimDailyPack(albumId: string) {
  return supabase.rpc('fn_claim_daily_pack', { p_album_id: albumId });
}

// Wrapper de mutation: al reclamar, invalida el daily del batch y el
// sidedata del álbum (que también expone el daily + packs_available).
export function useClaimDailyPack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (albumId: string) => claimDailyPack(albumId),
    onSuccess: (_data, albumId) => {
      qc.invalidateQueries({ queryKey: ['daily'] });
      qc.invalidateQueries({ queryKey: qk.playerAlbum.sideData(albumId) });
      qc.invalidateQueries({ queryKey: qk.packs.pendingByAlbum() });
    },
  });
}
