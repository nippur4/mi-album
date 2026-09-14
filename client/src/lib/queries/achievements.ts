// Stats crudas para los logros. Una sola RPC (fn_my_achievement_stats) devuelve
// los números; el catálogo estático en lib/achievements.ts los mapea a logros
// concretos (nombres divertidos + íconos + umbrales).

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { toAppError } from '@/lib/errors';

export interface AchievementStats {
  packs_opened: number;
  albums_created: number;
  albums_completed: number;
  completed_special_ids: string[];
}

const EMPTY: AchievementStats = {
  packs_opened: 0,
  albums_created: 0,
  albums_completed: 0,
  completed_special_ids: [],
};

export function useAchievementStats() {
  const { session } = useSession();
  const uid = session?.user.id;

  const q = useQuery({
    queryKey: ['achievements', 'stats', uid ?? 'anon'] as const,
    enabled: !!uid,
    staleTime: 30_000,
    queryFn: async (): Promise<AchievementStats> => {
      const { data, error } = await supabase.rpc('fn_my_achievement_stats');
      if (error) throw toAppError(error);
      const raw = (data ?? {}) as any;
      return {
        packs_opened: Number(raw.packs_opened ?? 0),
        albums_created: Number(raw.albums_created ?? 0),
        albums_completed: Number(raw.albums_completed ?? 0),
        completed_special_ids: (raw.completed_special_ids ?? []) as string[],
      };
    },
  });

  return {
    stats: q.data ?? EMPTY,
    isLoading: q.isLoading,
    isRefetching: q.isRefetching,
    refetch: q.refetch,
  };
}
