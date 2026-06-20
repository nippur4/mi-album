// Trae los álbumes donde el caller tiene sobres sin abrir, con su count.

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import type { Album } from '@/lib/queries/albums';

export interface AlbumWithPacks {
  album: Album;
  count: number;
}

export function useMyOpenPacksByAlbum() {
  const { session } = useSession();
  const uid = session?.user.id;

  const [items, setItems] = useState<AlbumWithPacks[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!uid) {
      setItems([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    // Packs sin abrir agrupados por album_id
    const { data: packs } = await supabase
      .from('packs')
      .select('album_id')
      .eq('user_id', uid)
      .is('opened_at', null);

    const counts = new Map<string, number>();
    for (const p of (packs ?? []) as any[]) {
      counts.set(p.album_id, (counts.get(p.album_id) ?? 0) + 1);
    }

    if (counts.size === 0) {
      setItems([]);
      setIsLoading(false);
      return;
    }

    const ids = Array.from(counts.keys());
    const { data: albums } = await supabase
      .from('albums')
      .select('*')
      .in('id', ids);

    const result: AlbumWithPacks[] = ((albums ?? []) as Album[]).map((a) => ({
      album: a,
      count: counts.get(a.id) ?? 0,
    }));
    setItems(result);
    setIsLoading(false);
  }, [uid]);

  useEffect(() => { refetch(); }, [refetch]);

  return { items, isLoading, refetch };
}
