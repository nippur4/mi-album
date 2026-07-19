// Queries y mutations del sistema de intercambios.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { qk } from '@/lib/query-client';
import { toAppError } from '@/lib/errors';
import type { Database } from '@/lib/database.types';
import type { Sticker } from '@/lib/queries/albums';

export type TradeStatus = Database['public']['Enums']['trade_status'];

// Proyección mínima del sticker embebido en una oferta: lo que renderiza
// TradeOfferCard (StickerMini). El sticker completo se baja aparte si hace falta.
export interface TradeSticker {
  id: string;
  number: number;
  name: string;
  rarity: Sticker['rarity'];
  thumb_key: string;
}

export interface TradeOffer {
  id: string;
  album_id: string;
  album_name: string;
  from_user: string;
  from_user_name: string;
  from_user_avatar_url: string | null;
  to_user: string;
  to_user_name: string;
  to_user_avatar_url: string | null;
  offered_sticker_id: string;
  offered_sticker: TradeSticker | null;
  requested_sticker_id: string;
  requested_sticker: TradeSticker | null;
  status: TradeStatus;
  created_at: string;
  resolved_at: string | null;
  // true si el EMISOR de la oferta agotó su tope de cambios de la ventana
  // (fn_my_offer_flags). En Recibidas esas ofertas se filtran (no se pueden
  // aceptar); en Enviadas se muestran con la nota "el otro no la ve".
  sender_blocked?: boolean;
}

export interface AlbumMatch {
  other_user_id: string;
  other_user_name: string;
  other_user_avatar_url: string | null;
  they_give_sticker_id: string;
  they_give_sticker_number: number;
  they_give_sticker_name: string;
  they_give_sticker_rarity: Sticker['rarity'];
  they_give_sticker_thumb_key: string;
  i_give_sticker_id: string;
  i_give_sticker_number: number;
  i_give_sticker_name: string;
  i_give_sticker_rarity: Sticker['rarity'];
  i_give_sticker_thumb_key: string;
}

// Ofertas donde el caller participa (from o to). Antes hidrataba con 3
// queries extra (profiles + stickers + albums); ahora PostgREST embebe las
// relaciones con hints de FK en un solo round trip. RLS aplica igual en las
// tablas embebidas (misma visibilidad que las queries separadas).
// Columnas explícitas (no `*`): las cards usan un puñado de campos y los
// stickers completos traían traits/keys/timestamps que eran egress puro.
export function useMyOffers() {
  const { session } = useSession();
  const uid = session?.user.id;

  const q = useQuery({
    queryKey: ['trades', 'offers', uid ?? 'anon'] as const,
    enabled: !!uid,
    staleTime: 15_000,
    queryFn: async () => {
      // Flags de visibilidad en paralelo: qué ofertas pending tienen a su
      // emisor bloqueado por el tope de cambios (solo computable server-side:
      // el conteo mira trades del emisor, invisibles por RLS para el otro).
      const [offersRes, flagsRes] = await Promise.all([
        supabase
          .from('trade_offers')
          .select(`
            id, album_id, from_user, to_user, offered_sticker_id, requested_sticker_id,
            status, created_at, resolved_at,
            from_profile:profiles!trade_offers_from_user_fkey(display_name, avatar_url),
            to_profile:profiles!trade_offers_to_user_fkey(display_name, avatar_url),
            offered:stickers!trade_offers_offered_sticker_id_fkey(id, number, name, rarity, thumb_key),
            requested:stickers!trade_offers_requested_sticker_id_fkey(id, number, name, rarity, thumb_key),
            album:albums!trade_offers_album_id_fkey(name)
          `)
          .or(`from_user.eq.${uid},to_user.eq.${uid}`)
          .order('created_at', { ascending: false }),
        supabase.rpc('fn_my_offer_flags'),
      ]);
      const { data: rows, error } = offersRes;
      if (error) throw toAppError(error);
      // Best-effort: si los flags fallan, mostramos todo (peor caso: el
      // receptor choca con el error al aceptar, como antes de 0060).
      const blockedByOffer = new Map<string, boolean>(
        ((flagsRes.data ?? []) as { offer_id: string; sender_blocked: boolean }[]).map(
          (f) => [f.offer_id, f.sender_blocked],
        ),
      );

      const enriched: TradeOffer[] = ((rows ?? []) as any[]).map((o) => ({
        id: o.id,
        album_id: o.album_id,
        album_name: o.album?.name ?? '',
        from_user: o.from_user,
        from_user_name: o.from_profile?.display_name ?? '',
        from_user_avatar_url: o.from_profile?.avatar_url ?? null,
        to_user: o.to_user,
        to_user_name: o.to_profile?.display_name ?? '',
        to_user_avatar_url: o.to_profile?.avatar_url ?? null,
        offered_sticker_id: o.offered_sticker_id,
        offered_sticker: (o.offered as TradeSticker | null) ?? null,
        requested_sticker_id: o.requested_sticker_id,
        requested_sticker: (o.requested as TradeSticker | null) ?? null,
        status: o.status,
        created_at: o.created_at,
        resolved_at: o.resolved_at,
        sender_blocked: blockedByOffer.get(o.id) ?? false,
      }));

      return {
        // Recibidas: ocultamos las pending cuyo emisor agotó su tope (quedaron
        // de antes de agotarlo; aceptarlas fallaría). Cuando su ventana rueda,
        // reaparecen solas. El historial resuelto no se toca.
        received: enriched.filter(
          (o) => o.to_user === uid && !(o.status === 'pending' && o.sender_blocked),
        ),
        sent: enriched.filter((o) => o.from_user === uid),
      };
    },
  });
  return {
    received: q.data?.received ?? [],
    sent: q.data?.sent ?? [],
    isLoading: q.isLoading,
    isRefetching: q.isRefetching,
    refetch: q.refetch,
  };
}

export function useAlbumMatches(albumId: string | undefined) {
  const q = useQuery({
    queryKey: qk.trades.matches(albumId ?? ''),
    enabled: !!albumId,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_album_matches', {
        p_album_id: albumId!,
        p_limit: 100,
      });
      if (error) throw toAppError(error);
      return ((data ?? []) as any[]) as AlbumMatch[];
    },
  });
  return { matches: q.data ?? [], isLoading: q.isLoading, refetch: q.refetch };
}

// Reglas de intercambio del álbum para el jugador: si está habilitado, el tope
// por período y cuántos cambios le quedan. Espeja fn_trade_limit_status.
export interface TradeLimitStatus {
  enabled: boolean;
  unlimited: boolean;
  count?: number;
  period?: 'day' | 'week' | 'month';
  used?: number;
  remaining?: number;
}

export function useTradeLimitStatus(albumId: string | undefined) {
  const q = useQuery({
    queryKey: ['trades', 'limit-status', albumId ?? ''] as const,
    enabled: !!albumId,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_trade_limit_status', {
        p_album_id: albumId!,
      });
      if (error) throw toAppError(error);
      return (data ?? null) as TradeLimitStatus | null;
    },
  });
  return { status: q.data ?? null, isLoading: q.isLoading, refetch: q.refetch };
}

// Settings de intercambio del jugador en un álbum (seguir cambiando con álbum
// completo / aceptar figuritas que ya tiene). Se editan desde la pantalla CAMBIOS.
export async function setTradePrefs(
  albumId: string,
  tradeWhenComplete: boolean,
  acceptOwned: boolean,
) {
  return supabase.rpc('fn_set_trade_prefs', {
    p_album_id: albumId,
    p_trade_when_complete: tradeWhenComplete,
    p_accept_owned: acceptOwned,
  });
}

export async function createTradeOffer(args: {
  album_id: string;
  to_user: string;
  offered_sticker_id: string;
  requested_sticker_id: string;
}) {
  return supabase.rpc('fn_create_trade_offer', {
    p_album_id: args.album_id,
    p_to_user: args.to_user,
    p_offered_sticker_id: args.offered_sticker_id,
    p_requested_sticker_id: args.requested_sticker_id,
  });
}

export async function resolveTradeOffer(offerId: string, action: 'accept' | 'reject' | 'cancel') {
  return supabase.rpc('fn_resolve_trade_offer', {
    p_offer_id: offerId,
    p_action: action,
  });
}

// Mutations con invalidación automática de las ofertas y matches.
export function useCreateTradeOffer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTradeOffer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trades'] });
    },
  });
}

export function useResolveTradeOffer(albumId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { offerId: string; action: 'accept' | 'reject' | 'cancel' }) =>
      resolveTradeOffer(args.offerId, args.action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trades'] });
      // Aceptar transfiere colección — invalidamos el side data del álbum.
      if (albumId) {
        qc.invalidateQueries({ queryKey: qk.playerAlbum.sideData(albumId) });
      }
    },
  });
}
