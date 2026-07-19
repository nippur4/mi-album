// Wrapper sobre la Edge Function open_pack + helpers.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

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

// --- Sobres por publicidad (solo álbumes especiales, Android) ---------------

export interface AdPackStatus {
  enabled: boolean;   // false si el álbum no ofrece ads o no sos miembro
  used: number;       // ads usados hoy (global entre los álbumes con ads)
  remaining: number;
  limit: number;
}

export function useAdPackStatus(albumId: string | undefined, enabled = true) {
  const q = useQuery({
    queryKey: ['ad-packs', 'status', albumId],
    enabled: !!albumId && enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_ad_pack_status', {
        p_album_id: albumId!,
      });
      if (error) throw error;
      return data as unknown as AdPackStatus;
    },
  });
  return { adStatus: q.data ?? null, refetchAdStatus: q.refetch };
}

// El server valida elegibilidad + tope 2/día (fn_claim_ad_pack).
export async function claimAdPack(albumId: string) {
  return supabase.rpc('fn_claim_ad_pack', { p_album_id: albumId });
}

// Resumen batch para el tab Sobres: qué álbumes del caller ofrecen ads +
// el cupo global restante de hoy, en 1 solo round trip (evita N+1 por fila).
export interface AdPackSummary {
  albumIds: Set<string>;
  used: number;
  remaining: number;
  limit: number;
}

export function useAdPackSummary(enabled = true) {
  const q = useQuery({
    queryKey: ['ad-packs', 'summary'],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<AdPackSummary> => {
      const { data, error } = await supabase.rpc('fn_ad_pack_summary');
      if (error) throw error;
      const raw = data as unknown as {
        album_ids: string[];
        used: number;
        remaining: number;
        limit: number;
      };
      return {
        albumIds: new Set(raw.album_ids ?? []),
        used: raw.used,
        remaining: raw.remaining,
        limit: raw.limit,
      };
    },
  });
  return { adSummary: q.data ?? null, refetchAdSummary: q.refetch };
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
