# Plan: versión web

Documento de seguimiento de la implementación de Mi Álbum de Figuritas como web app.
Pensado para mantener contexto entre sesiones — actualizar el estado de cada fase
al ir avanzando.

**Última actualización**: 2026-06-30 — Fase 0+1 cerradas + Fase 2 (auth web) y 3 (QR scan web) implementadas, pendientes de test end-to-end.

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
**Estado**: 🟡 código hecho, pendiente test por rate limit Supabase + config Dashboard.

- [x] En `signInWithMagicLink` (`lib/auth.ts`): pasar `emailRedirectTo = window.location.origin` cuando `Platform.OS === 'web'`, sino `'mialbum://'`
- [x] En `lib/supabase.ts`: `detectSessionInUrl: Platform.OS === 'web'`. Supabase-js auto-detecta el hash con tokens al cargar, sin necesidad de pantalla `/auth/callback` manual.
- [x] `useDeepLinkAuth` ahora es no-op en web (se devuelve early con check de Platform). Persistencia automática (AsyncStorage → localStorage en web).
- [ ] **Manual**: agregar `http://localhost:5000/**` a Supabase Dashboard → Authentication → URL Configuration → Redirect URLs (y `https://<dominio>.pages.dev/**` cuando exista deploy)
- [ ] Test runtime: chocó con rate limit (~3-4 mails/hora del free tier). Reintentar más tarde o configurar SMTP custom (ver memoria persistente `project_web_auth_gotchas`).

**Output**: poder loguearse desde un navegador end-to-end.
**Esfuerzo**: 2-3 hs.

---

### Fase 3 — Adaptación de features que se rompen
**Estado**: 🟡 código implementado, pendiente test runtime end-to-end.

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
**Estado**: pendiente.

Los pagos solo en mobile. En web, los flows que requieren Pro deben mostrar un mensaje claro en lugar del paywall normal.

- [ ] Crear componente `<MobileOnlyAction reason="...">` con modal explicativo + link al APK / Play Store
- [ ] Reemplazar el botón "Hacete Pro" en `(tabs)/profile.tsx` con ese componente en web
- [ ] Cuando una acción server-side falla con `pro_required`, en web mostrar el modal en vez del paywall
- [ ] Owner: cuando intenta activar QR en web (requiere Pro), mismo mensaje
- [ ] Owner: cuando intenta crear más de 1 álbum en web, mismo mensaje

Importante: las features que YA están habilitadas para usuarios Pro existentes se mantienen accesibles desde web (ej: si vos sos Pro y entrás desde web, podés ver el QR de tus álbumes, generar el token, etc.). Lo bloqueado es **comprar Pro** desde web.

**Esfuerzo**: 2-3 hs.

---

### Fase 5 — PWA installable
**Estado**: pendiente.

- [ ] Configurar `app.json`: `web.themeColor`, `web.backgroundColor`, `web.shortName`, `web.name`, `web.icons[]`
- [ ] Verificar que Expo genere el manifest correctamente al exportar
- [ ] Probar "Add to Home Screen" en iPhone Safari
- [ ] Probar instalación en Android Chrome
- [ ] Iconos en todas las resoluciones requeridas (192, 512, maskable)

**Esfuerzo**: 1-2 hs (más tiempo si hay que armar los iconos desde cero).

---

### Fase 6 — Deploy a Cloudflare Pages
**Estado**: pendiente.

- [ ] Crear proyecto en Cloudflare Pages
- [ ] Conectar al repo de GitHub
- [ ] Build command: `npx expo export --platform web`
- [ ] Output directory: `dist`
- [ ] Configurar variables de entorno (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_R2_PUBLIC_BASE_URL`)
- [ ] Verificar SSL automático
- [ ] Si dominio propio: configurar DNS
- [ ] Sumar la URL web a Supabase Auth → Redirect URLs (definitivo, no solo localhost)
- [ ] Smoke test contra prod

**Esfuerzo**: 1-2 hs.

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

| Fase | Esfuerzo |
|---|---|
| 0 — Decisiones | 30 min |
| 1 — Smoke test | 1-2 hs |
| 2 — Auth en web | 2-3 hs |
| 3 — Adaptación features | 6-10 hs |
| 4 — Gate de pagos | 2-3 hs |
| 5 — PWA | 1-2 hs |
| 6 — Deploy | 1-2 hs |
| 7 — Polish | 3-5 hs |
| **Total** | **~17-28 hs** |

Distribuido en sesiones de 2-3 horas, **6-10 sesiones**.

### Tandas sugeridas

**Tanda 1 — MVP funcional web** (Fases 0+1+2+3+6 → ~12-18 hs):
web deployada, auth funcionando, features core andando. El botón "Hacete Pro" todavía visible aunque no funcione bien (lo arreglamos en tanda 2). Listo para probar.

**Tanda 2 — Gating de pagos + PWA + polish** (Fases 4+5+7 → ~6-10 hs):
gate correcto de features pagas, instalable, cross-browser test.

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
