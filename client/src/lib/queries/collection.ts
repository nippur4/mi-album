// Queries de la colección del usuario: qué tiene pegado/repetido en cada
// álbum, y cuántos sobres tiene sin abrir.

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { toAppError } from '@/lib/errors';

export interface CollectionEntry {
  sticker_id: string;
  pasted: boolean;
  quantity: number;
}

// Hook que devuelve un Map<sticker_id, CollectionEntry> para los stickers de
// un álbum. Si una sticker no está en el map, el user no la tiene (missing).
export function useUserCollection(albumId: string | undefined) {
  const { session } = useSession();
  const uid = session?.user.id;

  const [map, setMap] = useState<Map<string, CollectionEntry>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!uid || !albumId) {
      setMap(new Map());
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('user_collection')
      .select('sticker_id, pasted, quantity, sticker:stickers!inner(album_id)')
      .eq('user_id', uid)
      .eq('stickers.album_id', albumId);
    if (error) {
      console.warn('useUserCollection error', toAppError(error));
      setMap(new Map());
    } else {
      const m = new Map<string, CollectionEntry>();
      for (const row of (data ?? []) as any[]) {
        m.set(row.sticker_id, {
          sticker_id: row.sticker_id,
          pasted: row.pasted,
          quantity: row.quantity,
        });
      }
      setMap(m);
    }
    setIsLoading(false);
  }, [uid, albumId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { collection: map, isLoading, refetch };
}

// Cuántos sobres sin abrir tiene el user en un álbum.
export function useAvailablePacksCount(albumId: string | undefined) {
  const { session } = useSession();
  const uid = session?.user.id;
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!uid || !albumId) {
      setCount(0);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { count: c } = await supabase
      .from('packs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('album_id', albumId)
      .is('opened_at', null);
    setCount(c ?? 0);
    setIsLoading(false);
  }, [uid, albumId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { count, isLoading, refetch };
}
