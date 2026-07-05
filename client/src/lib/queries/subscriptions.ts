// Hook que indica si el usuario es Pro (entitlement activo + no vencido).
// La lectura usa RLS: subs_select_own → solo lee la propia. Si no hay fila
// o el status no es activo, devuelve free.

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { toAppError } from '@/lib/errors';
import { qk } from '@/lib/query-client';

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
