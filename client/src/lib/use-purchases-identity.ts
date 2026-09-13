// Inicializa RevenueCat una vez y mantiene el app_user_id sincronizado con la
// sesión de Supabase (logIn al entrar, logOut al salir). Montado en el layout
// raíz. En web/iOS todas las llamadas son no-ops (ver purchases.ts).

import { useEffect } from 'react';

import { useSession } from '@/lib/auth';
import { identifyPurchaser, initPurchases, logOutPurchaser } from '@/lib/purchases';

export function usePurchasesIdentity() {
  const { session } = useSession();

  useEffect(() => {
    initPurchases();
  }, []);

  useEffect(() => {
    const uid = session?.user.id;
    if (uid) {
      identifyPurchaser(uid);
    } else {
      logOutPurchaser();
    }
  }, [session?.user.id]);
}
