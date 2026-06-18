// Hook que indica si el usuario es Pro (entitlement activo + no vencido).
// La lectura usa RLS: subs_select_own → solo lee la propia. Si no hay fila
// o el status no es activo, devuelve free.

import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';

export function useIsPro() {
  const { session } = useSession();
  const [isPro, setIsPro] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (!session) {
      setIsPro(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    supabase
      .from('subscriptions')
      .select('status, expires_at')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!mounted) return;
        const active =
          !!data &&
          (data.status === 'active' || data.status === 'in_grace') &&
          new Date(data.expires_at) > new Date();
        setIsPro(active);
        setIsLoading(false);
      });
    return () => { mounted = false; };
  }, [session]);

  return { isPro, isLoading };
}
