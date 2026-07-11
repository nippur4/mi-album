// Bundle para el tab Home. Reemplaza useMyOwnedAlbums + useMyMemberAlbums +
// usePublicAlbums (3 round trips) por 1 sola RPC `fn_home_bundle`.
//
// El progress (fn_album_progress) sigue separado — cambia con distinta
// frecuencia y react-query cachea por ids.

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { toAppError } from '@/lib/errors';

// Proyección mínima que devuelve fn_home_bundle (migración 0053): solo lo
// que usan las cards del Home. El detalle completo se baja al navegar.
export interface HomeAlbum {
  id: string;
  name: string;
  total_stickers: number;
  cover_thumb_key: string | null;
  cover_large_key: string | null;
}

interface Bundle {
  owned: HomeAlbum[];
  joined: (HomeAlbum & { __hidden?: boolean })[];
  publics: HomeAlbum[];
}

const EMPTY: Bundle = { owned: [], joined: [], publics: [] };

export function useHomeBundle() {
  const { session } = useSession();
  const uid = session?.user.id;

  const q = useQuery({
    queryKey: ['home-bundle', uid ?? 'anon'] as const,
    enabled: !!uid,
    staleTime: 15_000,
    queryFn: async (): Promise<Bundle> => {
      const { data, error } = await supabase.rpc('fn_home_bundle');
      if (error) throw toAppError(error);
      if (!data) return EMPTY;
      const payload = data as any;
      return {
        owned: (payload.owned ?? []) as HomeAlbum[],
        joined: (payload.joined ?? []) as (HomeAlbum & { __hidden?: boolean })[],
        publics: (payload.public ?? []) as HomeAlbum[],
      };
    },
  });

  return {
    owned: q.data?.owned ?? [],
    joined: q.data?.joined ?? [],
    publics: q.data?.publics ?? [],
    isLoading: q.isLoading,
    isRefetching: q.isRefetching,
    refetch: q.refetch,
  };
}
