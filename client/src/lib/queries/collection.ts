// Queries de la colección del usuario para un álbum específico.
// Nota: si la vista consume varios de estos (collection + packs + daily),
// preferí usar `usePlayerAlbumSideData` que bundlea todo en 1 RPC.

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { toAppError } from '@/lib/errors';

export interface CollectionEntry {
  sticker_id: string;
  pasted: boolean;
  quantity: number;
}

// Map<sticker_id, CollectionEntry> para los stickers de un álbum.
// Si un sticker no está en el map, el user no lo tiene (missing).
export function useUserCollection(albumId: string | undefined) {
  const { session } = useSession();
  const uid = session?.user.id;

  const q = useQuery({
    queryKey: ['collection', albumId, uid ?? 'anon'] as const,
    enabled: !!uid && !!albumId,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_collection')
        .select('sticker_id, pasted, quantity, sticker:stickers!inner(album_id)')
        .eq('user_id', uid!)
        .eq('stickers.album_id', albumId!);
      if (error) {
        console.warn('useUserCollection error', toAppError(error));
        return new Map<string, CollectionEntry>();
      }
      const m = new Map<string, CollectionEntry>();
      for (const row of (data ?? []) as any[]) {
        m.set(row.sticker_id, {
          sticker_id: row.sticker_id,
          pasted: row.pasted,
          quantity: row.quantity,
        });
      }
      return m;
    },
  });
  return { collection: q.data ?? new Map<string, CollectionEntry>(), isLoading: q.isLoading, refetch: q.refetch };
}

// Cuántos sobres sin abrir tiene el user en un álbum.
export function useAvailablePacksCount(albumId: string | undefined) {
  const { session } = useSession();
  const uid = session?.user.id;

  const q = useQuery({
    queryKey: ['packs-count', albumId, uid ?? 'anon'] as const,
    enabled: !!uid && !!albumId,
    staleTime: 10_000,
    queryFn: async () => {
      const { count } = await supabase
        .from('packs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', uid!)
        .eq('album_id', albumId!)
        .is('opened_at', null);
      return count ?? 0;
    },
  });
  return { count: q.data ?? 0, isLoading: q.isLoading, refetch: q.refetch };
}
