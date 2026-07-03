// Trae los álbumes donde el caller tiene sobres sin abrir, con su count.
// Backed por la RPC `fn_my_pending_packs` que hace el group by en Postgres.

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { qk } from '@/lib/query-client';

export interface PendingPacksRow {
  album_id: string;
  album_name: string;
  cover_thumb_key: string | null;
  pack_thumb_key: string | null;
  count: number;
}

export function useMyOpenPacksByAlbum() {
  const { session } = useSession();
  const uid = session?.user.id;
  const q = useQuery({
    queryKey: [...qk.packs.pendingByAlbum(), uid ?? 'anon'] as const,
    enabled: !!uid,
    staleTime: 10_000,
    queryFn: async () => {
      const { data } = await supabase.rpc('fn_my_pending_packs');
      return ((data ?? []) as any[]).map((r) => ({
        album_id: r.album_id,
        album_name: r.album_name,
        cover_thumb_key: r.cover_thumb_key,
        pack_thumb_key: r.pack_thumb_key,
        count: Number(r.pending_count ?? 0),
      } satisfies PendingPacksRow));
    },
  });
  return { items: q.data ?? [], isLoading: q.isLoading, refetch: q.refetch };
}
