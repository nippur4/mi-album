@AGENTS.md

## Estado del proyecto

Última actualización: 2026-06-20 (segunda sesión del día).

### Lo que se completó

**Backend (`supabase/`):** 13 migraciones aplicadas (schema + RLS + RPCs de owner lifecycle, membership, packs, apply_pack_open, apply_qr_redeem, trades, subscription gates, qr_secret column security, cron jobs, keys-not-urls, album_progress, daily_status_batch, admin_list) + 4 Edge Functions deployadas (`open_pack`, `redeem_qr`, `revenuecat_webhook`, `upload_image`) + `pg_cron` activo.

**Infra:** proyecto Supabase `baexxbixcrhngbjptlkt` en sa-east-1 + bucket Cloudflare R2 `mi-album-figuritas` con r2.dev público. Secrets cargados: `R2_*` (real) y `REVENUECAT_*` (placeholders).

**Auth E2E:** magic link via Supabase, deep link `mialbum://` parseado por `useDeepLinkAuth` (token en fragment) + `useJoinDeepLink` para `mialbum://join/<CODE>`. Dev build de EAS instalado en el teléfono de Nico.

**Cliente (`client/`):** Expo SDK 56 + expo-router con grupos `(auth)` / `(tabs)` / `album` / `sticker` / `join` / `pack` / `trade` / `admin`. Design tokens del handoff en `src/constants/theme.ts`. Fuentes Anton + Manrope + SpaceMono.

**Flujo Owner completo** (Landing → Crear álbum → Detalle con checklist/imágenes/grilla/publicar → Cargar/editar/eliminar figurita).

**Flujo User completo** (Joinear → Vista user con welcome banner + ProgressCard + grilla mixta pegada/sin pegar/missing → CTA inferior 3 estados → Pegar en grilla con tap).

**Abrir sobre (`app/pack/open.tsx`)** con animaciones Reanimated (idle wobble, sacudida hard, reveal staggered con cubic-bezier, ribbons NUEVA/REPE, pegar N nuevas, abrir otro).

**Sistema de intercambios completo** (tab Cambios con segmented Recibidas/Enviadas, `app/trade/matches.tsx` por álbum con repes y coincidencias, `app/trade/new.tsx` con cards "Vos das"/"Recibís" + swap circular).

**Tab bar custom** con `Tabs` clásico + `@expo/vector-icons` (Feather).

**Sobre diario** con countdown integrado en vista user del álbum + sección en tab Sobres.

#### Nuevo en esta sesión (PENDIENTE DE VALIDACIÓN POR NICO)

Lo siguiente fue construido pero **no se probó en mobile**. Nico debe correr `supabase db push`, regenerar tipos, bootstrappear admin (SQL abajo) y luego probar:

1. **Refactor del detalle de álbum** — `app/album/[id].tsx` pasó de 813 líneas a 64 (thin router). La lógica vive en `_owner-view.tsx` (460) y `_user-view.tsx` (334). `_user-view` ahora tiene `useFocusEffect` que refetcha collection + packs + daily al recuperar foco — **fix de bug**: antes los datos quedaban viejos al volver de `/pack/open`.
2. **RPC batch `fn_my_daily_status(uuid[])`** (migración 0012) + hook `useMyDailyStatusBatch` en `lib/queries/daily.ts`. `DailyAlbumRow` ahora recibe `status` por prop. Tab Sobres pasó de N+1 (2 queries × N álbumes) a 1 query batch.
3. **Optimizaciones menores:** `lib/use-now.ts` (singleton de Date.now tickeando cada segundo, todos los `Countdown` lo usan en vez de crear su propio interval), `Avatar` con `useMemo` para hash+initials, `Colors.greenLight` agregado al theme reemplazando hardcodes en `TradeOfferCard` y `trade/new.tsx`.
4. **Panel admin (pantalla 11):** migración 0013 con `fn_admin_list_published_albums()` (SECURITY DEFINER + chequea is_admin) + `lib/queries/admin.ts` (`useIsAdmin`, `useAdminAlbums`, `setAlbumPublic`) + `app/admin/index.tsx` con lista + Switch nativo + optimistic update. Acceso desde Perfil con link "Panel admin" + icono shield (solo visible si is_admin).
5. **Pantalla 03 figurita grande con foil:** `app/sticker/[id].tsx` pasó a thin router. La lógica de edición vive en `_edit-mode.tsx` (renombrado), la vista grande en `_view-mode.tsx` nuevo. Carta foil 240×CARD_H con bob vertical sutil (todas las rarezas) + sheen lineal animado (solo legendarias). Badges de estado (pegada/sin pegar/falta + counter de repes). Botón "Proponer cambio" → `/trade/matches`. Tap en celda pegada del `_user-view` ahora abre esta vista.

### Pasos pendientes de Nico para activar lo nuevo

```powershell
# 1. Aplicar migraciones 0012 + 0013
supabase db push

# 2. Regenerar tipos (Out-File con UTF8 explícito, sin él PS usa UTF-16)
supabase gen types typescript --linked | Out-File -Encoding utf8 client/src/lib/database.types.ts

# 3. Volverse admin (Dashboard → SQL Editor):
#    update profiles
#    set is_admin = true
#    where id = (select id from auth.users where email = 'nico4cueto@gmail.com');

# 4. Metro reload (no requiere rebuild EAS, todo es JS)
```

### Lo que quedó pendiente o a medias

- **QR de sobres (pantallas 05/06)**: Edge Function + RPC ya existen, falta UI del owner para generar/mostrar QR y del user para escanear (requiere `expo-camera`, otro rebuild EAS).
- **Paywall + Confirmación Pro (pantallas 12/13)**: ni RevenueCat real conectado ni screens. El secret de webhook es placeholder.
- **Tab "Álbum"**: existe placeholder sin contenido — sin concepto de "álbum activo" en el modelo. Decisión UX pendiente.
- **Push notifications**: cero. `profiles.push_token` existe pero no se setea ni se usa.
- **Vista figurita grande**: implementada pero **el `conic-gradient` overlay del handoff** (con `mix-blend-mode: overlay`) NO está — RN no lo soporta nativo. El sheen lineal sí. Falta también el **paginador de puntos** para navegar entre figuritas dentro del álbum.
- **Empty state pulido del owner pre-cargar imágenes**: el "AÚN NO HAY FIGURITAS" Anton aparece pero el grid fantasma de fondo podría tener más drama.
- **Sobre flotante animado** en el welcome del user (handoff 15) no está implementado.

### Decisiones técnicas tomadas

#### Sesiones anteriores

1. **Upload de imágenes 100% client-side** con `expo-image-manipulator` + Edge Function como proxy R2 trivial. Razón: `npm:sharp` en Deno Edge tira `WORKER_RESOURCE_LIMIT` por cold start largo del binario nativo.
2. **R2 con `aws4fetch`, no `@aws-sdk/client-s3`**: el SDK npm queda colgado >150s antes de fallar.
3. **Keys, no URLs, en la DB**: backend guarda paths relativos; cliente arma URL con `r2Url(key)`.
4. **Plantillas de fondo via convención `preset:<id>`** en el mismo campo `cover_thumb_key`. Cliente detecta el prefijo y renderiza `expo-linear-gradient` local.
5. **`Tabs` clásico (no NativeTabs)** con `@expo/vector-icons` (Feather).
6. **Magic link callback**: dos hooks separados (`useDeepLinkAuth`, `useJoinDeepLink`).
7. **Hanken Grotesque → Manrope** (el paquete `@expo-google-fonts/hanken-grotesque` no existe).
8. **`web.output: "single"`** (no static) porque AsyncStorage no funciona en SSR.
9. **Detalle del álbum bifurcado** en runtime (owner vs user, misma ruta).
10. **Estado `to_paste` explícito en grilla**: figuritas recibidas entran con `pasted=false`, se ven con borde gold + badge "PEGAR" + tap pega.
11. **Publicado = inmutable + irreversible**: regla del mundo físico.
12. **`SUPABASE_URL`/`SUPABASE_ANON_KEY`** se inyectan automáticamente en Edge Functions.
13. **JWT del caller en Edge Functions** para que `auth.uid()` funcione en RPCs `SECURITY DEFINER`.
14. **Migración 0009 `revoke select(qr_secret)`**: column-level security.
15. **`fn_album_progress(uuid[])`** batch para el Landing (owner ve `stickers_loaded`, user ve `my_pasted_count`).
16. **El owner NO juega su propio álbum**: `fn_join_album` lo rechaza.

#### Nuevas en esta sesión

17. **Split de pantallas grandes en thin router + named-export views**: `app/album/[id].tsx` y `app/sticker/[id].tsx` son thin routers (~60 líneas cada uno) que cargan data básica y bifurcan a `_owner-view`/`_user-view` o `_edit-mode`/`_view-mode`. Los archivos `_*` son ignorados por expo-router como rutas. Patrón a repetir si una pantalla crece >300 líneas o tiene 2 modos claros.
18. **NO cancel-on-unmount en hooks de queries**: React 19 (que viene con SDK 56) silencia los warnings de setState en componentes desmontados. El "memory leak" era teórico, no real. Decisión: mantener código sin tracker de `mounted` por legibilidad.
19. **`useNow()` singleton** en `lib/use-now.ts`: cualquier número de `Countdown` montados comparten un único `setInterval` global. Evita N timers en pantallas con varios countdowns simultáneos (tab Sobres con N álbumes en cooldown).
20. **RPC batch para evitar N+1**: cuando un componente lista varios items y cada uno necesita data adicional (status del daily, progreso, etc.), preferir una RPC que reciba `uuid[]` y devuelva todo en un query (ver `fn_album_progress`, `fn_my_daily_status`). El hook batch en cliente devuelve un Map.
21. **Pantalla 03 (figurita grande) sin `conic-gradient` ni `mix-blend-mode`**: RN no soporta nativo. Limitado a sheen lineal (LinearGradient transparente→blanco-alpha→transparente rotado 18° atravesando con `withTiming` lineal en loop) + bob vertical (sine). Aceptable en MVP.
22. **Admin RPC con SECURITY DEFINER y check explícito de `is_admin`**: la lista de álbumes del panel admin bypasa RLS para mostrar TODOS los published (incluidos privados). El check de admin va en la RPC.

### Próximo paso concreto

**Validar todo lo de esta sesión primero** (Nico aún no probó nada): aplicar 0012 + 0013, regenerar tipos, hacer SQL bootstrap admin, probar en mobile que (a) no se rompió nada del flujo previo, (b) el panel admin lista y togglea correctamente, (c) tap en celda pegada del user abre la figurita grande con foil, (d) refetch del user view funciona al volver de pack/open.

**Una vez validado: QR de sobres** (pantallas 05 owner + 06 user). Es la única pieza del MVP user-facing que queda. Pasos:
- Owner: en el detalle del álbum (sección economía o nueva), botón "Generar QR" que muestra el QR con el token firmado (HMAC con `qr_secret`). Pro-only (validado server-side ya).
- User: en el tab Sobres o una pantalla nueva accesible desde allí, botón "Escanear QR" que abre la cámara con `expo-camera`. Al escanear, llama Edge Function `redeem_qr` (ya implementada) que valida HMAC y otorga sobres.
- Requiere `npx expo install expo-camera` + permisos de cámara en `app.json` + **rebuild EAS (~15 min)** por el módulo nativo.

**Alternativas si Nico prefiere otra cosa:**
- Polish del flujo de pegar: animación "snap" cuando una figurita se pega (Reanimated con scale spring + tinte verde fugaz).
- Pantalla 03 mejorada: paginador de puntos para navegar entre las figuritas del álbum.
- Tab "Álbum": decidir UX (último joineado / lista de álbumes activos / quitar).
- Cron de welcome cuando una pantalla de Inicio detecta álbum joineado sin welcome_granted (recovery).

### Operativas

- Si una migración futura cambia signature de RPCs ya granted, recordar `grant execute` al final.
- Después de cualquier cambio a Edge Functions: `supabase functions deploy <name>`.
- Después de migraciones que toquen tablas: regenerar tipos (`supabase gen types ... | Out-File -Encoding utf8 ...`).
- Para validar flujos de intercambios o joining, Nico necesita 2 cuentas — la más simple es cerrar sesión y registrarse con otro mail desde el dev build.
