// Plantillas de imágenes (cover / pack) subidas por admins.
//
// Conviven con los gradientes hardcoded de lib/presets.ts. El picker muestra
// primero los gradientes locales y abajo las imágenes activas de admin
// filtradas por kind.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { toAppError } from '@/lib/errors';
import { qk } from '@/lib/query-client';

export type PresetKind = 'cover' | 'pack' | 'avatar';

export interface PresetImage {
  id: string;
  kind: PresetKind;
  name: string;
  thumb_key: string;
  large_key: string;
  sort_order: number;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Lista de presets activos para un kind dado. Usa RLS (active=true).
export function useActivePresets(kind: PresetKind) {
  const q = useQuery({
    queryKey: qk.presets.byKind(kind),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('preset_images')
        .select('*')
        .eq('kind', kind)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw toAppError(error);
      return (data ?? []) as PresetImage[];
    },
  });
  return { items: q.data ?? [], isLoading: q.isLoading };
}

// Estado de desbloqueo de avatares del caller (ver migración 0035).
// sort_order del preset = número de avatar; free = libres para todos;
// unlocked = figuritas ya pegadas en el álbum de avatares.
export interface AvatarUnlocks {
  albumId: string;
  albumName: string;
  free: number[];
  unlocked: number[];
}

export function useAvatarUnlocks(enabled = true) {
  const q = useQuery({
    queryKey: ['avatars', 'unlocks'] as const,
    enabled,
    staleTime: 10_000,
    queryFn: async (): Promise<AvatarUnlocks> => {
      const { data, error } = await supabase.rpc('fn_my_avatar_unlocks');
      if (error) throw toAppError(error);
      const p = data as any;
      return {
        albumId: p?.album_id ?? '',
        albumName: p?.album_name ?? '',
        free: (p?.free ?? []) as number[],
        unlocked: (p?.unlocked ?? []) as number[],
      };
    },
  });
  return { unlocks: q.data ?? null, isLoading: q.isLoading, isError: q.isError };
}

// Lista admin (incluye inactive). Vía RPC SECURITY DEFINER.
export function useAdminPresets() {
  const q = useQuery({
    queryKey: ['admin', 'presets', 'all'] as const,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_admin_list_presets');
      if (error) throw error;
      return ((data ?? []) as any[]) as PresetImage[];
    },
  });
  return {
    items: q.data ?? [],
    isLoading: q.isLoading,
    isRefetching: q.isRefetching,
    error: q.error ? (q.error as any).message : null,
    refetch: q.refetch,
  };
}

export async function createAdminPreset(args: {
  preset_id: string;
  kind: PresetKind;
  name: string;
  thumb_key: string;
  large_key: string;
  sort_order?: number;
}) {
  return supabase.rpc('fn_admin_create_preset', {
    p_id: args.preset_id,
    p_kind: args.kind,
    p_name: args.name,
    p_thumb_key: args.thumb_key,
    p_large_key: args.large_key,
    p_sort_order: args.sort_order ?? 0,
  });
}

export async function updateAdminPreset(args: {
  id: string;
  name?: string;
  sort_order?: number;
  active?: boolean;
}) {
  return supabase.rpc('fn_admin_update_preset', {
    p_id: args.id,
    p_name: args.name ?? null,
    p_sort_order: args.sort_order ?? null,
    p_active: args.active ?? null,
  });
}

export async function deleteAdminPreset(id: string) {
  return supabase.rpc('fn_admin_delete_preset', { p_id: id });
}

// Mutation wrapper: invalida ambos listados (admin ve todos, users ven activos).
export function useInvalidatePresets() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ['admin', 'presets'] });
    qc.invalidateQueries({ queryKey: ['presets'] });
  };
}

export function usePresetMutations() {
  const invalidate = useInvalidatePresets();
  return {
    create: useMutation({ mutationFn: createAdminPreset, onSuccess: invalidate }),
    update: useMutation({ mutationFn: updateAdminPreset, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: deleteAdminPreset, onSuccess: invalidate }),
  };
}
