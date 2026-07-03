// Queries y mutations del sistema de intercambios.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { qk } from '@/lib/query-client';
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

// Ofertas donde el caller participa (from o to). Hidrata con profiles + stickers + album_name.
export function useMyOffers() {
  const { session } = useSession();
  const uid = session?.user.id;

  const q = useQuery({
    queryKey: ['trades', 'offers', uid ?? 'anon'] as const,
    enabled: !!uid,
    staleTime: 15_000,
    queryFn: async () => {
      const { data: rows } = await supabase
        .from('trade_offers')
        .select('*')
        .or(`from_user.eq.${uid},to_user.eq.${uid}`)
        .order('created_at', { ascending: false });

      if (!rows || rows.length === 0) {
        return { received: [] as TradeOffer[], sent: [] as TradeOffer[] };
      }

      const profileIds = new Set<string>();
      const stickerIds = new Set<string>();
      const albumIds = new Set<string>();
      for (const o of rows as any[]) {
        profileIds.add(o.from_user);
        profileIds.add(o.to_user);
        stickerIds.add(o.offered_sticker_id);
        stickerIds.add(o.requested_sticker_id);
        albumIds.add(o.album_id);
      }

      const [profilesRes, stickersRes, albumsRes] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url').in('id', Array.from(profileIds)),
        supabase.from('stickers').select('*').in('id', Array.from(stickerIds)),
        supabase.from('albums').select('id, name').in('id', Array.from(albumIds)),
      ]);

      const profiles = new Map<string, any>((profilesRes.data ?? []).map((p: any) => [p.id, p]));
      const stickers = new Map<string, Sticker>(((stickersRes.data ?? []) as any[]).map((s) => [s.id, s as Sticker]));
      const albums = new Map<string, any>((albumsRes.data ?? []).map((a: any) => [a.id, a]));

      const enriched: TradeOffer[] = (rows as any[]).map((o) => ({
        id: o.id,
        album_id: o.album_id,
        album_name: albums.get(o.album_id)?.name ?? '',
        from_user: o.from_user,
        from_user_name: profiles.get(o.from_user)?.display_name ?? '',
        from_user_avatar_url: profiles.get(o.from_user)?.avatar_url ?? null,
        to_user: o.to_user,
        to_user_name: profiles.get(o.to_user)?.display_name ?? '',
        to_user_avatar_url: profiles.get(o.to_user)?.avatar_url ?? null,
        offered_sticker_id: o.offered_sticker_id,
        offered_sticker: stickers.get(o.offered_sticker_id) ?? null,
        requested_sticker_id: o.requested_sticker_id,
        requested_sticker: stickers.get(o.requested_sticker_id) ?? null,
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
    refetch: q.refetch,
  };
}

export function useAlbumMatches(albumId: string | undefined) {
  const q = useQuery({
    queryKey: qk.trades.matches(albumId ?? ''),
    enabled: !!albumId,
    staleTime: 15_000,
    queryFn: async () => {
      const { data } = await supabase.rpc('fn_album_matches', {
        p_album_id: albumId!,
        p_limit: 100,
      });
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
