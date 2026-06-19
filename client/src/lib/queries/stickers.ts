// Mutations sobre stickers (RPCs del backend) + hook de lectura.

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
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
  return supabase.rpc('fn_update_sticker', {
    p_sticker_id: p.sticker_id,
    p_name: p.name ?? null,
    p_rarity: p.rarity ?? null,
    p_thumb_key: p.thumb_key ?? null,
    p_large_key: p.large_key ?? null,
    p_traits: (p.traits ?? null) as any,
  });
}

export async function deleteSticker(stickerId: string) {
  return supabase.rpc('fn_delete_sticker', { p_sticker_id: stickerId });
}

export function useSticker(id: string | undefined) {
  const [sticker, setSticker] = useState<Sticker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setSticker(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('stickers')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) setError(toAppError(error));
    else setSticker((data ?? null) as Sticker | null);
    setIsLoading(false);
  }, [id]);

  useEffect(() => { refetch(); }, [refetch]);

  return { sticker, isLoading, error, refetch };
}
