// Hook batch para el data del jugador en un álbum: colección + sobres
// disponibles + estado del daily.
// Ver supabase/migrations/0030_fn_player_album_sidedata.sql.

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { qk } from '@/lib/query-client';
import type { DailyPackStatus } from '@/lib/queries/daily';

// Una entrada de la colección: un sticker + su cantidad + si está pegado.
export interface CollectionEntry {
  sticker_id: string;
  pasted: boolean;
  quantity: number;
}

const DAILY_FALLBACK: DailyPackStatus = {
  enabled: false,
  canClaim: false,
  nextAvailableAt: null,
  count: 1,
  cooldownHours: 24,
};

interface Bundle {
  collection: Map<string, CollectionEntry>;
  packsAvailable: number;
  daily: DailyPackStatus;
}

const EMPTY_BUNDLE: Bundle = {
  collection: new Map(),
  packsAvailable: 0,
  daily: DAILY_FALLBACK,
};

export function usePlayerAlbumSideData(albumId: string | undefined) {
  const { session } = useSession();
  const uid = session?.user.id;

  const q = useQuery({
    queryKey: [...qk.playerAlbum.sideData(albumId), uid ?? 'anon'] as const,
    enabled: !!uid && !!albumId,
    staleTime: 10_000,
    queryFn: async (): Promise<Bundle> => {
      const { data } = await supabase.rpc('fn_player_album_sidedata', {
        p_album_id: albumId!,
      });
      if (!data) return EMPTY_BUNDLE;
      const payload = data as any;

      const collection = new Map<string, CollectionEntry>();
      for (const row of (payload.collection ?? []) as any[]) {
        collection.set(row.sticker_id, {
          sticker_id: row.sticker_id,
          pasted: !!row.pasted,
          quantity: Number(row.quantity ?? 0),
        });
      }

      const packsAvailable = Number(payload.packs_available ?? 0);

      const dailyRaw = payload.daily ?? {};
      const enabled = !!dailyRaw.enabled;
      const cooldownHours = Number(dailyRaw.cooldown_hours ?? 24);
      const count = Number(dailyRaw.count ?? 1);
      const nextMs = dailyRaw.next_available_at
        ? new Date(dailyRaw.next_available_at).getTime()
        : null;
      const canClaim = enabled && (nextMs === null || nextMs <= Date.now());

      return {
        collection,
        packsAvailable,
        daily: { enabled, canClaim, nextAvailableAt: nextMs, count, cooldownHours },
      };
    },
  });
  const bundle = q.data ?? EMPTY_BUNDLE;
  return {
    ...bundle,
    isLoading: q.isLoading,
    refetch: q.refetch,
  };
}
