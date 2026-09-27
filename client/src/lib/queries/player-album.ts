// Hook batch para el data del jugador en un álbum: colección + sobres
// disponibles + estado del daily.
// Ver supabase/migrations/0030_fn_player_album_sidedata.sql.

import { useMemo } from 'react';
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

// Lo que DEVUELVE el hook a los componentes: collection como Map para lookups
// O(1) por sticker_id (los consumidores hacen .get()/.values()/.size).
interface Bundle {
  collection: Map<string, CollectionEntry>;
  packsAvailable: number;
  daily: DailyPackStatus;
  // El jugador silenció los sobres diarios de este álbum (toggle propio).
  dailyMuted: boolean;
  // Settings de intercambio del jugador en este álbum (default off).
  tradeWhenComplete: boolean;
  acceptOwned: boolean;
}

// Lo que se CACHEA: collection como ARRAY, no Map. Un Map NO sobrevive la
// serialización a disco del persister (PersistQueryClientProvider): se guarda
// como `{}` y al rehidratar en frío `collection.get()` queda undefined → crash
// "is not a function" al entrar a un álbum que jugás, abrir la vista grande de
// una figurita o ir a Coincidencias (todos usan este bundle). El Map se
// reconstruye en memoria con useMemo, nunca se persiste. Mismo patrón que
// adSummary.albumIds en packs.ts (bug gemelo, ya arreglado allá).
interface BundleCache {
  collection: CollectionEntry[];
  packsAvailable: number;
  daily: DailyPackStatus;
  dailyMuted: boolean;
  tradeWhenComplete: boolean;
  acceptOwned: boolean;
}

const EMPTY_CACHE: BundleCache = {
  collection: [],
  packsAvailable: 0,
  daily: parseDailyStatus(null),
  dailyMuted: false,
  tradeWhenComplete: false,
  acceptOwned: false,
};

export function usePlayerAlbumSideData(albumId: string | undefined) {
  const { session } = useSession();
  const uid = session?.user.id;

  const q = useQuery({
    queryKey: [...qk.playerAlbum.sideData(albumId), uid ?? 'anon'] as const,
    enabled: !!uid && !!albumId,
    staleTime: 10_000,
    queryFn: async (): Promise<BundleCache> => {
      const { data, error } = await supabase.rpc('fn_player_album_sidedata', {
        p_album_id: albumId!,
      });
      if (error) throw toAppError(error);
      if (!data) return EMPTY_CACHE;
      const payload = data as any;

      const collection: CollectionEntry[] = ((payload.collection ?? []) as any[]).map(
        (row) => ({
          sticker_id: row.sticker_id,
          pasted: !!row.pasted,
          quantity: Number(row.quantity ?? 0),
        }),
      );

      return {
        collection,
        packsAvailable: Number(payload.packs_available ?? 0),
        daily: parseDailyStatus(payload.daily),
        dailyMuted: !!payload.daily_muted,
        tradeWhenComplete: !!payload.trade_when_complete,
        acceptOwned: !!payload.accept_owned,
      };
    },
  });

  // Reconstruimos el Map desde el array cacheado. Array.isArray protege el
  // cache viejo/roto (collection guardada como {} por el bug del Map), que si no
  // reventaría el for-of.
  const bundle = useMemo<Bundle>(() => {
    const cached = q.data;
    const list = Array.isArray(cached?.collection) ? cached!.collection : [];
    const collection = new Map<string, CollectionEntry>();
    for (const e of list) collection.set(e.sticker_id, e);
    return {
      collection,
      packsAvailable: cached?.packsAvailable ?? 0,
      daily: cached?.daily ?? EMPTY_CACHE.daily,
      dailyMuted: cached?.dailyMuted ?? false,
      tradeWhenComplete: cached?.tradeWhenComplete ?? false,
      acceptOwned: cached?.acceptOwned ?? false,
    };
  }, [q.data]);

  return {
    ...bundle,
    isLoading: q.isLoading,
    refetch: q.refetch,
  };
}
