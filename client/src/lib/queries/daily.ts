// Estado del sobre diario para un álbum + acción de reclamar.

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';

export interface DailyPackStatus {
  enabled: boolean;
  canClaim: boolean;
  nextAvailableAt: number | null; // ms epoch
  count: number;                  // cuántos sobres se otorgan
  cooldownHours: number;
}

const FALLBACK: DailyPackStatus = {
  enabled: false,
  canClaim: false,
  nextAvailableAt: null,
  count: 1,
  cooldownHours: 24,
};

export function useDailyPackStatus(albumId: string | undefined) {
  const { session } = useSession();
  const uid = session?.user.id;
  const [status, setStatus] = useState<DailyPackStatus>(FALLBACK);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!uid || !albumId) {
      setStatus(FALLBACK);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const [{ data: album }, { data: mem }] = await Promise.all([
      supabase.from('albums').select('pack_config').eq('id', albumId).maybeSingle(),
      supabase
        .from('user_album_membership')
        .select('last_daily_claim_at')
        .eq('user_id', uid)
        .eq('album_id', albumId)
        .maybeSingle(),
    ]);

    const cfg = (album?.pack_config as any)?.daily ?? {};
    const enabled = !!cfg.enabled;
    const cooldownHours = Number(cfg.cooldown_hours ?? 24);
    const count = Number(cfg.count ?? 1);

    const last = mem?.last_daily_claim_at ? new Date(mem.last_daily_claim_at).getTime() : null;
    const next = last !== null ? last + cooldownHours * 3600_000 : null;
    const canClaim = enabled && (next === null || next <= Date.now());

    setStatus({ enabled, canClaim, nextAvailableAt: next, count, cooldownHours });
    setIsLoading(false);
  }, [uid, albumId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { status, isLoading, refetch };
}

export async function claimDailyPack(albumId: string) {
  return supabase.rpc('fn_claim_daily_pack', { p_album_id: albumId });
}

// Batch: una sola RPC para varios álbumes. Útil en el tab Sobres para evitar
// N+1 (el hook singular hace 2 queries por álbum).
export function useMyDailyStatusBatch(albumIds: string[]) {
  const [byAlbum, setByAlbum] = useState<Map<string, DailyPackStatus>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const key = albumIds.slice().sort().join(',');

  const refetch = useCallback(async () => {
    if (albumIds.length === 0) {
      setByAlbum(new Map());
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
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
    setByAlbum(map);
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => { refetch(); }, [refetch]);

  return { byAlbum, isLoading, refetch };
}
