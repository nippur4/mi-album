// Queries del panel admin.
//
// El gateo real está en el backend (fn_admin_list_published_albums y
// fn_set_album_public chequean is_admin). El cliente usa useIsAdmin solo para
// mostrar/ocultar el acceso al panel — no es una garantía de seguridad.

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';

export interface AdminAlbumRow {
  id: string;
  name: string;
  owner_id: string;
  owner_name: string;
  status: 'draft' | 'published' | 'read_only' | 'archived';
  is_public: boolean;
  total_stickers: number;
  published_at: string | null;
  created_at: string;
  member_count: number;
}

export function useIsAdmin() {
  const { session } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!session) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }
    supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsAdmin(!!data?.is_admin);
        setIsLoading(false);
      });
  }, [session]);

  return { isAdmin, isLoading };
}

export function useAdminAlbums() {
  const [albums, setAlbums] = useState<AdminAlbumRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('fn_admin_list_albums');
    if (error) {
      setError(error.message);
      setAlbums([]);
    } else {
      setAlbums(((data ?? []) as any[]) as AdminAlbumRow[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { albums, isLoading, error, refetch };
}

export async function setAlbumPublic(albumId: string, isPublic: boolean) {
  return supabase.rpc('fn_set_album_public', {
    p_album_id: albumId,
    p_is_public: isPublic,
  });
}
