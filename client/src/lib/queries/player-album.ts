// Hook batch para el data del jugador en un álbum: colección + sobres
// disponibles + estado del daily.
// Ver supabase/migrations/0030_fn_player_album_sidedata.sql.

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { qk } from '@/lib/query-client';
import { toAppError } from '@/lib/errors';
import { parseDailyStatus, type DailyPackStatus } from '@/lib/queries/daily';

// Una entrada de la colección: un sticker + su cantidad + si está pegado.
export interface CollectionEntry {
  sticker_id: string;
  pasted: boolean;
  quantity: number;
}

interface Bundle {
  collection: Map<string, CollectionEntry>;
  packsAvailable: number;
  daily: DailyPackStatus;
  // El jugador silenció los sobres diarios de este álbum (toggle propio).
  dailyMuted: boolean;
}

const EMPTY_BUNDLE: Bundle = {
  collection: new Map(),
  packsAvailable: 0,
  daily: parseDailyStatus(null),
  dailyMuted: false,
};

export function usePlayerAlbumSideData(albumId: string | undefined) {
  const { session } = useSession();
  const uid = session?.user.id;

  const q = useQuery({
    queryKey: [...qk.playerAlbum.sideData(albumId), uid ?? 'anon'] as const,
    enabled: !!uid && !!albumId,
    staleTime: 10_000,
    queryFn: async (): Promise<Bundle> => {
      const { data, error } = await supabase.rpc('fn_player_album_sidedata', {
        p_album_id: albumId!,
      });
      if (error) throw toAppError(error);
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

      return {
        collection,
        packsAvailable,
        daily: parseDailyStatus(payload.daily),
        dailyMuted: !!payload.daily_muted,
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
