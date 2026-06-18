// Hook de sesión + helpers de auth.
//
// Estado:
//   - isLoading: true mientras se intenta recuperar la sesión desde AsyncStorage.
//   - session: null si no hay user logueado, o el Session de supabase-js.
//
// Magic link flow:
//   1. signInWithMagicLink(email) → manda mail con link mialbum://...
//   2. el link abre la app → supabase parsea el callback → onAuthStateChange dispara
//   3. el hook actualiza session → el redirect del _layout lleva al user a /(tabs)

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './supabase';

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, isLoading };
}

// emailRedirectTo es el deep link al que vuelve la app después del click.
// Debe matchear el scheme de app.json y estar autorizado en Supabase Dashboard
// → Authentication → URL Configuration → Redirect URLs.
export async function signInWithMagicLink(email: string) {
  return supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: 'mialbum://' },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}
