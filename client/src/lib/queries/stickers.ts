// Mutations sobre stickers (RPCs del backend) + hook de lectura.

import { useQuery, type QueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/query-client';
import { toAppError, type AppError } from '@/lib/errors';
import type { Database } from '@/lib/database.types';
import type { Album, Sticker } from '@/lib/queries/albums';

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

// Índice liviano (id + number) de todas las figuritas de un álbum, para el
// paginador prev/next de la vista grande. Cacheado por álbum: navegar entre
// figuritas ya no re-consulta la lista (clave para el álbum de 1001 filas).
export interface StickerIndexEntry {
  id: string;
  number: number;
}

export function useAlbumStickerIndex(albumId: string | undefined) {
  const q = useQuery({
    queryKey: ['stickers', 'index', albumId] as const,
    enabled: !!albumId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stickers')
        .select('id, number')
        .eq('album_id', albumId!)
        .order('number', { ascending: true });
      if (error) throw toAppError(error);
      return (data ?? []) as StickerIndexEntry[];
    },
  });
  return { index: q.data ?? [], isLoading: q.isLoading };
}

// ============================================================================
// Cache: refresco después de mutar figuritas
// ============================================================================
//
// Las mutaciones de figuritas las dispara un formulario (no un useMutation),
// así que el refresco del cache vive acá y lo comparten los tres callers
// (alta, edición, borrado). Antes NO se tocaba nada: el owner volvía a la
// grilla y seguía viendo el estado viejo hasta que venciera el staleTime del
// detalle (30s en draft) Y la pantalla volviera a recibir foco — como ya
// estaba enfocada, en la práctica tardaba muchísimo o no pasaba nunca.
//
// Parcheamos en memoria en vez de invalidar: el detalle baja el álbum + TODAS
// sus figuritas (hasta 1001 filas), y re-bajarlo por cada figurita cargada es
// caro al pedo cuando sabemos exactamente qué cambió. Las RPC devuelven/
// aceptan justo los campos de la fila, así que el parche es fiel al server
// (`fn_add_sticker` solo agrega el id y el created_at).

interface AlbumDetailCache {
  album: Album | null;
  stickers: Sticker[];
}

const byNumber = (a: { number: number }, b: { number: number }) => a.number - b.number;

function patchDetail(qc: QueryClient, albumId: string, fn: (list: Sticker[]) => Sticker[]) {
  qc.setQueryData<AlbumDetailCache>(qk.albums.detail(albumId), (prev) =>
    prev ? { ...prev, stickers: fn(prev.stickers) } : prev,
  );
}

function patchIndex(
  qc: QueryClient,
  albumId: string,
  fn: (list: StickerIndexEntry[]) => StickerIndexEntry[],
) {
  qc.setQueryData<StickerIndexEntry[]>(['stickers', 'index', albumId], (prev) =>
    prev ? fn(prev) : prev,
  );
}

// El conteo "X / Y cargadas" de los listados (tab Gestionar) sale de una RPC
// aparte y liviana: esa sí la invalidamos.
function invalidateProgress(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['albums', 'progress'] });
}

export function cacheStickerAdded(qc: QueryClient, sticker: Sticker) {
  patchDetail(qc, sticker.album_id, (list) =>
    [...list.filter((s) => s.id !== sticker.id), sticker].sort(byNumber),
  );
  patchIndex(qc, sticker.album_id, (list) =>
    [...list.filter((s) => s.id !== sticker.id), { id: sticker.id, number: sticker.number }].sort(byNumber),
  );
  qc.setQueryData(qk.stickers.one(sticker.id), sticker);
  invalidateProgress(qc);
}

export function cacheStickerUpdated(qc: QueryClient, sticker: Sticker) {
  // El número no se edita (fn_update_sticker no lo toca), así que alcanza con
  // reemplazar la fila en su lugar — el índice del paginador no cambia.
  patchDetail(qc, sticker.album_id, (list) =>
    list.map((s) => (s.id === sticker.id ? sticker : s)),
  );
  qc.setQueryData(qk.stickers.one(sticker.id), sticker);
}

export function cacheStickerRemoved(qc: QueryClient, albumId: string, stickerId: string) {
  patchDetail(qc, albumId, (list) => list.filter((s) => s.id !== stickerId));
  patchIndex(qc, albumId, (list) => list.filter((s) => s.id !== stickerId));
  // removeQueries y no setQueryData(null): la figurita ya no existe, que la
  // próxima lectura (si queda alguna pantalla apuntando) vaya al server.
  qc.removeQueries({ queryKey: qk.stickers.one(stickerId) });
  invalidateProgress(qc);
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
