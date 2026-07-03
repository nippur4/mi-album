// Queries del panel admin.
//
// El gateo real está en el backend (fn_admin_list_published_albums y
// fn_set_album_public chequean is_admin). El cliente usa useIsAdmin solo para
// mostrar/ocultar el acceso al panel — no es una garantía de seguridad.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { qk } from '@/lib/query-client';

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
  const q = useQuery({
    queryKey: [...qk.admin.isAdmin(), session?.user.id ?? 'anon'] as const,
    enabled: !!session,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session!.user.id)
        .maybeSingle();
      return !!data?.is_admin;
    },
  });
  return { isAdmin: q.data ?? false, isLoading: q.isLoading };
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

export function useSetAlbumPublic() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { albumId: string; isPublic: boolean }) =>
      setAlbumPublic(args.albumId, args.isPublic),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.admin.albums() });
      qc.invalidateQueries({ queryKey: qk.albums.public() });
    },
  });
}
