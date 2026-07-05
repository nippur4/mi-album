// QueryClient singleton para react-query.
// Se comparte entre todas las queries de la app. Defaults sanos: 30s de
// staleTime (queries no re-fetchean si el data es "fresh"), 5 min de gcTime
// (cache se libera si nada la referencia por 5 min).
//
// Por-query se overridea con `staleTime` específico donde tenga sentido:
//   - Data muy volátil (progreso, daily): 10s
//   - Data casi inmutable (public albums, presets): 5min
//   - Data que solo cambia por mutation nuestra (profile, isPro): Infinity
//     (se invalida manualmente al mutar)

import { AppState, Platform } from 'react-native';
import { focusManager, QueryClient } from '@tanstack/react-query';

// React Native no emite eventos de window focus, así que refetchOnWindowFocus
// era un no-op en nativo: le enseñamos a react-query a usar AppState (app
// vuelve a foreground → queries stale refetchean). En web el listener default
// (visibilitychange) ya funciona, no lo pisamos.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (status) => {
    focusManager.setFocused(status === 'active');
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // Los defaults de retry (3 con backoff exp) son razonables para HTTP
      // pero para errores de negocio (RLS deniega, RPC tira P00xx) no queremos
      // reintentar. Preferimos que el caller vea el error inmediatamente.
      retry: (failureCount, error: any) => {
        const code = error?.code ?? error?.raw?.code;
        // Postgres errcodes de negocio son P0xxx.
        if (typeof code === 'string' && code.startsWith('P0')) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: true,
    },
  },
});

// Query keys centralizados: previene typos y facilita invalidaciones amplias.
// Convención: [entidad, ...scope].
export const qk = {
  albums: {
    owned: (opts?: { includeHidden?: boolean }) => ['albums', 'owned', opts?.includeHidden ?? false] as const,
    detail: (id: string | undefined) => ['albums', 'detail', id] as const,
    progress: (ids: string[]) => ['albums', 'progress', ids.slice().sort().join(',')] as const,
  },
  stickers: {
    one: (id: string | undefined) => ['stickers', 'one', id] as const,
  },
  playerAlbum: {
    sideData: (albumId: string | undefined) => ['player-album', 'sidedata', albumId] as const,
  },
  profile: {
    me: () => ['profile', 'me'] as const,
  },
  subscription: {
    isPro: () => ['subscription', 'is-pro'] as const,
  },
  admin: {
    albums: () => ['admin', 'albums'] as const,
    presets: (kind: string) => ['admin', 'presets', kind] as const,
  },
  presets: {
    byKind: (kind: string) => ['presets', kind] as const,
  },
  trades: {
    matches: (albumId: string, stickerId?: string) => ['trades', 'matches', albumId, stickerId ?? 'all'] as const,
  },
};
