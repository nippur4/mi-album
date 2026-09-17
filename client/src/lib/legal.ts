// Enlaces legales de la app.
//
// La Política de Privacidad se sirve como HTML estático en Cloudflare Pages
// (scripts/postexport-web.mjs la copia a dist/ desde web-static/privacy.html).
// URL fija, fuera del routing de la SPA, para que el revisor de Play Store y
// los crawlers la abran directo sin depender del bundle de la app.

import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

// Cloudflare Pages canonicaliza a la URL limpia (sirve privacy.html en /privacy
// y redirige /privacy.html → /privacy con 308). Apuntamos directo a /privacy
// para evitar el salto de redirección.
export const PRIVACY_URL = 'https://mi-album.pages.dev/privacy';

export function openPrivacyPolicy() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.open(PRIVACY_URL, '_blank', 'noopener,noreferrer');
    return;
  }
  Linking.openURL(PRIVACY_URL).catch(() => {});
}
