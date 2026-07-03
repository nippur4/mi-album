// Queries y mutations sobre la tabla albums.
//
// Convención del proyecto:
//   - LECTURAS van directo a supabase.from() (RLS filtra por owner/membership).
//   - MUTACIONES pasan por supabase.rpc() (las RPC tienen toda la lógica + gates).
//
// Todos los hooks de lectura usan @tanstack/react-query — se comparten
// resultados entre callers del mismo queryKey (dedup), cache con staleTime,
// refetch on window focus, e invalidación selectiva desde mutations.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { toAppError, type AppError } from '@/lib/errors';
import { qk } from '@/lib/query-client';
import type { Database } from '@/lib/database.types';

export type Album = Database['public']['Tables']['albums']['Row'];
export type Sticker = Database['public']['Tables']['stickers']['Row'];

export interface AlbumProgress {
  album_id: string;
  total_stickers: number;
  stickers_loaded: number;
  my_pasted_count: number;
}

// Devuelve un map albumId → progress. Como es data batch, empty ids devuelve
// mapa vacío sin llamar al server. Compat con la API anterior (progress,
// refetch) para los callers actuales.
export function useAlbumsProgress(ids: string[]) {
  const q = useQuery({
    queryKey: qk.albums.progress(ids),
    enabled: ids.length > 0,
    staleTime: 10_000,
    queryFn: async () => {
      const { data } = await supabase.rpc('fn_album_progress', { p_album_ids: ids });
      const map: Record<string, AlbumProgress> = {};
      for (const row of (data ?? []) as AlbumProgress[]) {
        map[row.album_id] = row;
      }
      return map;
    },
  });
  return { progress: q.data ?? {}, refetch: q.refetch };
}

// Álbumes públicos publicados (RLS los expone a todos). Baja volatilidad.
export function usePublicAlbums() {
  const q = useQuery({
    queryKey: qk.albums.public(),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from('albums')
        .select('*')
        .eq('is_public', true)
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(20);
      return (data ?? []) as Album[];
    },
  });
  return { albums: q.data ?? [], isLoading: q.isLoading, refetch: q.refetch };
}

// Álbumes donde el usuario se unió (membership) pero NO es el owner.
// includeHidden=true trae también los álbumes que el jugador ocultó (hidden=true),
// y en el objeto de cada álbum incluye `__hidden: boolean` para que la UI sepa
// distinguirlos (marcar con badge, ofrecer unhide, etc.).
export function useMyMemberAlbums(options?: { includeHidden?: boolean }) {
  const includeHidden = options?.includeHidden ?? false;
  const { session } = useSession();
  const uid = session?.user.id;

  const q = useQuery({
    queryKey: [...qk.albums.member({ includeHidden }), uid ?? 'anon'] as const,
    enabled: !!uid,
    queryFn: async () => {
      let memQuery = supabase
        .from('user_album_membership')
        .select('album_id, hidden')
        .eq('user_id', uid!);
      if (!includeHidden) memQuery = memQuery.eq('hidden', false);
      const { data: memberships } = await memQuery;
      const ids = (memberships ?? []).map((m: any) => m.album_id);
      const hiddenByAlbum: Record<string, boolean> = {};
      for (const m of (memberships ?? []) as any[]) {
        hiddenByAlbum[m.album_id] = m.hidden === true;
      }
      if (ids.length === 0) return [] as (Album & { __hidden?: boolean })[];
      const { data: albumsData } = await supabase
        .from('albums')
        .select('*')
        .in('id', ids)
        .neq('status', 'archived')
        .order('created_at', { ascending: false });
      return ((albumsData ?? []) as Album[]).map((a) => ({
        ...a,
        __hidden: hiddenByAlbum[a.id] === true,
      }));
    },
  });
  return { albums: q.data ?? [], isLoading: q.isLoading, refetch: q.refetch };
}

// Los álbumes que el usuario actual creó (es decir, donde es owner).
// includeHidden=true trae también los que el owner archivó (owner_hidden=true).
// Se usa en el tab "Gestionar" cuando el toggle "mostrar archivados" está activo.
export function useMyOwnedAlbums(options?: { includeHidden?: boolean }) {
  const includeHidden = options?.includeHidden ?? false;
  const { session } = useSession();
  const ownerId = session?.user.id;

  const q = useQuery({
    queryKey: [...qk.albums.owned({ includeHidden }), ownerId ?? 'anon'] as const,
    enabled: !!ownerId,
    queryFn: async () => {
      let query = supabase
        .from('albums')
        .select('*')
        .eq('owner_id', ownerId!)
        .neq('status', 'archived');
      if (!includeHidden) query = query.eq('owner_hidden', false);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw toAppError(error);
      return (data ?? []) as Album[];
    },
  });
  return {
    albums: q.data ?? [],
    isLoading: q.isLoading,
    error: (q.error as AppError | null) ?? null,
    refetch: q.refetch,
  };
}

// Detalle de un álbum: el album + sus stickers cargados (por número).
export function useAlbumDetail(id: string | undefined) {
  const q = useQuery({
    queryKey: qk.albums.detail(id),
    enabled: !!id,
    queryFn: async () => {
      const [albumRes, stickersRes] = await Promise.all([
        supabase.from('albums').select('*').eq('id', id!).maybeSingle(),
        supabase.from('stickers').select('*').eq('album_id', id!).order('number', { ascending: true }),
      ]);
      if (albumRes.error) throw toAppError(albumRes.error);
      return {
        album: (albumRes.data ?? null) as Album | null,
        stickers: (stickersRes.data ?? []) as Sticker[],
      };
    },
  });
  return {
    album: q.data?.album ?? null,
    stickers: q.data?.stickers ?? [],
    isLoading: q.isLoading,
    error: (q.error as AppError | null) ?? null,
    refetch: q.refetch,
  };
}

// ============================================================================
// Mutations
// ============================================================================
//
// Los helpers `createAlbum`/`updateAlbumContent`/etc quedaron como funciones
// sueltas (sin hook) para que los callers en formularios sigan usando el
// mismo await pattern. La invalidación fina la hacen los callers via
// `useInvalidateAlbums()` — más flexible que un `useMutation` para casos
// como updateAlbumContent que puede impactar owned Y detail.

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

// Archivar/des-archivar como owner (setea albums.owner_hidden).
// Los jugadores no ven diferencia — siguen abriendo sobres y pegando normal.
export async function archiveAlbumByOwner(albumId: string) {
  return supabase.rpc('fn_archive_album_by_owner', { p_album_id: albumId });
}
export async function unarchiveAlbumByOwner(albumId: string) {
  return supabase.rpc('fn_unarchive_album_by_owner', { p_album_id: albumId });
}

// Ocultar/des-ocultar como jugador (setea user_album_membership.hidden).
// Solo afecta la UI de ese jugador; otros no ven diferencia.
export async function hideAlbumByPlayer(albumId: string) {
  return supabase.rpc('fn_hide_album_by_player', { p_album_id: albumId });
}
export async function unhideAlbumByPlayer(albumId: string) {
  return supabase.rpc('fn_unhide_album_by_player', { p_album_id: albumId });
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

// Helper para invalidar caches de álbum desde formularios/mutations.
// Uso típico:
//   const invalidate = useInvalidateAlbums();
//   await updateAlbumContent(id, patch);
//   invalidate.detail(id);      // el detail cambió
//   invalidate.owned();         // el listado de owner también (por si nombre/cover cambiaron)
export function useInvalidateAlbums() {
  const qc = useQueryClient();
  return {
    detail: (id: string) => qc.invalidateQueries({ queryKey: qk.albums.detail(id) }),
    owned: () => qc.invalidateQueries({ queryKey: ['albums', 'owned'] }),
    member: () => qc.invalidateQueries({ queryKey: ['albums', 'member'] }),
    public: () => qc.invalidateQueries({ queryKey: qk.albums.public() }),
    progress: () => qc.invalidateQueries({ queryKey: ['albums', 'progress'] }),
    all: () => qc.invalidateQueries({ queryKey: ['albums'] }),
  };
}

// Wrapper de useMutation para RPCs con invalidación por default.
// Uso: const { mutateAsync } = usePublishAlbum();
export function usePublishAlbum() {
  const invalidate = useInvalidateAlbums();
  return useMutation({
    mutationFn: (albumId: string) => publishAlbum(albumId),
    onSuccess: (_data, albumId) => {
      invalidate.detail(albumId);
      invalidate.owned();
    },
  });
}
