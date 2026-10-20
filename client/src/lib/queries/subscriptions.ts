// Hook que indica si el usuario es Pro (entitlement activo + no vencido).
// La lectura usa RLS: subs_select_own → solo lee la propia. Si no hay fila
// o el status no es activo, devuelve free.

import { useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { toAppError } from '@/lib/errors';
import { qk } from '@/lib/query-client';
import {
  buyPro,
  getProOffering,
  restorePro,
  PURCHASES_SUPPORTED,
  type BuyResult,
} from '@/lib/purchases';

// Re-export para que las pantallas de paywall consulten si hay compra nativa
// disponible sin importar el módulo de plataforma directamente.
export { PURCHASES_SUPPORTED };
export type { BuyResult };

export function useIsPro() {
  const { session } = useSession();
  const q = useQuery({
    queryKey: [...qk.subscription.isPro(), session?.user.id ?? 'anon'] as const,
    enabled: !!session,
    // Cambia solo por compra o expiración — poca frecuencia, cacheamos duro.
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('status, expires_at')
        .eq('user_id', session!.user.id)
        .maybeSingle();
      if (error) throw toAppError(error);
      // Espejo EXACTO de fn_is_pro (migr. 0082). 'cancelled' cuenta como Pro:
      // en Google Play cancelar = apagar la renovación automática, el acceso
      // sigue hasta el final del período ya pagado. El corte lo da expires_at.
      // Si cambia la lista de estados, hay que tocar los DOS lugares.
      return (
        !!data &&
        (data.status === 'active' ||
          data.status === 'in_grace' ||
          data.status === 'cancelled') &&
        new Date(data.expires_at) > new Date()
      );
    },
  });
  return { isPro: q.data ?? false, isLoading: q.isLoading };
}

// Precio del plan Pro (ya formateado en moneda local por RevenueCat) para
// mostrar en el paywall. Solo consulta en Android con RC configurado.
export function useProOffering() {
  const q = useQuery({
    queryKey: ['subscription', 'offering'] as const,
    enabled: PURCHASES_SUPPORTED,
    staleTime: 5 * 60_000,
    queryFn: getProOffering,
  });
  return { offering: q.data ?? null, isLoading: q.isLoading };
}

// Cuánto esperamos a que el webhook escriba la fila antes de rendirnos.
// Medido 2026-10-20 con RTDN configuradas: una renovación tardó ~50s en llegar.
// 2s × 20 = 40s de margen, que cubre el caso normal con holgura.
const PRO_POLL_MS = 2_000;
const PRO_POLL_ATTEMPTS = 20;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Acciones de compra. El punto delicado es que `useIsPro` lee de la DB, pero la
// fila la escribe el WEBHOOK de RevenueCat, que llega segundos después de que
// el SDK confirma la compra.
//
// Antes acá se invalidaban las queries apenas RC decía "ok": el refetch salía
// corriendo, encontraba la DB todavía sin la fila y cacheaba `false` por los
// 5 min de staleTime. Y como el cache se persiste a disco, ni recargar la app
// lo arreglaba. El paywall mostraba "¡YA SOS PRO!" (es un useState local)
// mientras el resto de la app te seguía tratando como free. Reportado por Nico
// el 2026-10-20.
//
// Ahora: marcamos Pro de forma optimista —RevenueCat YA confirmó el
// entitlement, no estamos adivinando— y reconciliamos contra la DB en segundo
// plano hasta que la fila aparezca. Si no aparece, invalidamos igual para no
// quedar mintiendo para siempre.
export function useProActions() {
  const qc = useQueryClient();
  const { session } = useSession();

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: qk.subscription.isPro() });
    qc.invalidateQueries({ queryKey: ['albums'] });
    qc.invalidateQueries({ queryKey: ['home-bundle'] });
  }

  // No se await-ea desde buy()/restore(): el usuario no tiene que esperar 40s
  // mirando un spinner. El setQueryData de arriba ya actualizó la UI.
  async function reconcileWithWebhook(uid: string) {
    for (let i = 0; i < PRO_POLL_ATTEMPTS; i++) {
      await sleep(PRO_POLL_MS);
      const { data } = await supabase
        .from('subscriptions')
        .select('status, expires_at')
        .eq('user_id', uid)
        .maybeSingle();
      const pro =
        !!data &&
        (data.status === 'active' ||
          data.status === 'in_grace' ||
          data.status === 'cancelled') &&
        new Date(data.expires_at) > new Date();
      if (pro) break;
    }
    invalidateAll();
  }

  function markProOptimistic() {
    const uid = session?.user.id;
    if (!uid) return;
    qc.setQueryData([...qk.subscription.isPro(), uid], true);
    // Los álbumes pueden salir de read_only, pero eso lo decide el server:
    // esas queries se invalidan recién cuando la fila está confirmada.
    void reconcileWithWebhook(uid);
  }

  async function buy(): Promise<BuyResult> {
    const r = await buyPro();
    if (r.ok) markProOptimistic();
    return r;
  }

  async function restore(): Promise<boolean> {
    const ok = await restorePro();
    if (ok) markProOptimistic();
    return ok;
  }

  return { buy, restore };
}
