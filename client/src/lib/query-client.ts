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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { focusManager, QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';

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
      // gcTime sube de 5min a 24h a propósito: el cache se PERSISTE en disco
      // (ver persister abajo) y react-query solo persiste queries que siguen
      // vivas en memoria al momento de deshidratar. Con 5min, una query que no
      // se tocaba en ese lapso se recolectaba y NO se guardaba → no sobrevivía
      // al arranque en frío. gcTime >= PERSIST_MAX_AGE garantiza que lo que se
      // vio en la sesión quede en disco. gcTime es tope de INACTIVIDAD, no
      // memoria fija: dentro de una sesión normal no se acerca a 24h.
      gcTime: 24 * 60 * 60_000,
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

// ============================================================================
// Persistencia del cache en disco (AsyncStorage nativo / localStorage web)
// ============================================================================
//
// El cache de react-query vive en memoria y se pierde al cerrar la app. Lo
// persistimos para que el arranque en frío pinte al instante desde disco (sin
// esperar la red) — clave para la grilla del álbum, que puede ser hasta 1001
// figuritas con sus keys de imagen y ya no cambian una vez publicado.
//
// AsyncStorage funciona en las dos plataformas: en web el paquete cae a
// localStorage (igual que lo usa supabase.ts para la sesión).

// Bumpear cuando cambie la FORMA de lo que guardan las queries (shape de un
// queryFn, tipos de la DB, versión de la app con migraciones que rompan). Al
// cambiar, el cache viejo se descarta entero en el próximo arranque en vez de
// rehidratar datos incompatibles.
export const PERSIST_BUSTER = 'v1';

// Antigüedad máxima del blob persistido: si la app no se abrió en >24h, se
// descarta y se refetchea todo fresco (evita servir datos muy viejos o de un
// esquema anterior). Debe ser <= gcTime para que las queries lleguen vivas a
// la deshidratación.
export const PERSIST_MAX_AGE = 24 * 60 * 60_000;

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'mi-album-rq-cache',
  // Agrupa escrituras: el cache cambia seguido, no queremos un write por cada
  // mutación de estado. 1s es el default y va bien.
  throttleTime: 1000,
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
    stats: () => ['admin', 'stats'] as const,
  },
  presets: {
    byKind: (kind: string) => ['presets', kind] as const,
  },
  trades: {
    matches: (albumId: string, stickerId?: string) => ['trades', 'matches', albumId, stickerId ?? 'all'] as const,
  },
};
