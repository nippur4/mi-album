// Queries del panel admin.
//
// El gateo real está en el backend (fn_admin_list_published_albums y
// fn_set_album_public chequean is_admin). El cliente usa useIsAdmin solo para
// mostrar/ocultar el acceso al panel — no es una garantía de seguridad.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/query-client';
import { useMyProfile } from '@/lib/queries/profile';

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
  // Orden en el carrusel de públicos: mayor = aparece antes (0 = sin fijar).
  public_rank: number;
}

// El ProfileProvider ya trae is_admin en su fetch del profile — derivamos de
// ahí en vez de repetir la misma query contra profiles.
export function useIsAdmin() {
  const { profile, isLoading } = useMyProfile();
  return { isAdmin: !!profile?.is_admin, isLoading };
}

export function useAdminAlbums() {
  const q = useQuery({
    queryKey: qk.admin.albums(),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_admin_list_albums');
      if (error) throw error;
      return ((data ?? []) as any[]) as AdminAlbumRow[];
    },
  });
  return {
    albums: q.data ?? [],
    isLoading: q.isLoading,
    isRefetching: q.isRefetching,
    error: q.error ? (q.error as any).message : null,
    refetch: q.refetch,
  };
}

export async function setAlbumPublic(albumId: string, isPublic: boolean) {
  return supabase.rpc('fn_set_album_public', {
    p_album_id: albumId,
    p_is_public: isPublic,
  });
}

// Fija el orden del álbum en el carrusel de públicos (mayor = antes).
export async function setAlbumPublicRank(albumId: string, rank: number) {
  return supabase.rpc('fn_set_album_public_rank', {
    p_album_id: albumId,
    p_rank: rank,
  });
}

export function useSetAlbumPublic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { albumId: string; isPublic: boolean }) =>
      setAlbumPublic(args.albumId, args.isPublic),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.admin.albums() });
      // Los álbumes públicos del Home salen del bundle.
      qc.invalidateQueries({ queryKey: ['home-bundle'] });
    },
  });
}
