// Inyecta tags PWA en <head> al cargar en web. Necesario porque con
// `web.output: 'single'` Expo no usa +html.tsx para customizar el HTML
// (solo aplica con output: 'static'), y los meta tags PWA / manifest /
// apple-touch-icon no están en el template default.
//
// Se llama una vez desde _layout.tsx root cuando Platform.OS === 'web'.

import { Platform } from 'react-native';

const TAGS: Array<{ tag: 'link' | 'meta'; attrs: Record<string, string> }> = [
  { tag: 'link', attrs: { rel: 'manifest', href: '/manifest.json' } },
  { tag: 'link', attrs: { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' } },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-capable', content: 'yes' } },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' } },
  { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: 'Mi Álbum' } },
  { tag: 'meta', attrs: { name: 'application-name', content: 'Mi Álbum' } },
];

let injected = false;

export function ensurePwaHead() {
  if (Platform.OS !== 'web' || injected) return;
  if (typeof document === 'undefined') return;
  injected = true;
  for (const { tag, attrs } of TAGS) {
    // Skip si ya existe uno equivalente (ej. dev reload).
    const selector = Object.entries(attrs)
      .map(([k, v]) => `[${k}="${v}"]`)
      .join('');
    if (document.head.querySelector(`${tag}${selector}`)) continue;
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    document.head.appendChild(el);
  }
}
