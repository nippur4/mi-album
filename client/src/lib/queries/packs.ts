// Wrapper sobre la Edge Function open_pack + helpers.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { callEdgeFunction } from '@/lib/edge';
import { supabase } from '@/lib/supabase';

export interface OpenedSticker {
  sticker_id: string;
  number: number;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  large_key: string;
  was_new: boolean;
}

// Trae el próximo pack sin abrir del user en un álbum.
export async function fetchNextUnopenedPack(albumId: string): Promise<string | null> {
  const { data } = await supabase
    .from('packs')
    .select('id')
    .eq('album_id', albumId)
    .is('opened_at', null)
    .order('granted_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function openPack(packId: string): Promise<OpenedSticker[]> {
  const body = await callEdgeFunction<{ stickers?: OpenedSticker[] }>('open_pack', {
    pack_id: packId,
  });
  return body.stickers ?? [];
}

export async function pasteSticker(stickerId: string) {
  return supabase.rpc('fn_paste_sticker', { p_sticker_id: stickerId });
}

// Mutation wrapper: al pegar, invalida el side data del álbum (colección y
// progreso cambiaron) + el listado de sobres pendientes por si el flujo
// venía desde /pack/open y ya no queda ninguno.
export function usePasteSticker(albumId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: pasteSticker,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['player-album', 'sidedata', albumId] });
      qc.invalidateQueries({ queryKey: ['albums', 'progress'] });
      // Pegar en el álbum de avatares puede desbloquear un avatar.
      qc.invalidateQueries({ queryKey: ['avatars', 'unlocks'] });
    },
  });
}
