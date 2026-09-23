// Queries del panel admin.
//
// El gateo real está en el backend (fn_admin_list_published_albums y
// fn_set_album_public chequean is_admin). El cliente usa useIsAdmin solo para
// mostrar/ocultar el acceso al panel — no es una garantía de seguridad.

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/query-client';
import { useMyProfile } from '@/lib/queries/profile';

export interface AdminAlbumRow {
  id: string;
  name: string;
  owner_id: string;
  owner_name: string;
  status: 'draft' | 'published' | 'read_only' | 'archived';
  is_public: boolean;
  total_stickers: number;
  published_at: string | null;
  created_at: string;
  member_count: number;
  // Orden en el carrusel de públicos: mayor = aparece antes (0 = sin fijar).
  public_rank: number;
  // Solicitud del owner de ser público (null = sin pedido). Ver migración 0074.
  public_requested_at: string | null;
  // Motivo de la solicitud de público (migración 0075).
  public_request_note: string | null;
  // Bloqueado por moderación (null = activo). Reversible. Migración 0075.
  blocked_at: string | null;
  // Reports sin resolver de este álbum.
  report_count: number;
}

// Un álbum con reports sin resolver, para el panel de moderación (migr 0075).
export interface AdminReportRow {
  album_id: string;
  album_name: string;
  owner_id: string;
  owner_name: string;
  status: 'draft' | 'published' | 'read_only' | 'archived';
  is_public: boolean;
  blocked_at: string | null;
  report_count: number;
  last_reported_at: string;
  reports: { reason: string; details: string | null; reporter: string | null; created_at: string }[];
}

// El ProfileProvider ya trae is_admin en su fetch del profile — derivamos de
// ahí en vez de repetir la misma query contra profiles.
export function useIsAdmin() {
  const { profile, isLoading } = useMyProfile();
  return { isAdmin: !!profile?.is_admin, isLoading };
}

export function useAdminAlbums() {
  const q = useQuery({
    queryKey: qk.admin.albums(),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_admin_list_albums');
      if (error) throw error;
      return ((data ?? []) as any[]) as AdminAlbumRow[];
    },
  });
  return {
    albums: q.data ?? [],
    isLoading: q.isLoading,
    isRefetching: q.isRefetching,
    error: q.error ? (q.error as any).message : null,
    refetch: q.refetch,
  };
}

export interface AdminStatsTotals {
  total_users: number;
  new_users_7d: number;
  total_albums: number;
  published_albums: number;
  total_stickers: number;
  stickers_owned: number;
  stickers_pasted: number;
  total_memberships: number;
  avg_players_per_album: number | null;
  packs_opened: number;
  packs_pending: number;
  trades_accepted: number;
  trades_pending: number;
}

export interface AdminStatsDaily {
  day: string;      // 'YYYY-MM-DD' (hora argentina)
  signups: number;
  logins: number;
  active: number;   // actores distintos con login o token_refreshed (proxy DAU)
}

export interface AdminStats {
  totals: AdminStatsTotals;
  daily: AdminStatsDaily[];
}

export function useAdminStats() {
  const q = useQuery({
    queryKey: qk.admin.stats(),
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_admin_stats');
      if (error) throw error;
      return data as unknown as AdminStats;
    },
  });
  return {
    stats: q.data ?? null,
    isLoading: q.isLoading,
    isRefetching: q.isRefetching,
    error: q.error ? (q.error as any).message : null,
    refetch: q.refetch,
  };
}

export async function setAlbumPublic(albumId: string, isPublic: boolean) {
  return supabase.rpc('fn_set_album_public', {
    p_album_id: albumId,
    p_is_public: isPublic,
  });
}

// Fija el orden del álbum en el carrusel de públicos (mayor = antes).
export async function setAlbumPublicRank(albumId: string, rank: number) {
  return supabase.rpc('fn_set_album_public_rank', {
    p_album_id: albumId,
    p_rank: rank,
  });
}

// Descarta la solicitud de público de un owner (sin hacerlo público).
// Cast `as any` hasta regenerar los tipos post-migración 0074.
export async function rejectAlbumPublicRequest(albumId: string) {
  return (supabase.rpc as any)('fn_reject_album_public_request', {
    p_album_id: albumId,
  });
}

// --- Moderación de álbumes (admin, migración 0075) --------------------------

// Reports sin resolver, agrupados por álbum (con detalle de cada reporte).
export function useAdminReports() {
  const q = useQuery({
    queryKey: ['admin', 'reports'] as const,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('fn_admin_list_album_reports');
      if (error) throw error;
      return ((data ?? []) as any[]) as AdminReportRow[];
    },
  });
  return {
    reports: q.data ?? [],
    isLoading: q.isLoading,
    isRefetching: q.isRefetching,
    error: q.error ? (q.error as any).message : null,
    refetch: q.refetch,
  };
}

// Bloquear (reversible) / desbloquear un álbum: lo saca del carrusel y frena joins.
export async function blockAlbum(albumId: string) {
  return (supabase.rpc as any)('fn_admin_block_album', { p_album_id: albumId });
}
export async function unblockAlbum(albumId: string) {
  return (supabase.rpc as any)('fn_admin_unblock_album', { p_album_id: albumId });
}

// Borrar un álbum definitivo (cascade). Protege los especiales curados server-side.
export async function adminDeleteAlbum(albumId: string) {
  return (supabase.rpc as any)('fn_admin_delete_album', { p_album_id: albumId });
}

// Marca resueltos todos los reports de un álbum (los saca del listado).
export async function resolveAlbumReports(albumId: string) {
  return (supabase.rpc as any)('fn_admin_resolve_album_reports', { p_album_id: albumId });
}
