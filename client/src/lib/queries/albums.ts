// Queries y mutations sobre la tabla albums.
//
// Convención del proyecto:
//   - LECTURAS van directo a supabase.from() (RLS filtra por owner/membership).
//   - MUTACIONES pasan por supabase.rpc() (las RPC tienen toda la lógica + gates).

import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { toAppError, type AppError } from '@/lib/errors';
import type { Database } from '@/lib/database.types';

export type Album = Database['public']['Tables']['albums']['Row'];
export type Sticker = Database['public']['Tables']['stickers']['Row'];

// Los álbumes que el usuario actual creó (es decir, donde es owner).
export function useMyOwnedAlbums() {
  const { session } = useSession();
  const ownerId = session?.user.id;

  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const refetch = useCallback(async () => {
    if (!ownerId) {
      setAlbums([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from('albums')
      .select('*')
      .eq('owner_id', ownerId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false });
    if (error) {
      setError(toAppError(error));
    } else {
      setAlbums((data ?? []) as Album[]);
      setError(null);
    }
    setIsLoading(false);
  }, [ownerId]);

  useEffect(() => { refetch(); }, [refetch]);

  return { albums, isLoading, error, refetch };
}

export async function createAlbum(name: string, totalStickers: number) {
  return supabase.rpc('fn_create_album', {
    p_name: name,
    p_total_stickers: totalStickers,
  });
}

export interface UpdateAlbumContentPatch {
  name?: string;
  total_stickers?: number;
  cover_thumb_key?: string;
  cover_large_key?: string;
  pack_thumb_key?: string;
  pack_large_key?: string;
}

export async function updateAlbumContent(albumId: string, patch: UpdateAlbumContentPatch) {
  return supabase.rpc('fn_update_album_content', {
    p_album_id: albumId,
    p_name: patch.name ?? null,
    p_total_stickers: patch.total_stickers ?? null,
    p_cover_thumb_key: patch.cover_thumb_key ?? null,
    p_cover_large_key: patch.cover_large_key ?? null,
    p_pack_thumb_key: patch.pack_thumb_key ?? null,
    p_pack_large_key: patch.pack_large_key ?? null,
  });
}

export async function publishAlbum(albumId: string) {
  return supabase.rpc('fn_publish_album', { p_album_id: albumId });
}

// Detalle de un álbum: el album + sus stickers cargados (por número).
export function useAlbumDetail(id: string | undefined) {
  const [album, setAlbum] = useState<Album | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  const refetch = useCallback(async () => {
    if (!id) {
      setAlbum(null);
      setStickers([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const [albumRes, stickersRes] = await Promise.all([
      supabase.from('albums').select('*').eq('id', id).maybeSingle(),
      supabase.from('stickers').select('*').eq('album_id', id).order('number', { ascending: true }),
    ]);
    if (albumRes.error) {
      setError(toAppError(albumRes.error));
    } else {
      setAlbum((albumRes.data ?? null) as Album | null);
      setError(null);
    }
    if (!stickersRes.error) {
      setStickers((stickersRes.data ?? []) as Sticker[]);
    }
    setIsLoading(false);
  }, [id]);

  useEffect(() => { refetch(); }, [refetch]);

  return { album, stickers, isLoading, error, refetch };
}
