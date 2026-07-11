// Profile del user actual (display_name, avatar, is_admin) + mutaciones.
//
// El Provider expone un contexto para que el componente arbol pueda leer el
// profile sin duplicar fetches. La query interna usa react-query, así se
// dedup con otros callers y respeta staleTime + refetchOnFocus.

import { createContext, useContext, type ReactNode } from 'react';
import { createElement } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { toAppError } from '@/lib/errors';
import { qk } from '@/lib/query-client';

export interface MyProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  avatar_thumb_key: string | null;
  is_admin: boolean;
}

interface ProfileCtx {
  profile: MyProfile | null;
  isLoading: boolean;
  refetch: () => Promise<any>;
}

const ProfileContext = createContext<ProfileCtx | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const uid = session?.user.id;

  const q = useQuery({
    queryKey: [...qk.profile.me(), uid ?? 'anon'] as const,
    enabled: !!uid,
    // El profile cambia poco (nombre, avatar) y siempre vía mutations
    // nuestras — invalidamos manual al mutar.
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, avatar_thumb_key, is_admin')
        .eq('id', uid!)
        .maybeSingle();
      if (error) throw toAppError(error);
      return (data ?? null) as MyProfile | null;
    },
  });

  return createElement(
    ProfileContext.Provider,
    { value: { profile: q.data ?? null, isLoading: q.isLoading, refetch: q.refetch } },
    children,
  );
}

export function useMyProfile(): ProfileCtx {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useMyProfile must be used inside <ProfileProvider>');
  }
  return ctx;
}

export async function updateDisplayName(newName: string) {
  return supabase.rpc('fn_update_display_name', { p_new_name: newName });
}

// thumbKey=null → vuelve al avatar default (iniciales+color hash): se omite
// el param y aplica el default null del RPC (migración 0056).
export async function updateAvatar(thumbKey: string | null) {
  return supabase.rpc('fn_update_avatar', { p_thumb_key: thumbKey ?? undefined });
}

export function useUpdateDisplayName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateDisplayName,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profile.me() }),
  });
}

export function useUpdateAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateAvatar,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profile.me() }),
  });
}
