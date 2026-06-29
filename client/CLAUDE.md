@AGENTS.md

## Estado del proyecto

Última actualización: 2026-06-26.

### Lo que se completó

**Backend (`supabase/`):** 21 migraciones aplicadas (schema + RLS + RPCs de owner lifecycle, membership, packs, apply_pack_open, apply_qr_redeem, trades, subscription gates, qr_secret column security, cron jobs, keys-not-urls, album_progress, daily_status_batch, admin_list, display_name unique, pgcrypto search_path + admin list-all, preset_images, avatar_presets, qr_cooldown_iso, album_page_config, page_color_default_white) + 6 Edge Functions deployadas (`open_pack`, `redeem_qr`, `revenuecat_webhook`, `upload_image`, `generate_qr`, `upload_preset_image`) + `pg_cron` activo.

**Infra:** proyecto Supabase `baexxbixcrhngbjptlkt` en sa-east-1 + bucket Cloudflare R2 `mi-album-figuritas` con r2.dev público. Secrets cargados: `R2_*` (real) y `REVENUECAT_*` (placeholders).

**Auth E2E:** magic link via Supabase, deep link `mialbum://` parseado por `useDeepLinkAuth` (token en fragment) + `useJoinDeepLink` para `mialbum://join/<CODE>`. Dev build de EAS instalado en el teléfono de Nico.

**Cliente (`client/`):** Expo SDK 56 + expo-router con grupos `(auth)` / `(tabs)` / `album` / `sticker` / `join` / `pack` / `trade` / `admin`. Design tokens del handoff en `src/constants/theme.ts`. Fuentes Anton + Manrope + SpaceMono.

**Flujo Owner completo** (Landing → Crear álbum → Detalle con checklist/imágenes/grilla/publicar → Cargar/editar/eliminar figurita).

**Flujo User completo** (Joinear → Vista user con welcome banner + ProgressCard + grilla mixta pegada/sin pegar/missing → CTA inferior 3 estados → Pegar en grilla con tap).

**Abrir sobre (`app/pack/open.tsx`)** con animaciones Reanimated (idle wobble, sacudida hard, reveal staggered con cubic-bezier, ribbons NUEVA/REPE, pegar N nuevas, abrir otro).

**Sistema de intercambios completo** (tab Cambios con segmented Recibidas/Enviadas, `app/trade/matches.tsx` por álbum con repes y coincidencias, `app/trade/new.tsx` con cards "Vos das"/"Recibís" + swap circular).

**Tab bar custom** con `Tabs` clásico + `@expo/vector-icons` (Feather).

**Sobre diario** con countdown integrado en vista user del álbum + sección en tab Sobres.

#### Sesión 2026-06-26 (VALIDADO)

1. **Navegación reorganizada**:
   - Tab bar: INICIO → GESTIONAR → QR → SOBRES → CAMBIOS. Perfil sacado de la barra (`href: null`), accesible via `/profile`.
   - `HeaderAvatar` (`components/header-avatar.tsx`) nuevo: Pressable<Avatar> que va a `/profile`, montado en cada tab arriba a la derecha.
   - Tab QR no navega: usa `listeners.tabPress` con `e.preventDefault()` y abre `QrTabModal` con opciones Escanear / Mostrar QR (chooser de álbum si tenés varios con QR habilitado).
   - Tab ÁLBUM → "Gestionar" (`app/(tabs)/album.tsx` reescrito): lista vertical de owned + botón "Crear álbum nuevo". Home sacó la sección "Tus álbumes" (vive solo en Gestionar) pero mantiene el botón crear.

2. **Avatares custom desde admin presets**:
   - Migración 0018: `'avatar'` sumado al CHECK de `preset_images.kind`, columna `profiles.avatar_thumb_key`, RPC `fn_update_avatar(p_thumb_key)` que valida que la key pertenezca a un preset activo de kind `avatar` (evita inyección de keys arbitrarias).
   - Edge Function `upload_preset_image` acepta `kind='avatar'` (1:1).
   - `app/admin/presets.tsx` tiene tercera sección "Avatares (1:1)".
   - `components/avatar-picker-modal.tsx` (modal exclusivo, no muestra gradientes, primera opción "Por defecto" = iniciales+color hash).
   - `components/avatar.tsx` extendido con `imageKey` opcional (renderiza Image circular si está, sino fallback a iniciales). `HeaderAvatar` lo consume.
   - Decisión: los users NO suben sus fotos — moderación / contenido inadecuado. Eligen de la galería curada por admin.

3. **ProfileProvider global** (`lib/queries/profile.ts` refactor): `useMyProfile` ahora consume un Context montado en `_layout.tsx` root. Antes cada tab tenía su propio state local del profile y los updates (avatar/nombre) no se propagaban entre tabs hasta refetch manual. Un único fetch alimenta a todos los `HeaderAvatar` + Profile screen.

4. **QR cooldown con timestamp legible**:
   - Migración 0019: el `raise exception 'qr_on_cooldown_until_%'` ahora formatea con `to_char(... at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')` para emitir ISO. Antes era formato Postgres default que Hermes no parseaba.
   - `errors.ts` detecta `qr_on_cooldown` y parsea el timestamp ISO, devolviendo copy específico: "Volvé hoy a las HH:MM" / "Volvé mañana a las HH:MM" / "Volvé el DD/MM a las HH:MM".
   - `parsePgTimestamp` helper que normaliza formatos legacy (offset `+00` → `+00:00`, espacio → `T`, etc.).

5. **Tap-to-copy del share_code**: el card del código ahora es `Pressable`. Tap → `Clipboard.setStringAsync(album.share_code)` + feedback temporal "¡COPIADO!" (2s). Requirió `npx expo install expo-clipboard` + **rebuild EAS** (módulo nativo).

6. **Carga masiva de figuritas** (`components/bulk-sticker-upload-modal.tsx`): `allowsMultipleSelection: true` en ImagePicker, asignación secuencial a próximos números libres, name auto `#NN`, rarity default `common`, upload secuencial con progress bar + "Detener" entre items + resumen final. Botón "Carga masiva" en empty state y debajo de "Cargar otra".

7. **Slot vacío de figurita con `+`** en draft: `StickerCellEmpty` ya soportaba `showPlus`, faltaba pasar `showPlus={isDraft}` en la grilla activa del owner. Tap → `/sticker/new?albumId=...&number={n}` con número preseleccionado.

8. **Editor de economía** (`components/edit-economy-modal.tsx`):
   - Modal con tres modos: A (solo sobre diario), B (solo QR), C (ambos). B y C con badge PRO disabled si free.
   - Frecuencia daily diaria/semanal (semanal PRO-only) con chips. Stepper cantidad de sobres (free: 1 fijo, pro: 1–10).
   - Pack size chips 1/3/5/7/10 — libre para todos. (`open_pack/index.ts` con `PACK_SIZE_MIN = 1`, antes era 3).
   - Card "Cómo se consiguen las figuritas" prominente (border gold + shadow + icono Feather; rojo+icono alert si no configurado) que abre el modal. También item del checklist con hint en línea aparte.
   - Sumó sección a `pack_config` que ya existía; sin migración.
   - Fix del scroll del modal: SafeAreaView ya no envuelve todo, ScrollView con `flexShrink: 1` + actions sticky abajo. Antes el botón Guardar quedaba fuera del viewport.

9. **Checklist con label arriba + hint abajo** (`components/checklist.tsx`): cada item ahora apila label + hint en columna `flex:1` al lado del bullet. Hint queda verde si done. Antes el hint colateral se cortaba.

10. **`ScreenHeader` slot derecho variable**: era `width: 40` fijo y cortaba badges. Nuevo style `sideRight: { minWidth: 40 }` permite expandir al contenido.

11. **Avatar pixelado fix**: `SIZES.avatar` subió de 160/480 a 512/1024 en `lib/queries/uploads.ts`. Los avatars existentes hay que re-subirlos desde admin para tomar el nuevo tamaño.

12. **Teclado tapa input ("Te pasaron un código")**:
    - `Keyboard.addListener` en `(tabs)/index.tsx` para padding dinámico del ScrollView según altura del teclado.
    - `JoinCodeInput` expone `onInputFocus` → home dispara `scrollToEnd` con timeout 350ms post-focus.
    - KeyboardAvoidingView + `keyboardShouldPersistTaps="handled"`.

13. **Page pager 3×4 con efecto de hoja** (`components/album-pager.tsx`):
    - **Intento 1** (FlatList horizontal con tilt sutil): no convenció, "no parece hoja real".
    - **Intento 2** (lib `react-native-page-flipper`): falla en runtime — la lib es de 2 años atrás, usa peer dep antiguo de `expo-linear-gradient` (~11.x) + `react-native-linear-gradient` (módulo nativo) + APIs viejas de Reanimated 2/3 incompatibles con Reanimated 4. Quedó `react-native-linear-gradient` instalado como dead code (rebuild ya hecho).
    - **Intento 3** (custom con PanGestureHandler + Reanimated, layered approach): página activa rotaba ±180° con backface hidden, prev/next debajo con opacity. Tirón visible al hacer commit (setCurrentPage en JS thread vs progress=0 en UI thread no atómicos).
    - **Solución final — carousel approach**: una sola `position: SharedValue<number>` fraccionaria que crece sin reset. Cada página `position: absolute, left: idx * pageWidth`, transform `translateX = -position * pageWidth + idx * pageWidth`. RotateY ±25° + opacity según `idx - position`. Solo se renderean páginas a distancia ≤1 del current (perf OK). Velocidad alta completa el flip aunque el dedo no haya cruzado la mitad.
    - Necesitó `GestureHandlerRootView` en el root `_layout.tsx`.

14. **Color de hoja editable + layouts por hoja**:
    - Migraciones 0020 + 0021: `albums.page_bg_color text default 'white'` + `albums.page_overrides jsonb default '[]'` + RPC `fn_update_album_pages(album_id, bg_color, overrides)` editable en draft y published. 0021 cambió el default de `'paper'` (igual al body cream) a `'white'` para que se distinga visualmente + migró las filas existentes.
    - `lib/page-config.ts`: paleta de 9 colores (blanco, paper, crema, ocre, menta, cielo, lavanda, rosa, pizarra) + 5 layouts (3×4 default, 2×3, 3×3, 2×4, 4×4). Helpers `buildPages()`, `resolveColor`, `resolveLayout`, `updateAlbumPages`.
    - `components/edit-pages-modal.tsx`: modo principal con paleta + lista de hojas con preview chica, tap → editor de página individual (color con opción "Default" para volver + layout chips con preview).
    - `AlbumPager` recibe `pageBgColor` + `pageOverrides`. Cada hoja resuelve su color y layout.
    - **Hoja con tamaño FIJO**: `pageHeight` calculado del layout default 3×4 y respetado por TODOS los layouts. Las celdas se ajustan al espacio (4×4 más chicas, 2×3 más grandes) pero la hoja en sí mantiene tamaño en pantalla.
    - **Slot del cell con `aspectRatio` nativo** (en vez de `width × height` explícito): evita que el `aspectRatio: 0.82` interno del `StickerCell` pelee con dimensiones forzadas y desborde. + `SAFETY_MARGIN: 4` en el cálculo para evitar que floating-point + gap pierdan la última columna del wrap (era el bug por el que solo 2×3 funcionaba sin perder cells).

#### Sesión 2026-06-25 (VALIDADO)

1. **QR de sobres completo**: tipo `qr` en `pack_config`, Edge Function `generate_qr` (HMAC con `qr_secret` de la columna restringida), Edge Function `redeem_qr` existente + UI owner (`QrPosterModal`) + UI user (`pack/scan.tsx` con `expo-camera`). Pro-only enforced server-side.
2. **Fix bug `get_random_bytes`** (migración 0016): pgcrypto vive en schema `extensions` en Supabase managed, no en `public`. Agregado `set search_path = public, extensions` a `fn_update_album_economy` y `fn_rotate_qr_secret`.
3. **Admin ve TODOS los álbumes** (migración 0016): renombrada RPC a `fn_admin_list_albums` que devuelve también drafts/pausados con status. Toggle público sigue deshabilitado para non-published (lo enforza también el RPC `fn_set_album_public`).
4. **KeyboardAvoidingView** en login + edit-name-modal + edit-total-modal. Patrón estándar para cualquier modal/screen con TextInput.
5. **Landing dividido**: "Mis álbumes" pasó a dos sub-secciones, "Donde jugás" (member) y "Tus álbumes" (owner). Owner ve `stickers_loaded`, member ve `my_pasted_count`.
6. **Admin custom presets de imágenes** (migración 0017 + Edge Function `upload_preset_image`):
   - Tabla `preset_images` (kind cover/pack, name, sort_order, active, R2 keys) con RLS select-when-active.
   - 4 RPCs SECURITY DEFINER con check `is_admin`: list, create, update, delete.
   - Pantalla `app/admin/presets.tsx` con secciones cover (4:5) / pack (3:4), upload + toggle activo + borrar + rename via modal.
   - `PresetPickerModal` ahora muestra gradientes + imágenes admin del kind. Cuando el owner elige una imagen admin, **las keys R2 reales se copian al álbum** (no se referencia el preset por id) — así si admin desactiva/borra el preset, los álbumes que lo usaron siguen renderizando sin lookups en runtime.
7. **Display name unique + edit** (migración 0015): unique constraint + RPC `fn_update_display_name` + modal en perfil.
8. **Refactor a `components/` de los thin-router bifurcadores**: `_owner-view.tsx`, `_user-view.tsx`, `_edit-mode.tsx`, `_view-mode.tsx` movidos fuera de `app/` porque expo-router los descubría como rutas. Imports en thin routers ajustados.

#### Pendiente histórico (NO esta sesión, queda como estaba)

1. **Refactor del detalle de álbum** — `app/album/[id].tsx` pasó de 813 líneas a 64 (thin router). La lógica vive en `_owner-view.tsx` (460) y `_user-view.tsx` (334). `_user-view` ahora tiene `useFocusEffect` que refetcha collection + packs + daily al recuperar foco — **fix de bug**: antes los datos quedaban viejos al volver de `/pack/open`.
2. **RPC batch `fn_my_daily_status(uuid[])`** (migración 0012) + hook `useMyDailyStatusBatch` en `lib/queries/daily.ts`. `DailyAlbumRow` ahora recibe `status` por prop. Tab Sobres pasó de N+1 (2 queries × N álbumes) a 1 query batch.
3. **Optimizaciones menores:** `lib/use-now.ts` (singleton de Date.now tickeando cada segundo, todos los `Countdown` lo usan en vez de crear su propio interval), `Avatar` con `useMemo` para hash+initials, `Colors.greenLight` agregado al theme reemplazando hardcodes en `TradeOfferCard` y `trade/new.tsx`.
4. **Panel admin (pantalla 11):** migración 0013 con `fn_admin_list_published_albums()` (SECURITY DEFINER + chequea is_admin) + `lib/queries/admin.ts` (`useIsAdmin`, `useAdminAlbums`, `setAlbumPublic`) + `app/admin/index.tsx` con lista + Switch nativo + optimistic update. Acceso desde Perfil con link "Panel admin" + icono shield (solo visible si is_admin).
5. **Pantalla 03 figurita grande con foil:** `app/sticker/[id].tsx` pasó a thin router. La lógica de edición vive en `_edit-mode.tsx` (renombrado), la vista grande en `_view-mode.tsx` nuevo. Carta foil 240×CARD_H con bob vertical sutil (todas las rarezas) + sheen lineal animado (solo legendarias). Badges de estado (pegada/sin pegar/falta + counter de repes). Botón "Proponer cambio" → `/trade/matches`. Tap en celda pegada del `_user-view` ahora abre esta vista.

### Lo que quedó pendiente o a medias

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

#### Sesión 2026-06-26

23. **State global vía Context para profile**: cada tab tenía su propio `useState(profile)` y los updates (avatar, nombre) no se propagaban entre tabs. Solución: `ProfileProvider` en `_layout.tsx` root + `useMyProfile()` que consume el contexto. Un solo fetch, un solo state, todos los consumers se re-renderean automáticamente al `refetch()`. Patrón a repetir para data global compartida (pro status, admin flag, etc.) si surgen casos similares.
24. **Tap intercept en tab no-navegable** (tab QR): `Tabs.Screen` con `listeners.tabPress: (e) => { e.preventDefault(); setVisible(true); }` para abrir modal sin navegar. Hace falta una ruta dummy (`(tabs)/qr.tsx` vacía) para que expo-router la registre.
25. **Profile fuera de tab bar**: `<Tabs.Screen name="profile" options={{ href: null }} />` oculta la tab del bar pero mantiene la ruta accesible. Patrón para tabs que no van abajo (acceso por avatar arriba).
26. **Page-flipping en RN sin libs nativas**: el approach **carousel con una sola posición fraccionaria** que crece sin reset es el más robusto. El layered approach (active layer separada con reset progress + setCurrentPage en commit) tiene un tirón inevitable porque JS thread y UI thread no son atómicos. En el carousel, `position` está siempre en UI thread, `setCurrentPage` solo actualiza el counter visual y no afecta el render. Para evitar pop-in al cruzar, renderear ±1 del current (no solo el activo).
27. **Slot del pager con `aspectRatio` nativo en vez de `width × height` explícito**: cuando un cell interno (StickerCell) tiene su propio `aspectRatio`, pelea con dimensiones forzadas del padre y desborda. Pasarle `{ width: cellW, aspectRatio: aspect }` al slot deja que Yoga calcule la altura sin conflicto. + `SAFETY_MARGIN: 4` para que floating-point + flex-wrap no pierdan la última columna en layouts ajustados al pixel.
28. **Color/layout keys (no hex/dims) en DB**: `page_bg_color: 'mint'` y `layout: '3x4'` se guardan como strings cortas. El cliente resuelve a hex y dimensions. Si en el futuro cambiamos el hex, los álbumes existentes se actualizan automáticamente sin migración. Hacemos lo mismo con presets de imágenes (key 'cover'/'pack'/'avatar').
29. **Default value matters**: `page_bg_color default 'paper'` (que resolvía al mismo #FBF3E2 del body) era invisible. Cambiamos a `'white'` para que la hoja se distinga del fondo + sumamos border + shadow al rendering. Cuando creás una columna con default, asegurate de que el default produzca un resultado VISIBLE/útil para el user.
30. **Carga masiva**: `allowsMultipleSelection: true` + `selectionLimit: N` del ImagePicker permite picker múltiple nativo en una pasada. Upload secuencial (no paralelo) para no saturar la Edge Function. Cancel entre items con `useRef` (un state quedaría capturado en el closure del loop).

### Próximo paso concreto

Con la base sólida, lo que queda del MVP user-facing es **Paywall + RevenueCat real**. Pasos:
- Conectar RevenueCat SDK real (`react-native-purchases`), config de productos en App Store / Play Store sandbox.
- Reemplazar el secret placeholder del webhook por uno real, validar firma.
- Pantallas 12 (paywall) + 13 (confirmación pro) del handoff.
- Test end-to-end con sandbox: comprar → webhook → `subscriptions` row → `useIsPro()` true.

**Alternativas / polish que quedan:**
- **Sobre flotante animado** en el welcome del user (handoff 15).
- **Paginador de puntos** en figurita grande para navegar entre stickers del álbum.
- **Tab "Álbum activo"** (placeholder hoy) o quitarlo / repurpose.
- **Push notifications** end-to-end (registrar push_token, enviar al claim diario disponible, etc.).
- **Animación "snap"** al pegar figurita (Reanimated scale spring + tinte verde fugaz).
- **Polish del empty state del owner** pre-cargar imágenes (grid fantasma más dramático).

**Limpieza técnica pendiente:**
- `react-native-linear-gradient` quedó instalado (intento fallido de page-flipper). Es dead code pero ya compilado en el dev client. Se saca en el próximo rebuild de rutina con `npm uninstall` + rebuild EAS.
- `runOnJS` de Reanimated 4 emite warnings de deprecation. Funciona, no hay drop-in replacement obvio. Esperar Reanimated 5 o revisar al refactor.

### Operativas

- Si una migración futura cambia signature de RPCs ya granted, recordar `grant execute` al final.
- Después de cualquier cambio a Edge Functions: `supabase functions deploy <name>`.
- Después de migraciones que toquen tablas: regenerar tipos (`supabase gen types ... | Out-File -Encoding utf8 ...`).
- Para validar flujos de intercambios o joining, Nico necesita 2 cuentas — la más simple es cerrar sesión y registrarse con otro mail desde el dev build.
