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
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
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

// emailRedirectTo cambia según plataforma:
//   - mobile: deep link `mialbum://` (lo captura useDeepLinkAuth)
//   - web: window.location.origin (supabase-js auto-detecta el hash con
//     access_token al cargar gracias a detectSessionInUrl)
// Ambas URLs deben estar autorizadas en Supabase Dashboard → Authentication
// → URL Configuration → Redirect URLs (mialbum://, http://localhost:5000,
// y el dominio de prod cuando se deploye).
export async function signInWithMagicLink(email: string) {
  const emailRedirectTo =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : 'mialbum://';
  return supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo },
  });
}

export async function signOut() {
  return supabase.auth.signOut();
}

// Captura deep links del magic link (mialbum://#access_token=...&refresh_token=...)
// y registra la sesión en supabase-js. Llamar una vez en _layout.tsx root.
//
// En web es no-op porque detectSessionInUrl: true en supabase.ts hace que
// supabase-js auto-detecte el hash de la URL al cargar.
export function useDeepLinkAuth() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handle = async (url: string | null) => {
      if (!url) return;
      const fragment = url.split('#')[1];
      if (!fragment) return;
      const params = new URLSearchParams(fragment);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        await supabase.auth.setSession({ access_token, refresh_token });
      }
    };

    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, []);
}

// Captura links del tipo mialbum://join/<CODE> y redirige a la pantalla de
// joinear con el código. Si no hay sesión, el redirect del _layout lleva
// primero a login y se pierde el código (limitación conocida para MVP).
export function useJoinDeepLink() {
  const router = useRouter();
  useEffect(() => {
    const handle = (url: string | null) => {
      if (!url) return;
      const match = url.match(/^mialbum:\/\/join\/([A-Z0-9]+)/i);
      if (match) {
        router.push(`/join/${match[1].toUpperCase()}`);
      }
    };
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', ({ url }) => handle(url));
    return () => sub.remove();
  }, [router]);
}
