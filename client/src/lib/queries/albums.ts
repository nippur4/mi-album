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

export interface AlbumProgress {
  album_id: string;
  total_stickers: number;
  stickers_loaded: number;
  my_pasted_count: number;
}

// Hook que devuelve un map albumId → progress para los IDs pasados.
// Re-fetcha cuando cambia la lista de IDs.
export function useAlbumsProgress(ids: string[]) {
  const [progress, setProgress] = useState<Record<string, AlbumProgress>>({});
  const key = ids.slice().sort().join(',');

  useEffect(() => {
    let mounted = true;
    if (ids.length === 0) {
      setProgress({});
      return;
    }
    supabase.rpc('fn_album_progress', { p_album_ids: ids }).then(({ data }) => {
      if (!mounted) return;
      const map: Record<string, AlbumProgress> = {};
      for (const row of (data ?? []) as AlbumProgress[]) {
        map[row.album_id] = row;
      }
      setProgress(map);
    });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return progress;
}

// Álbumes públicos publicados (RLS los expone a todos).
export function usePublicAlbums() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('albums')
      .select('*')
      .eq('is_public', true)
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(20);
    setAlbums((data ?? []) as Album[]);
    setIsLoading(false);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { albums, isLoading, refetch };
}

// Álbumes donde el usuario se unió (membership) pero NO es el owner.
export function useMyMemberAlbums() {
  const { session } = useSession();
  const uid = session?.user.id;

  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!uid) {
      setAlbums([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data: memberships } = await supabase
      .from('user_album_membership')
      .select('album_id')
      .eq('user_id', uid);
    const ids = (memberships ?? []).map((m: any) => m.album_id);
    if (ids.length === 0) {
      setAlbums([]);
      setIsLoading(false);
      return;
    }
    const { data: albumsData } = await supabase
      .from('albums')
      .select('*')
      .in('id', ids)
      .neq('status', 'archived')
      .order('created_at', { ascending: false });
    setAlbums((albumsData ?? []) as Album[]);
    setIsLoading(false);
  }, [uid]);

  useEffect(() => { refetch(); }, [refetch]);

  return { albums, isLoading, refetch };
}

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

// Unirse a un álbum por código. Acepta el código solo o el deep link completo.
export async function joinAlbumByCode(rawInput: string) {
  const code = extractShareCode(rawInput);
  if (!code) return { data: null, error: { code: 'P0080', message: 'share_code_required' } as any };
  return supabase.rpc('fn_join_album', { p_share_code: code });
}

function extractShareCode(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // mialbum://join/CODE  or  https://.../join/CODE
  const m = trimmed.match(/(?:join\/)([A-Z0-9]+)/i);
  if (m) return m[1].toUpperCase();
  // Código suelto: chars válidos del alfabeto definido en fn_gen_share_code
  if (/^[A-Z0-9]+$/i.test(trimmed)) return trimmed.toUpperCase();
  return null;
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
