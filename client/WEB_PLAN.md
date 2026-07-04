# Plan: versión web

Documento de seguimiento de la implementación de Mi Álbum de Figuritas como web app.
Pensado para mantener contexto entre sesiones — actualizar el estado de cada fase
al ir avanzando.

**Última actualización**: 2026-07-01 — Fases 0+1+2+3+4+5+9+10 cerradas. Próximo: Fase 6 (Deploy), 7 (Polish) o 8 (Nav responsive).

---

## Contexto y decisiones tomadas

- **Target**: web app complementaria a la app Android. Mismo Supabase, misma DB, mismo R2.
- **Pagos**: **NO** en web por ahora. La suscripción Pro solo se compra desde la app Android (vía RevenueCat / IAP). En web, los flows que requieren Pro muestran un CTA "Para suscribirte bajate la app Android".
- **iOS / App Store**: descartado por el costo del Apple Developer Program (USD 99/año). La web cubre el target iPhone vía Safari + PWA.
- **Hosting elegido**: Cloudflare Pages (gratis, SSL automático, ya tenemos infra en Cloudflare por R2).
- **Dominio**: TBD. Para empezar sirve el subdominio gratuito de Pages (`mialbum.pages.dev`); más adelante migrar a uno propio si conviene.
- **Auth**: magic link de Supabase. En web, redirect a `https://<dominio>/auth/callback` en vez de `mialbum://`.
- **QR scan**: vía `jsqr` + `getUserMedia` en web, paralelo al `expo-camera` que se mantiene en mobile.
- **Distribución del web**: PWA installable (Add to Home Screen) — apunta a parecerse a una app instalada sin pasar por App Store.

---

## Plan por fases

### Fase 0 — Decisiones previas
**Estado**: ✅ completada (2026-06-30).

- [x] Dominio: **subdominio Pages gratuito** para arrancar (`mialbum-figuritas.pages.dev` o similar). Migrar a propio cuando justifique.
- [x] Alcance: **experiencia completa salvo pagos**. Web hace todo lo que mobile excepto comprar Pro. Quien ya es Pro accede a sus features Pro desde web.
- [ ] UI desktop: por definir más adelante (Fase 7). MVP: mismo layout mobile-first, ancho centrado en monitor grande.

Sin código. ~30 min.

---

### Fase 1 — Smoke test del build web
**Estado**: 🟡 build OK, runtime pendiente de probar (2026-06-30).

- [x] `npx expo export --platform web` — **exit 0**, 1621 modules bundled, dist/ generado.
- [ ] `npx serve dist` — pendiente probar localmente
- [ ] Navegar todas las pantallas en localhost
- [ ] Listar errores de bundling o runtime
- [ ] Identificar `expo-*` packages sin shim web (camera, etc.)

**Hallazgos del build:**
- Bundle main: **3.4MB** (pesado, optimizar en Fase 7).
- Razón principal del peso: `@expo/vector-icons` incluye TODAS las familias (Feather, FontAwesome, Ionicons, etc.). Solo usamos Feather → potencial reducción ~2MB.
- Sin errores de bundling. Todos los módulos resuelven en web.

**Output esperado**: una lista de adaptaciones requeridas para Fase 3.
**Esfuerzo**: 1-2 hs.

---

### Fase 2 — Auth en web
**Estado**: ✅ completada (2026-06-30, validada en browser local).

- [x] En `signInWithMagicLink` (`lib/auth.ts`): pasar `emailRedirectTo = window.location.origin` cuando `Platform.OS === 'web'`, sino `'mialbum://'`
- [x] En `lib/supabase.ts`: `detectSessionInUrl: Platform.OS === 'web'`. Supabase-js auto-detecta el hash con tokens al cargar, sin necesidad de pantalla `/auth/callback` manual.
- [x] `useDeepLinkAuth` ahora es no-op en web (se devuelve early con check de Platform). Persistencia automática (AsyncStorage → localStorage en web).
- [ ] **Manual**: agregar `http://localhost:5000/**` a Supabase Dashboard → Authentication → URL Configuration → Redirect URLs (y `https://<dominio>.pages.dev/**` cuando exista deploy)
- [ ] Test runtime: chocó con rate limit (~3-4 mails/hora del free tier). Reintentar más tarde o configurar SMTP custom (ver memoria persistente `project_web_auth_gotchas`).

**Output**: poder loguearse desde un navegador end-to-end.
**Esfuerzo**: 2-3 hs.

---

### Fase 3 — Adaptación de features que se rompen
**Estado**: ✅ completada (2026-06-30, validada en browser local).

Tasks:
- [x] `npx expo install jsqr` (1.4.0 instalada)
- [x] Crear `app/pack/scan.web.tsx` con `<video>` + `<canvas>` + jsqr. Mismo contrato `onScanned(token)`. Permission state machine (idle/requesting/granted/denied/unsupported). Loop de 200ms.
- [x] Auditoría: `expo-camera` solo se usa en `pack/scan.tsx`. `expo-image-picker` (3 lugares) y `expo-clipboard` tienen shim web automático.
- [ ] Verificar image picker en runtime: upload de figurita (`image-upload-card.tsx`), bulk upload (`bulk-sticker-upload-modal.tsx`), avatar admin (`admin/presets.tsx`)
- [ ] Test visual de animaciones (foil sticker, glow figurita nueva, sparkles, flip hojas del pager, sheen legendarias)
- [ ] Test del tap-to-copy del share_code en Safari (requiere gesture sincrónico)

**Hallazgos:**
- Bundle subió de 3.4 → 3.6MB con jsqr (~200KB).
- expo-router resolution automática: `scan.web.tsx` se carga solo en web, `scan.tsx` (con expo-camera) sigue intacto en mobile.
- `<video>` y `<canvas>` HTML directo via `React.createElement` (RN-Web no tiene equivalentes propios).

**Esfuerzo**: 6-10 hs (depende cuántas adaptaciones surgen).

---

### Fase 4 — Gate de features que requieren Pro (que no se pueden pagar en web)
**Estado**: ✅ completada (2026-06-30).

Resultado distinto del plan original: el repo nunca tuvo paywall ni botón "Hacete Pro" (estaba como pendiente histórico). Solo había **copy descriptivo** + validación server-side. El gate web se simplificó a cambiar copy + el mensaje de error.

- [x] Helper `lib/upsell-copy.ts` cross-platform: `upsellShort()`, `proFeatureHint(desc)`, `proRequiredMessage()` que devuelven "Bajate la app Android" en web y "Hacete Pro / Suscribite" en mobile.
- [x] `errors.ts` → cuando key=`pro_required`, retorna `proRequiredMessage()` en lugar del copy estático.
- [x] Copy actualizado con `proFeatureHint` en: `sticker/new.tsx` (descripción de rarezas), `edit-economy-modal.tsx` (free notice de sobres/día), `album-owner-view.tsx` QrSection (descripción QR Pro).
- [x] `album/new.tsx` muestra hint distinto en web sobre el límite de 75 figuritas vs 1000.

Las features Pro YA habilitadas (usuario Pro entrando desde web) siguen accesibles — el gate solo bloquea **comprar Pro** desde web.

**Esfuerzo real**: ~45 min (mucho menos que las 2-3 hs estimadas porque no había paywall que reemplazar).

---

### Fase 5 — PWA installable
**Estado**: ✅ completada (2026-06-30) — falta solo iconos optimizados + test install en device real.

- [x] Configurar `app.json` web: `name`, `shortName`, `description`, `lang`, `themeColor`, `backgroundColor`, `display`, `orientation`
- [x] Crear `public/manifest.json` con icons + display + theme
- [x] Crear `lib/pwa-head.ts` que inyecta `<link rel="manifest">` + apple-touch-icon + iOS meta tags al cargar (workaround porque `+html.tsx` no aplica con `web.output: 'single'`)
- [x] Llamar `ensurePwaHead()` en `_layout.tsx` root
- [x] Copiar `assets/images/icon.png` a `public/` con nombres esperados (icon-192, icon-512, icon-maskable-512, apple-touch-icon)
- [x] Rebuild verificado: dist incluye manifest.json + todos los iconos
- [ ] **Pendiente Nico**: generar iconos optimizados por tamaño (hoy es el mismo PNG resizeado por el browser — funcional pero no ideal en performance / nitidez). Tools: realfavicongenerator.net o similar.
- [ ] **Pendiente Nico**: test "Add to Home Screen" en iPhone Safari + Android Chrome con la app deployada (Fase 6).

**Gotcha encontrado**: en Expo SDK 56 con `web.output: 'single'`, el `+html.tsx` no se renderiza (solo aplica con `output: 'static'`). Para inyectar tags PWA hay que hacerlo en runtime via JS (`lib/pwa-head.ts`).

**Esfuerzo real**: ~1.5 hs.

---

### Fase 6 — Deploy a Cloudflare Pages
**Estado**: ✅ completada (2026-07-04). URL: `https://mi-album.pages.dev`.

- [x] Proyecto Pages conectado al repo (`nippur4/mi-album`), branch `master`.
- [x] Build command final: `cd client && npm ci && npx expo export --platform web && mv dist/assets/node_modules dist/assets/vendor && grep -rl "assets/node_modules" dist/_expo | xargs -r sed -i "s|assets/node_modules|assets/vendor|g"`
- [x] Build output directory: `client/dist`.
- [x] Env vars en Production: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_R2_PUBLIC_BASE_URL`, `NODE_VERSION=20`.
- [x] Redirect URLs en Supabase Auth: `https://mi-album.pages.dev/**` sumado.
- [x] Google OAuth: `https://mi-album.pages.dev` en Authorized JavaScript origins.
- [x] Login (Google + magic link) validado en prod.
- [ ] Cross-browser testing (Fase 7).
- [ ] Dominio propio (opcional): decisión pendiente.

**Gotchas clave** (documentados por si pisamos de nuevo):

1. **Cloudflare Pages ignora silenciosamente cualquier archivo dentro de `node_modules/`**. Es una convención del uploader (`wrangler`) — no lo dice en la docs. Expo Web genera assets en `dist/assets/node_modules/@expo-google-fonts/...` → **todas las fuentes + iconos vector se pierden en el upload**. Síntomas: la app carga pero sin tipografías custom y sin iconos Feather; en el network se ven los `.ttf` con status 200 y content-type `font`, pero el body es `<!DOCTYPE html>` (el `index.html` cae al SPA fallback). El fix es el `mv` + `sed` en el build command que renombra la carpeta a `vendor/` y actualiza las referencias en el JS bundle.

2. **Node 20 obligatorio**: default de Cloudflare es 18, y expo SDK 56 requiere 20+. Se setea con `NODE_VERSION=20` en env vars.

3. **`_redirects` con `/* /index.html 200`** es contraproducente en este proyecto: la SPA rewrite auto de Cloudflare Pages ya funciona sin él, y agregarlo empeora el diagnóstico del bug de `node_modules/` (todo se ve como "asset no encontrado + SPA fallback"). No usar salvo que aparezca un caso concreto donde falte.

**Esfuerzo real**: ~2.5 hs (~40 min de setup + ~1.5 hs debuggeando el bug de `node_modules/`).

---

### Fase 8 — Navegación responsive (tab bar arriba en desktop)
**Estado**: pendiente. Agregada al plan 2026-06-30.

En browser desktop (viewport ancho), la tab bar inferior queda **arriba** como navbar tipo desktop. En mobile (web o nativo) sigue abajo como hoy.

Decisiones técnicas:
- Threshold: `useWindowDimensions().width >= 768` (tablet/desktop) → tab arriba. Bajo eso → tab abajo.
- Implementación: custom tab bar de expo-router (`Tabs.Screen options` con `tabBar` prop o componente custom) que renderiza distinto según el width. Recalcula en resize.
- En desktop la nav puede ser horizontal + branding del lado izquierdo + avatar a la derecha. Aprovecha el espacio ancho.
- En mobile (incluso web) queda idéntico a hoy (tab bar abajo con los 5 items).
- El layout interno de cada screen también puede beneficiarse del ancho: max-width 480px centrado actualmente — en desktop con nav arriba, podría ampliarse a un layout más libre. (Opcional, decisión Fase 7.)

Tasks:
- [ ] Custom tab bar component que cambia posición según viewport
- [ ] Verificar que las animaciones / transiciones no se rompan al cruzar el threshold (rotación de pantalla, resize de ventana)
- [ ] Test en Chrome desktop + iPad horizontal/vertical + iPhone

**Esfuerzo**: 3-4 hs.

---

### Fase 9 — Google OAuth como opción primaria de login
**Estado**: ✅ completada (2026-06-30, validada web + mobile).

Tasks:
- [x] Crear proyecto en Google Cloud Console + credenciales OAuth (Web Application client)
- [x] Habilitar Google en Supabase Dashboard + pegar Client ID/Secret
- [x] `expo-web-browser` ya estaba instalado (no requirió rebuild EAS — funcionó directo en dev client)
- [x] Implementar `signInWithGoogle()` cross-platform en `lib/auth.ts`:
  - Web: `signInWithOAuth({ provider, options: { redirectTo: window.location.origin } })` (redirect estándar, supabase-js procesa el hash al volver)
  - Mobile: PKCE manual con `WebBrowser.openAuthSessionAsync` que abre browser embebido y captura el callback `mialbum://?code=...`, después `exchangeCodeForSession`
- [x] Rediseñar `(auth)/login.tsx` con botón Google primero + divider + magic link como fallback. Logo G oficial multi-color como SVG inline.
- [x] `WebBrowser.maybeCompleteAuthSession()` al cargar el módulo para que el browser embebido se cierre correctamente al volver
- [x] Test web (`localhost:5000`) + test mobile (dev client) — ambos funcionan

**Esfuerzo real**: ~1.5 hs (más rápido que estimado).

**Bonus efectivo**: el rate limit de Supabase free tier ya no es un problema crítico — Google maneja la mayor parte de los logins. SMTP custom queda como opcional para el % que elija magic link.

---

### Fase 10 — Owner puede jugar su propio álbum
**Estado**: ✅ completada (2026-07-01).

**Cross-platform** — no es solo web, afecta también mobile.

Decisiones tomadas:
- UX: **vista owner por default + botón "Jugar este álbum"** que lleva a vista user con `?as=player` query param. Menos riesgo de romper el flujo actual.
- Owner joineado consume welcome pack normal.
- Owner puede escanear su propio QR (útil para probar el flujo end-to-end).
- Owner puede reclamar sobre diario como cualquier jugador.
- Trade consigo mismo se mantiene bloqueado por el check natural `to_user <> caller` en fn_create_trade_offer.

Tasks:
- [x] Migración 0024: quitar checks `owner_cannot_join_own_album` (P0081) en fn_join_album y `owner_cannot_redeem_own_qr` (P0095) en fn_apply_qr_redeem.
- [x] `album/[id].tsx` thin router acepta `?as=player`; bifurca a vista owner o user según.
- [x] `album-owner-view.tsx` sumó card prominente "Jugar este álbum" (border gold, icono play verde). Detecta si ya está joineado y cambia copy a "Seguir jugando". Al tap: llama `joinAlbumByCode(album.share_code)` (idempotente) y navega a `?as=player`.
- [x] `album-user-view.tsx` sumó pill "Config" en el header derecho cuando el session pertenece al owner del álbum. Vuelve a la vista owner sin query param.
- [x] Home: filtro `joinedAlbums.filter((a) => !ownedIds.has(a.id))` se mantiene — el owner no ve su álbum duplicado en "Donde jugás", solo en "Gestionar". Simple.

**Esfuerzo real**: ~1.5 hs.

Pendiente: `supabase db push` para aplicar migración 0024 en el backend. Test end-to-end.

---

### Fase 7 — Polish & cross-browser
**Estado**: pendiente.

- [ ] Test en Safari iOS (más restrictivo, especialmente para Clipboard / Camera)
- [ ] Test en Chrome Android
- [ ] Test en Chrome desktop
- [ ] Test en Firefox + Edge
- [ ] Capear ancho máximo del layout para que no se vea raro en monitor (sugerido: max-width 480px centrado con un fondo decorativo lateral)
- [ ] Analizar bundle size con `npx expo export --platform web --dump-sourcemap`. Si está pesado, code-splitting / lazy load.
- [ ] Empty states que pueden cambiar visualmente en web

**Esfuerzo**: 3-5 hs.

---

## Resumen de esfuerzo

| Fase | Esfuerzo estimado | Estado |
|---|---|---|
| 0 — Decisiones | 30 min | ✅ |
| 1 — Smoke test | 1-2 hs | ✅ |
| 2 — Auth en web | 2-3 hs | ✅ |
| 3 — Adaptación features | 6-10 hs | ✅ (rápido, ~3 hs real) |
| 4 — Gate de pagos | 2-3 hs | ✅ (45 min real) |
| 5 — PWA | 1-2 hs | pendiente |
| 6 — Deploy | 1-2 hs | pendiente |
| 7 — Polish | 3-5 hs | pendiente |
| 8 — Nav responsive (NEW) | 3-4 hs | pendiente |
| 9 — Google OAuth (NEW) | 3-5 hs | pendiente |
| 10 — Owner juega su álbum (NEW, cross-platform) | 5-8 hs | pendiente |
| **Total con NEW** | **~28-45 hs** | |

### Tandas sugeridas (actualizado)

**Tanda 1 — MVP web funcional** (Fases 0-4 → ✅ hecho).

**Tanda 2 — Deploy + PWA + Google OAuth** (Fases 5+6+9 → ~5-9 hs):
web en internet con login Google, PWA installable. Listo para compartir.

**Tanda 3 — UX desktop + polish** (Fases 7+8 → ~6-9 hs):
nav superior en desktop, cross-browser test, optimización de bundle.

**Tanda 4 — Owner juega su álbum** (Fase 10 → ~5-8 hs):
feature de producto cross-platform, no solo web.

---

## Decisiones pendientes / blockers

- [ ] Dominio: propio (~USD 10-15/año) vs subdominio Pages gratis
- [ ] ¿La app Android se publica antes en Play Store o se distribuye via APK directo del web?

---

## Log de sesiones

Formato: `YYYY-MM-DD — Fase X — Notas`

- 2026-06-30 — Planificación — Doc creado, decisiones iniciales tomadas. Sin código aún.
- 2026-06-30 — Fase 0+1 — Decisiones confirmadas (subdominio Pages, experiencia completa salvo pagos). `npx expo export --platform web` corrió OK (exit 0), 1621 modules bundled, dist generado. Sin errores de bundling. Bundle: 3.4MB (a optimizar en Fase 7 quitando icon families no usadas). Falta probar runtime con `npx serve dist`.
- 2026-06-30 — Fase 2 — `detectSessionInUrl: true` en web, `emailRedirectTo` por plataforma, `useDeepLinkAuth` no-op en web. Test bloqueado por rate limit Supabase (~3-4 mails/h free tier). Pendiente: agregar `localhost:5000/**` a Redirect URLs del Dashboard + retest.
- 2026-06-30 — Fase 3 — jsqr instalado + `scan.web.tsx` creado con `<video>` + `<canvas>` + loop 200ms. Same UX que mobile (viewfinder con esquinas gold). expo-image-picker y expo-clipboard tienen shim web, no requieren cambios. Bundle: 3.6MB. Pendiente: test runtime de scan + image upload.
- 2026-06-30 — Test browser local — Nico validó login + scan QR + image upload + navegación general en browser local. Fases 2 y 3 cerradas como ✅. Próximo: Fase 4 (gate pro) o Fase 6 (deploy).
- 2026-06-30 — Fase 4 — Gate de pago simplificado (no había paywall para reemplazar). Nuevo helper `lib/upsell-copy.ts` cross-platform + integrado en 4 lugares de UI + `errors.ts` para `pro_required`. ~45 min, mucho menos que estimado.
- 2026-06-30 — Plan extendido — Sumadas 3 fases nuevas: 8 (nav arriba en desktop, abajo en mobile), 9 (Google OAuth como opción primaria de login, resuelve rate limit Supabase free), 10 (owner puede jugar su propio álbum, cambio cross-platform). Esfuerzo total ahora 28-45 hs.
- 2026-06-30 — Fase 5 — PWA configurada: manifest.json en public/, iconos (placeholders) en 4 tamaños, lib/pwa-head.ts que inyecta tags al runtime (workaround porque +html.tsx no aplica con output:single). Test install real pendiente para post-deploy. Iconos optimizados pendientes (hoy es el icon.png resizeado).
- 2026-06-30 — Fase 9 — Google OAuth cross-platform funcionando web + mobile. PKCE flow en mobile con expo-web-browser (ya estaba en el dev client, sin rebuild). Pantalla de login rediseñada con Google primero. ~1.5 hs.
- 2026-07-01 — Fase 10 — Owner puede jugar su propio álbum. Migración 0024 quita 2 checks (owner_cannot_join_own_album + owner_cannot_redeem_own_qr). Cliente: thin router con ?as=player, card "Jugar este álbum" en owner view, pill "Config" en user view cuando es owner. ~1.5 hs.
