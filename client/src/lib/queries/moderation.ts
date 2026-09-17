// Moderación de contenido: bloquear usuarios + reportar álbumes.
//
// Bloquear a un usuario (one-directional): dejás de ver sus álbumes públicos
// (excluidos server-side en fn_home_bundle) y sus ofertas/matches de intercambio
// (filtrados en el cliente por useBlockedIds). Reportar un álbum registra un
// reporte para revisión de admin.

import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { toAppError } from '@/lib/errors';

export interface BlockedUser {
  blocked_id: string;
  display_name: string | null;
  avatar_thumb_key: string | null;
  created_at: string;
}

export function useMyBlocks() {
  const { session } = useSession();
  const uid = session?.user.id;
  const q = useQuery({
    queryKey: ['blocks', uid ?? 'anon'] as const,
    enabled: !!uid,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_my_blocks');
      if (error) throw toAppError(error);
      return ((data ?? []) as any[]) as BlockedUser[];
    },
  });
  return {
    blocks: q.data ?? [],
    isLoading: q.isLoading,
    isRefetching: q.isRefetching,
    refetch: q.refetch,
  };
}

// Set de ids bloqueados para filtrar client-side (ofertas, matches).
export function useBlockedIds(): Set<string> {
  const { blocks } = useMyBlocks();
  return useMemo(() => new Set(blocks.map((b) => b.blocked_id)), [blocks]);
}

export async function reportAlbum(albumId: string, reason: string, details?: string) {
  return supabase.rpc('fn_report_album', {
    p_album: albumId,
    p_reason: reason,
    p_details: details ?? undefined,
  });
}

// Acciones de bloqueo con invalidación de todo lo que muestra contenido del
// otro usuario: el carrusel público (home-bundle), las ofertas/matches (trades)
// y la propia lista de bloqueados.
export function useBlockActions() {
  const qc = useQueryClient();

  function refresh() {
    qc.invalidateQueries({ queryKey: ['blocks'] });
    qc.invalidateQueries({ queryKey: ['home-bundle'] });
    qc.invalidateQueries({ queryKey: ['trades'] });
  }

  async function block(blockedId: string) {
    const { error } = await supabase.rpc('fn_block_user', { p_blocked: blockedId });
    if (!error) refresh();
    return { error };
  }

  async function unblock(blockedId: string) {
    const { error } = await supabase.rpc('fn_unblock_user', { p_blocked: blockedId });
    if (!error) refresh();
    return { error };
  }

  return { block, unblock };
}
