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
