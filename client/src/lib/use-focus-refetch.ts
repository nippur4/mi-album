// Reemplazo del patrón useFocusEffect(() => refetch()).
//
// `refetch()` de react-query IGNORA staleTime: siempre va a la red. Con las
// pantallas montadas dentro de Tabs/stack (Expo Router las conserva), cada
// cambio de tab o "volver" pagaba 1-2 round trips aunque el data tuviera
// segundos de vida. Este hook refetchea al recuperar foco SOLO las queries
// stale (respeta el staleTime de cada una, e incluye las invalidadas por
// mutations) y solo las activas (montadas).
//
// Matchea por PREFIJO de query key, así el caller no necesita la key exacta
// (que suele terminar en uid/ids): useFocusRefetchStale(['packs-tab']).
//
// El pull-to-refresh sigue usando refetch() directo — ahí el gesto del user
// ES el pedido explícito de ir a la red.

import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

export function useFocusRefetchStale(...queryKeys: QueryKey[]) {
  const qc = useQueryClient();
  // Las keys llegan como literales inline (identidad nueva por render) —
  // serializamos para que el callback quede estable entre renders.
  const serialized = JSON.stringify(queryKeys);
  useFocusEffect(
    useCallback(() => {
      for (const queryKey of JSON.parse(serialized) as QueryKey[]) {
        qc.refetchQueries({ queryKey, stale: true, type: 'active' });
      }
    }, [qc, serialized]),
  );
}
