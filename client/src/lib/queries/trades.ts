// Queries y mutations del sistema de intercambios.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { qk } from '@/lib/query-client';
import { toAppError } from '@/lib/errors';
import type { Database } from '@/lib/database.types';
import type { Sticker } from '@/lib/queries/albums';

export type TradeStatus = Database['public']['Enums']['trade_status'];

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
  offered_sticker: Sticker | null;
  requested_sticker_id: string;
  requested_sticker: Sticker | null;
  status: TradeStatus;
  created_at: string;
  resolved_at: string | null;
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
export function useMyOffers() {
  const { session } = useSession();
  const uid = session?.user.id;

  const q = useQuery({
    queryKey: ['trades', 'offers', uid ?? 'anon'] as const,
    enabled: !!uid,
    staleTime: 15_000,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('trade_offers')
        .select(`
          *,
          from_profile:profiles!trade_offers_from_user_fkey(display_name, avatar_url),
          to_profile:profiles!trade_offers_to_user_fkey(display_name, avatar_url),
          offered:stickers!trade_offers_offered_sticker_id_fkey(*),
          requested:stickers!trade_offers_requested_sticker_id_fkey(*),
          album:albums!trade_offers_album_id_fkey(name)
        `)
        .or(`from_user.eq.${uid},to_user.eq.${uid}`)
        .order('created_at', { ascending: false });
      if (error) throw toAppError(error);

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
        offered_sticker: (o.offered as Sticker | null) ?? null,
        requested_sticker_id: o.requested_sticker_id,
        requested_sticker: (o.requested as Sticker | null) ?? null,
        status: o.status,
        created_at: o.created_at,
        resolved_at: o.resolved_at,
      }));

      return {
        received: enriched.filter((o) => o.to_user === uid),
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
