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
