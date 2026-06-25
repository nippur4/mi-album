// Plantillas de imágenes (cover / pack) subidas por admins.
//
// Conviven con los gradientes hardcoded de lib/presets.ts. El picker muestra
// primero los gradientes locales y abajo las imágenes activas de admin
// filtradas por kind.

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

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
  const [items, setItems] = useState<PresetImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    supabase
      .from('preset_images')
      .select('*')
      .eq('kind', kind)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (cancelled) return;
        setItems((data ?? []) as PresetImage[]);
        setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [kind]);

  return { items, isLoading };
}

// Lista admin (incluye inactive). Vía RPC SECURITY DEFINER.
export function useAdminPresets() {
  const [items, setItems] = useState<PresetImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const { data, error } = await supabase.rpc('fn_admin_list_presets');
    if (error) {
      setError(error.message);
      setItems([]);
    } else {
      setItems(((data ?? []) as any[]) as PresetImage[]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { items, isLoading, error, refetch };
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
