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
      return (
        !!data &&
        (data.status === 'active' || data.status === 'in_grace') &&
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

// Acciones de compra: disparan RevenueCat y, si el entitlement queda activo,
// refrescan de inmediato useIsPro (+ álbumes, que pueden salir de read_only) sin
// esperar el webhook — que igual llega segundos después como fuente de verdad.
export function useProActions() {
  const qc = useQueryClient();

  function refresh() {
    qc.invalidateQueries({ queryKey: qk.subscription.isPro() });
    qc.invalidateQueries({ queryKey: ['albums'] });
    qc.invalidateQueries({ queryKey: ['home-bundle'] });
  }

  async function buy(): Promise<BuyResult> {
    const r = await buyPro();
    if (r.ok) refresh();
    return r;
  }

  async function restore(): Promise<boolean> {
    const ok = await restorePro();
    if (ok) refresh();
    return ok;
  }

  return { buy, restore };
}
