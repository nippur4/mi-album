// Hook batch para todo el data del tab Sobres.
// Reemplaza useMyOpenPacksByAlbum + useMyMemberAlbums + useMyOwnedAlbums +
// useMyDailyStatusBatch (4 round trips) por 1 sola RPC `fn_my_packs_tab_data`.
//
// Ver supabase/migrations/0031_fn_my_packs_tab_data.sql.

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import type { DailyPackStatus } from '@/lib/queries/daily';

export interface PendingPackRow {
  album_id: string;
  album_name: string;
  cover_thumb_key: string | null;
  pack_thumb_key: string | null;
  count: number;
}

export interface PlayableAlbumRow {
  album_id: string;
  album_name: string;
  cover_thumb_key: string | null;
  pack_thumb_key: string | null;
  daily: DailyPackStatus;
}

interface Bundle {
  pending: PendingPackRow[];
  playable: PlayableAlbumRow[];
}

const EMPTY: Bundle = { pending: [], playable: [] };

export function useMyPacksTabData() {
  const { session } = useSession();
  const uid = session?.user.id;

  const q = useQuery({
    queryKey: ['packs-tab', uid ?? 'anon'] as const,
    enabled: !!uid,
    staleTime: 10_000,
    queryFn: async (): Promise<Bundle> => {
      const { data } = await supabase.rpc('fn_my_packs_tab_data');
      if (!data) return EMPTY;
      const payload = data as any;

      const pending: PendingPackRow[] = ((payload.pending_packs ?? []) as any[]).map((r) => ({
        album_id: r.album_id,
        album_name: r.album_name,
        cover_thumb_key: r.cover_thumb_key,
        pack_thumb_key: r.pack_thumb_key,
        count: Number(r.pending_count ?? 0),
      }));

      const playable: PlayableAlbumRow[] = ((payload.playable_albums ?? []) as any[]).map((r) => {
        const d = r.daily ?? {};
        const enabled = !!d.enabled;
        const nextMs = d.next_available_at ? new Date(d.next_available_at).getTime() : null;
        const canClaim = enabled && (nextMs === null || nextMs <= Date.now());
        return {
          album_id: r.album_id,
          album_name: r.album_name,
          cover_thumb_key: r.cover_thumb_key,
          pack_thumb_key: r.pack_thumb_key,
          daily: {
            enabled,
            canClaim,
            nextAvailableAt: nextMs,
            count: Number(d.count ?? 1),
            cooldownHours: Number(d.cooldown_hours ?? 24),
          },
        };
      });

      return { pending, playable };
    },
  });

  return {
    pending: q.data?.pending ?? [],
    playable: q.data?.playable ?? [],
    isLoading: q.isLoading,
    refetch: q.refetch,
  };
}
