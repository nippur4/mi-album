// Bundle para el tab Home. Reemplaza useMyOwnedAlbums + useMyMemberAlbums +
// usePublicAlbums (3 round trips) por 1 sola RPC `fn_home_bundle`.
//
// El progress (fn_album_progress) sigue separado — cambia con distinta
// frecuencia y react-query cachea por ids.

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import type { Album } from '@/lib/queries/albums';

interface Bundle {
  owned: Album[];
  joined: (Album & { __hidden?: boolean })[];
  publics: Album[];
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
      const { data } = await supabase.rpc('fn_home_bundle');
      if (!data) return EMPTY;
      const payload = data as any;
      return {
        owned: (payload.owned ?? []) as Album[],
        joined: (payload.joined ?? []) as (Album & { __hidden?: boolean })[],
        publics: (payload.public ?? []) as Album[],
      };
    },
  });

  return {
    owned: q.data?.owned ?? [],
    joined: q.data?.joined ?? [],
    publics: q.data?.publics ?? [],
    isLoading: q.isLoading,
    refetch: q.refetch,
  };
}
