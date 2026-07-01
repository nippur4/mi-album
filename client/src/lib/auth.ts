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
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import type { Session } from '@supabase/supabase-js';

import { supabase } from './supabase';

// Necesario para que openAuthSessionAsync cierre el browser embebido al
// volver del OAuth callback (en algunos Safari). No-op en mobile fuera de iOS.
WebBrowser.maybeCompleteAuthSession();

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

// Google OAuth via Supabase, cross-platform.
//
// Web: usa el redirect estándar (Supabase abre Google, vuelve con tokens en
// el hash, supabase-js los lee gracias a detectSessionInUrl: true).
//
// Mobile: flujo PKCE manual con expo-web-browser. Pasos:
//   1) Pedimos a Supabase la URL de Google con skipBrowserRedirect: true
//      (devuelve { data: { url } } sin redirigir nada)
//   2) Abrimos esa URL con WebBrowser.openAuthSessionAsync, que abre un
//      browser embebido (SFAuthenticationSession en iOS, Custom Tabs en
//      Android) y espera el redirect a `mialbum://`
//   3) Cuando vuelve, parseamos el ?code=... del deep link y llamamos
//      exchangeCodeForSession para canjear el code por una sesión
//
// IMPORTANTE: requiere config previa (idéntica para web + mobile):
//   1) Google Cloud Console: crear OAuth Client ID (Web Application)
//   2) Supabase Dashboard → Authentication → Providers → Google: pegar Client ID/Secret
//   3) En Google Cloud, agregar Authorized Redirect URI:
//      https://baexxbixcrhngbjptlkt.supabase.co/auth/v1/callback
//   4) En Supabase → URL Configuration → Redirect URLs: `mialbum://**` ya debería estar
export const GOOGLE_SUPPORTED = true;

export async function signInWithGoogle() {
  if (Platform.OS === 'web') {
    const redirectTo =
      typeof window !== 'undefined' ? window.location.origin : 'mialbum://';
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
  }

  // Mobile: PKCE flow manual con expo-web-browser
  const redirectTo = 'mialbum://';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) return { data: null, error };
  if (!data?.url) {
    return { data: null, error: { message: 'no_oauth_url' } as any };
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    // User canceló o cerró el browser sin completar.
    return { data: null, error: { message: 'oauth_cancelled' } as any };
  }

  // El callback vuelve como `mialbum://?code=XXXX` (PKCE). Lo canjeamos por
  // la sesión. URL.parse en RN viene del polyfill de react-native-url-polyfill.
  const url = new URL(result.url);
  const code = url.searchParams.get('code');
  if (!code) {
    return { data: null, error: { message: 'oauth_no_code' } as any };
  }
  const { data: sessionData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) return { data: null, error: exchangeError };
  return { data: sessionData, error: null };
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
