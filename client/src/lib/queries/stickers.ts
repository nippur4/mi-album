// Mutations sobre stickers (RPCs del backend) + hook de lectura.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/query-client';
import { toAppError, type AppError } from '@/lib/errors';
import type { Database } from '@/lib/database.types';
import type { Sticker } from '@/lib/queries/albums';

export type Rarity = Database['public']['Enums']['sticker_rarity'];

export interface AddStickerPayload {
  album_id: string;
  number: number;
  name: string;
  rarity: Rarity;
  thumb_key: string;
  large_key: string;
  traits?: Record<string, unknown>;
}

export async function addSticker(p: AddStickerPayload) {
  return supabase.rpc('fn_add_sticker', {
    p_album_id: p.album_id,
    p_number: p.number,
    p_name: p.name,
    p_rarity: p.rarity,
    p_thumb_key: p.thumb_key,
    p_large_key: p.large_key,
    p_traits: (p.traits ?? {}) as any,
  });
}

export interface UpdateStickerPayload {
  sticker_id: string;
  name?: string;
  rarity?: Rarity;
  thumb_key?: string;
  large_key?: string;
  traits?: Record<string, unknown>;
}

export async function updateSticker(p: UpdateStickerPayload) {
  // undefined omite el param → aplica el default null del RPC ("no tocar").
  return supabase.rpc('fn_update_sticker', {
    p_sticker_id: p.sticker_id,
    p_name: p.name ?? undefined,
    p_rarity: p.rarity ?? undefined,
    p_thumb_key: p.thumb_key ?? undefined,
    p_large_key: p.large_key ?? undefined,
    p_traits: (p.traits ?? undefined) as any,
  });
}

export async function deleteSticker(stickerId: string) {
  return supabase.rpc('fn_delete_sticker', { p_sticker_id: stickerId });
}

// Intercambia la posición (number) de dos casilleros del álbum. Si el destino
// está vacío es un move. Owner + draft only (gates en el RPC).
export async function swapStickerPositions(albumId: string, numberA: number, numberB: number) {
  return supabase.rpc('fn_swap_sticker_positions', {
    p_album_id: albumId,
    p_number_a: numberA,
    p_number_b: numberB,
  });
}

// Helpers de mutation con invalidación automática del detail del álbum.
export function useAddSticker(albumId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: addSticker,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.albums.detail(albumId) });
      qc.invalidateQueries({ queryKey: ['albums', 'progress'] });
    },
  });
}

export function useUpdateSticker(albumId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateSticker,
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: qk.stickers.one(vars.sticker_id) });
      qc.invalidateQueries({ queryKey: qk.albums.detail(albumId) });
    },
  });
}

export function useDeleteSticker(albumId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteSticker,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.albums.detail(albumId) });
      qc.invalidateQueries({ queryKey: ['albums', 'progress'] });
    },
  });
}

export function useSticker(id: string | undefined) {
  const q = useQuery({
    queryKey: qk.stickers.one(id),
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stickers')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw toAppError(error);
      return (data ?? null) as Sticker | null;
    },
  });
  return {
    sticker: q.data ?? null,
    isLoading: q.isLoading,
    error: (q.error as AppError | null) ?? null,
    refetch: q.refetch,
  };
}
