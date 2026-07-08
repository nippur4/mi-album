@AGENTS.md

## Estado del proyecto

Última actualización: 2026-07-08.

### Lo que se completó

**Backend (`supabase/`):** 49 migraciones aplicadas (0001–0049: schema + RLS + RPCs de owner lifecycle, membership, packs, apply_pack_open, apply_qr_redeem, trades, subscription gates, qr_secret column security, cron jobs, keys-not-urls, album_progress, daily_status_batch, admin_list, display_name unique, pgcrypto search_path + admin list-all, preset_images, avatar_presets, qr_cooldown_iso, album_page_config, archive/hide, push notifications, bundles `fn_my_pending_packs`/`fn_player_album_sidedata`/`fn_my_packs_tab_data`/`fn_home_bundle`, 0033 perf: índice `user_album_membership(album_id)` + cap de pares en `fn_album_matches`, 0034 `fn_swap_sticker_positions`, 0035/0036 avatares desbloqueables `fn_update_avatar` gate + `fn_my_avatar_unlocks`, 0037 fix crítico `_send_push`, 0038 tab Sobres incluye owner-as-player, 0039 `daily_muted` + stop por completado, 0040 cooldown con margen de 1h, 0041 `number_start` para el álbum especial 0..1000, 0042 `fn_delete_album` con confirmación de email, 0043 `page_cell_aspect`, 0044 `page_default_layout`, 0045 `pgrst.db_max_rows=2000` para el álbum especial 1001, 0046 `fn_delete_album` retirar-vs-borrar + `fn_album_player_count` + proteger 2 álbumes especiales, 0047 `albums.retired_at` + desarchivar reactiva, 0048 `fn_trade_limit_status` (reglas de trade para el jugador), 0049 `fn_publish_album` respeta `number_start`) + 6 Edge Functions deployadas (`open_pack`, `redeem_qr`, `revenuecat_webhook`, `upload_image`, `generate_qr`, `upload_preset_image`) con helpers compartidos en `_shared/http.ts` y `_shared/r2.ts` + `pg_cron` activo.

**Infra:** proyecto Supabase `baexxbixcrhngbjptlkt` en sa-east-1 + bucket Cloudflare R2 `mi-album-figuritas` con r2.dev público. Secrets cargados: `R2_*` (real) y `REVENUECAT_*` (placeholders).

**Auth E2E:** magic link via Supabase, deep link `mialbum://` parseado por `useDeepLinkAuth` (token en fragment) + `useJoinDeepLink` para `mialbum://join/<CODE>`. Dev build de EAS instalado en el teléfono de Nico.

**Cliente (`client/`):** Expo SDK 56 + expo-router con grupos `(auth)` / `(tabs)` / `album` / `sticker` / `join` / `pack` / `trade` / `admin`. Design tokens del handoff en `src/constants/theme.ts`. Fuentes Anton + Manrope + SpaceMono. Audio con `expo-audio` (SFX de apertura de sobres en `lib/sfx.ts` + `assets/sounds/`).

**Flujo Owner completo** (Landing → Crear álbum → Detalle con checklist/imágenes/grilla/publicar → Cargar/editar/eliminar figurita).

**Flujo User completo** (Joinear → Vista user con welcome banner + ProgressCard + grilla mixta pegada/sin pegar/missing → CTA inferior 3 estados → Pegar en grilla con tap).

**Abrir sobre (`app/pack/open.tsx`)** con animaciones Reanimated (idle wobble, sacudida hard, reveal staggered con cubic-bezier, ribbons NUEVA/REPE, pegar N nuevas, abrir otro).

**Sistema de intercambios completo** (tab Cambios con segmented Recibidas/Enviadas, `app/trade/matches.tsx` por álbum con repes y coincidencias, `app/trade/new.tsx` con cards "Vos das"/"Recibís" + swap circular).

**Tab bar custom** con `Tabs` clásico + `@expo/vector-icons` (Feather).

**Sobre diario** con countdown integrado en vista user del álbum + sección en tab Sobres.

#### Sesión 2026-07-08 (parte 5) — FIX publicar álbum especial (migración 0049)

**Síntoma:** publicar el álbum especial (0..1000, 1001 figuritas) → `P0063 sticker_number_missing_1001`.

**Causa:** `fn_publish_album` validaba la integridad de numeración con `generate_series(1, total_stickers)` = 1..1001, sin contemplar `number_start`. La 0041 actualizó `fn_add_sticker`/`fn_update_album_content`/`fn_swap_sticker_positions` pero SE OLVIDÓ de `fn_publish_album`. Para el especial (start=0) el rango real es 0..1000, así que el 1001 "faltaba" y el 0 no se chequeaba.

**Fix (0049):** el rango de la validación ahora es `generate_series(number_start, number_start + total - 1)`. Idéntico para álbumes normales (start=1). Recreé la función desde su definición VIVA (que ya usaba `cover_thumb_key`, no `_url`) para no pisar el fix de keys de la 0010. **Lección:** cuando se agrega un campo que altera un invariante (number_start), grepear TODAS las RPCs que lo asumen — no solo las obvias.

#### Sesión 2026-07-08 (parte 4) — Intercambios: badge, labeling de repes y reglas visibles (migración 0048)

1. **Badge en el tab CAMBIOS**: ofertas recibidas pendientes muestran badge rojo con el número, en mobile (`(tabs)/_layout.tsx` `tabBarBadge`) y en desktop (`desktop-header.tsx`). Reusa `useMyOffers` (misma query key → comparte cache). El push de nueva oferta ya existía; esto suma el indicador visual.
2. **Fix labeling "repe"** (`trade/matches.tsx`): la lista de intercambiables mezclaba repes reales y figuritas sin pegar, y marcaba TODAS como "REPE ×N". Un single sin pegar (quantity=1, tradable=1) salía "REPE ×1" falsamente. Ahora: `repeCount = quantity - 1` (0 para un single) → badge "REPE" solo para repes reales; las sin pegar se muestran con estado `to_paste` (gold "PEGAR"), cambiables pero NO rotuladas como repe. Solapa renombrada "Mis repes" → "Para cambiar" + copy vacío ajustado. La elegibilidad no cambió (un single sin pegar se sigue pudiendo cambiar).
3. **Reglas de intercambio visibles al jugador** (antes solo las descubría con el error P0115/P0113): nueva RPC `fn_trade_limit_status(album_id)` → `{ enabled, unlimited, count, period, used, remaining }` para el caller (espeja la ventana de `fn_trade_limit_reached`: trades `accepted` en day/week/month). Hook `useTradeLimitStatus` en `trades.ts`. Banner en `trade/matches.tsx`: "desactivados" / "sin límite" / "hasta N por período, te quedan M". Gate de la entrada: botón "Proponer cambio" en `sticker-view-mode.tsx` deshabilitado + hint si off; cards "Ofrecer" de matches deshabilitadas si off. **Nota:** el límite se chequea AL ACEPTAR, así que `remaining` = cuántos cambios más se pueden concretar; solo se gatea por `enabled` (crear ofertas sigue permitido), `remaining` es informativo.

#### Sesión 2026-07-08 (parte 3) — Efectos de sonido en apertura de sobres (expo-audio)

**Objetivo:** sonidos satisfactorios ("wow") al abrir un sobre.

1. **`expo-audio` instalado** (módulo NATIVO → requiere rebuild del dev build de EAS, como pasó con expo-camera/clipboard; en web funciona sin rebuild). Es el sucesor de expo-av en SDK 56. API usada: `createAudioPlayer(require('.wav'))`, `player.play()/.seekTo()/.volume`, `setAudioModeAsync({ playsInSilentMode:false, interruptionMode:'mixWithOthers' })`.
2. **Sonidos generados sintéticamente** (decisión: sin assets externos, reemplazables): `client/scripts/gen-sfx.js` es un generador Node puro (DSP a mano: campanas con parciales + decay exp, noise filtrado, sweeps de fase continua) que escribe `assets/sounds/*.wav` (16-bit PCM mono 44.1kHz, ~273KB total). Re-run: `node scripts/gen-sfx.js`. Los 6 SFX: `pack-shake`, `pack-open` (whoosh+shimmer), `card-pop`, `sparkle` (nuevas rara+), `legendary` (fanfarria arpegio C-E-G-C si sale épica/legendaria nueva), `paste`. **Reemplazables por sonidos curados con el mismo nombre, cero cambios de código.**
3. **Manager `lib/sfx.ts`:** precarga los players (pool de 4 para `card-pop`, que suena solapado por figurita), `playSfx(name, volume)`. Respeta el switch de silencio del teléfono (`playsInSilentMode:false`) y no corta la música del usuario. **Degradación silenciosa** si el módulo nativo no está (dev build viejo): `createAudioPlayer` tira → try/catch → sin sonido, sin romper.
4. **Timeline en `pack/open.tsx`:** tap → `shake` (dentro del gesto, desbloquea audio en web) → 500ms → `open` (el wow, al revelar) → pops escalonados por card (mismo `index*110ms` que la animación de entrada) + `sparkle` en nuevas rara+ → `legendary` único al final si hay épica/legendaria nueva. Pegar → `paste`. El efecto de sonido escalonado vive en un `useEffect([phase, stickers])`.
5. **Lección:** para one-shots de UI, un manager singleton con players precargados + pool para los solapados. El primer sonido SIEMPRE dentro de un gesto del usuario (web bloquea autoplay). WAV se puede sintetizar sin deps ni encoder (PCM directo).

#### Sesión 2026-07-08 (parte 2) — Borrado de álbumes: retirar-vs-borrar + fixes web + salir como jugador (migraciones 0046/0047)

1. **Fixes de feedback en WEB** (`Alert.alert` es no-op en react-native-web, decisión #31): (a) **eliminar figurita** (`sticker-edit-mode.tsx`) — el confirm por Alert no hacía NADA en web; ahora es confirm inline de dos toques + error inline. (b) **publicar** (`album-owner-view.tsx onPublish`) — el error se tragaba por Alert ("no pasa nada"); ahora try/catch + `publishError` inline debajo del botón. (c) **salir del jugador** (`album-user-view.tsx`) — el "Ocultar" por Alert → BottomSheet in-app, relabel a "Salir del álbum".
2. **`fn_delete_album` con branch server-side (0046):** ahora `returns text`. **Con otros jugadores** → RETIRA (no borra): `status='read_only'` + `owner_hidden=true` + cancela trades pending; los jugadores conservan membership y colección y siguen pegando (`fn_paste_sticker` no mira status), pero se frena join/diario/QR/trades (todos chequean `published` → P0082). **Borrador/sin jugadores** → hard delete con email==JWT (como antes). **2 álbumes especiales** (`55fce726…`, `29a1fa90…`) → `album_protected` (P0201), NUNCA se borran. Nueva `fn_album_player_count` (owner-only) para que el modal elija el copy antes de actuar (el branch real lo decide el server, autoritativo).
3. **Retiro REVERSIBLE (0047):** columna `albums.retired_at` marca los retirados por el owner (distinto del `read_only` por baja de Pro — ese NO setea owner_hidden ni retired_at, lo reactiva `_fn_restore_pro_albums`). `fn_unarchive_album_by_owner` ahora, si `retired_at` está seteado, vuelve el álbum a `published` y limpia `retired_at`. Sin esto, desarchivar dejaba el álbum pausado para siempre.
4. **Cliente:** `PROTECTED_ALBUM_IDS` + `albumPlayerCount` en `albums.ts`; `errors.ts` mapea P0200/P0201; `DeleteAlbumModal` con prop `playerCount` → dos flujos (1 paso "Cerrar álbum" sin email si hay jugadores, o 2 pasos con email si no); botón "Eliminar álbum" oculto en los especiales.
5. **Pendiente/heads-up:** el confirm de "Archivar álbum" (`onArchivePress`) TAMBIÉN usa `Alert.alert` → roto en web, no se tocó (no estaba pedido).

#### Sesión 2026-07-08 (parte 1) — Fixes UX de hojas + empty state

1. **Bug composición default de hojas** (`album-owner-view.tsx`): al `EditPagesModal` no se le pasaba `currentLayout`, así que el estado interno caía al default `'3x4'` y al guardar CUALQUIER cambio de hoja individual se pisaba la composición por defecto del álbum. Fix: pasar `currentLayout={(album as any).page_layout ?? undefined}` (como ya hacía el AlbumPager).
2. **Empty state del owner:** la burbuja "+" grande era decorativa (parecía botón pero no hacía nada). Ahora es un `Pressable` que carga la primera figurita.

#### Sesión 2026-07-08 — FIX álbum especial: PostgREST cortaba la fila 1000 (migración 0045)

**Síntoma:** al cargar la figurita número 1000 del álbum especial (`ecbf4497-e5d7-4732-88a2-75f7b39a2749`, 1001 figuritas numeradas 0..1000) → `23505 duplicate key ... (album_id, number)=(..., 1000) already exists`. Del 0 al 999 cargaban bien.

**Causa raíz — `max_rows` de PostgREST.** El default de Supabase es `max_rows = 1000`: TODA respuesta de listado se corta a 1000 filas. La query de detalle (`from('stickers').select('*').eq('album_id', id).order('number', asc)` en `lib/queries/albums.ts`) venía ordenada por número ascendente, así que devolvía 0..999 y **descartaba en silencio la fila 1000** (la más alta). Secuencia del bug: (1) la carga masiva calcula `freeNumbers` client-side (`numberStart..total-1`, NO de la query capada), así que sí insertó el 1000 en la DB; (2) al recargar, el cliente solo veía 0..999 y mostraba el slot del 1000 como vacío ("+"); (3) al tocarlo, mandaba `number=1000` a `fn_add_sticker` → duplicate porque 1000 ya existía. El especial es el ÚNICO álbum que supera 1000 filas (cap real 1001, constraint en 0041), por eso nadie más lo pegó. Rompía por igual pager/`buildPages`, matches, apertura de sobres y colección del jugador para ese álbum, no solo la carga.

**Fix (0045):** `alter role authenticator set pgrst.db_max_rows = '2000'` + `notify pgrst, 'reload config'`. Sistémico (sube el tope para TODOS los listados, no parche por query). `supabase/config.toml` alineado a `max_rows = 2000` (ese campo es SOLO local; el hosteado se configura por el GUC del rol). Verificado en remoto: `rolconfig` del `authenticator` incluye `pgrst.db_max_rows=2000`. La figurita 1000 siempre estuvo en la DB — solo era invisible; no hubo que re-subir nada, solo refetch del cache de React Query.

**Lección:** cualquier listado sin `.range()`/paginación queda capado a `max_rows`. Con el cap de figuritas en 1001, 2000 da margen holgado sin exponer payloads grandes. Si en el futuro un álbum pudiera superar 2000 filas, hay que paginar o subir de nuevo el GUC.

#### Sesión 2026-07-06 — Fixes de flujos + economía de sobres + álbum especial + eliminar álbum (migraciones 0037–0042)

1. **FIX CRÍTICO `_send_push` (0037):** `_send_push` y `fn_register_push_token` referenciaban `profiles.user_id` — la columna es `id`. plpgsql NO valida SQL al crear la función, solo al ejecutar: rotos EN SILENCIO desde 0027 todos los flujos que disparan push (unirse a álbum, crear/resolver oferta de trade, cron del daily) — la transacción entera abortaba. Fix: columna correcta + `_send_push` envuelta en `exception when others then null` — **el push es best-effort y NUNCA puede voltear la transacción de negocio del caller**. Lección: cualquier side-effect no esencial dentro de una RPC va con exception handler.
2. **Sobre de apertura real** (`pack/open.tsx`): el sobre era un diseño hardcodeado del handoff ("BESTIARIO"). Ahora muestra imagen/preset de sobre del álbum + nombre real (font escala por largo) + pack_size real.
3. **Unirse a álbum público con botón:** un no-miembro navegando un álbum público veía la vista de jugador rota (welcome banner falso, acciones que fallaban con not_member). Nuevo `useIsMember(albumId)` + CTA flotante "EMPEZÁ TU COLECCIÓN → Unirme" que llama `fn_join_album` con el `share_code` (legible por RLS en públicos, cero backend). Gateados para no-miembros: welcome banner, "Ver cambios posibles", "Ocultar de mi álbum".
4. **Tab Sobres como tablero completo:** badge rojo en la solapa (mobile `tabBarBadge`) y en el DesktopHeader = sobres sin abrir + dailies reclamables. La 0038 sacó el filtro `owner_id <> uid` del bundle (pre-Fase-10): el signal correcto es la MEMBERSHIP — ahora tus propios álbumes jugados como player aparecen. Orden: reclamables primero, countdowns ascendentes. Footer de pack/open sobre la barra del sistema Android (`useSafeAreaInsets`).
5. **Dejar de recibir sobres (0039):** dos vías — `membership.daily_muted` (toggle "Dejar de recibir sobres" junto a "Ocultar", reversible) y automática al COMPLETAR el álbum (`_fn_album_completed`: pegadas >= total). Ambas cortan: claim (P0181/P0182), fila y badge del tab Sobres, y push del cron. El QR sigue funcionando (escanear es deliberado). Sobres ya otorgados se conservan.
6. **Cooldown con margen (0040):** helper único `_fn_daily_interval` = nominal − 1h (diario 24→23 efectivas, semanal 168→167). Los configs guardan el nominal — la UI no cambia. Evita que el user de "todos los días a la misma hora" siempre llegue temprano.
7. **Álbum especial 0..1000 (0041):** `albums.number_start` (0|1, default 1) — números válidos `start..start+total-1`. Solo el álbum `ecbf4497-e5d7-4732-88a2-75f7b39a2749` tiene start=0 y total=1001 (seteado POR MIGRACIÓN, sin UI a propósito — única excepción). Constraint `stickers.number >= 0`, tope tabla 1001. RPCs (`fn_add_sticker`, `fn_update_album_content`, `fn_swap_sticker_positions`) validan por rango. Cliente: helper `albumNumberStart(album)` + `numberStart` propagado a buildPages/AlbumPager/carga masiva/sticker-new/EditTotal — default 1, cero impacto en álbumes normales.
8. **Eliminar álbum (0042):** `fn_delete_album(album_id, confirm_email)` — triple defensa: modal paso 1 (advertencia de consecuencias + sugerencia de archivar), paso 2 (tipear el email de la cuenta), y el server valida el email contra el JWT (`P0200`). El DELETE cascadea por FKs (stickers → colecciones de jugadores, memberships, packs, ofertas). Link rojo "Eliminar álbum" junto a "Archivar" en la vista owner; post-delete invalida caches y vuelve a Gestionar.

#### Sesión 2026-07-05 (parte 2) — Web desktop + features de edición + avatares desbloqueables (VALIDADO, commiteado)

**Objetivo:** aprovechar el ancho en web escritorio SIN afectar mobile (nativo ni web angosto), + varias mejoras de UX pedidas.

1. **Layout web desktop con ancho real** (`useIsDesktop()` = web && width ≥ 768; en nativo siempre false):
   - **Patrón clave (aprendido en 2 iteraciones):** el cap de ancho va sobre el CONTENIDO, no sobre el ScrollView. Si envolvés el ScrollView, la barra de scroll queda flotando en el borde del cap (mal). Solución: ScrollView full-bleed (todo el ancho) + `contentContainerStyle={[styles.scroll, desktopCap]}` donde `desktopCap = useDesktopCap(n)` (helper nuevo en `lib/use-is-desktop.ts`, devuelve `{maxWidth, width:'100%', alignSelf:'center'}` en desktop, `undefined` en mobile). Los bloques fijos fuera del scroll (ScreenHeader, segmented de matches, intro de admin) se envuelven en `<View style={desktopCap}>` para alinear título con contenido.
   - **Caps por pantalla:** tabs 1080 (alineado con DesktopHeader), álbum owner/user 760, trade 720, admin 960, forms (sticker, album/new) 560, login/join 480.
   - **`DesktopCapped` (componente wrapper)** quedó SOLO para grupos SIN scroll: `(auth)`, `join`, `pack` (este con `backgroundColor={Colors.ink}` full-bleed porque es oscuro). El root layout `_layout.tsx` ya NO capea a 480 (se sacó el `bodyDesktop`).
   - **Grids en las tabs** (mobile sigue lista vertical): Home "Donde jugás"/"Completados" y Gestionar en ~3 col; Sobres y Cambios en 2 col. Perfil = form capeado 560. Los CTA flotantes de la vista jugador (`position:absolute`) se centran en desktop con `floatDesktop` (maxWidth 760 - padding, marginHorizontal 'auto').
   - **Fix bug pager:** `album-pager.tsx` medía el ancho con `useWindowDimensions` (ancho de VENTANA) → la hoja desbordaba el cap en desktop. Ahora mide su contenedor con `onLayout`. En mobile la cuenta da idéntica, sin cambio visual.

2. **Feedback en carga masiva** (`bulk-sticker-upload-modal.tsx`): el resumen final usaba `Alert.alert` que **es NO-OP en react-native-web** (regla general: Alert.alert no existe en web). Ahora el resumen (check verde / carga parcial + botón "Listo") se muestra DENTRO del modal. "Detener" en web frena directo (Alert de confirm tampoco existía); en nativo mantiene el confirm.

3. **Calidad de imágenes:** `SIZES` en `uploads.ts` — thumbs subidos a 512 (sticker 300→512, cover/pack 400→512; avatar ya estaba 512). Además `ImageUploadCard` renderiza el preview a ancho completo (~700px desktop) donde el thumb se pixelaba → ahora recibe `largeKey` y usa la versión grande. **Las imágenes ya subidas mantienen su thumb viejo hasta re-subirse.**

4. **Reordenar figuritas** (migración 0034 `fn_swap_sticker_positions`, owner+draft, atómico via número temporal por la unique `(album_id,number)`): swap si destino ocupado, move si vacío. UI: modo "Reordenar figuritas" en la grilla del owner (1er tap elige con highlight gold, 2do tap destino). Wrapper `swapStickerPositions` en `stickers.ts`.

5. **Renombrar álbum en draft:** `edit-album-name-modal.tsx` (sobre BottomSheet). El gate ya existía en `fn_update_album_content` (acepta `p_name`, solo draft), no hizo falta backend.

6. **Herramientas de edición unificadas:** los pills (Editar nombre / Editar cantidad / Editar hojas / Reordenar figuritas) van juntos en una fila `toolsRow` debajo del contador "FIGURITAS · X/Y". Draft muestra los 4; published solo "Editar hojas".

7. **Fix texturas de hoja cortadas en web** (`page-texture.tsx`): un `<svg>` sin width/height explícitos en web cae al tamaño intrínseco default (300×150) → la textura cubría solo un parche. Fix: medir con `onLayout` y pasar px exactos al `<Svg>` y `<Rect>` (sin porcentajes). Además ids de `<Pattern>` únicos por textura (`tex-<key>`) porque en web todos los SVG comparten documento y `url(#tex)` repetido podía resolver al pattern de otro SVG.

8. **Avatares desbloqueables via álbum** (migraciones 0035/0036): gimmick — existe un "álbum de avatares" público (`29a1fa90-85b3-48fc-b452-2b7f64bd327b`) con figuritas 1..30 que espejan los 30 presets de avatar. **Mapeo sin columna nueva: `preset_images.sort_order` (kind='avatar') = número de avatar/figurita** (editable desde admin, ordena el picker). Libres para todos: `{1,4,20,22}` (0036 sumó el 20 al set inicial `{1,4,22}` de 0035). El resto se desbloquea al PEGAR la figurita de ese número. `fn_update_avatar` recreada con gate server-side (`avatar_locked_N`, P0180); `fn_my_avatar_unlocks()` devuelve `{album_id, album_name, free[], unlocked[]}` para el picker. Cliente: `useAvatarUnlocks` en `presets.ts`, `usePasteSticker` invalida `['avatars','unlocks']`. **Picker sin spoiler:** los bloqueados NO muestran imagen ni nombre — solo círculo dashed con candado + número `#NN` a conseguir. El ocultamiento es visual (la URL viaja en la respuesta de presets, RLS pública); suficiente para gimmick. La grilla NO se bloquea si los unlocks fallan/tardan (muestra numerados como bloqueados + nota de error).
   - **Pendiente de setup admin:** numerar los 30 presets de avatar (sort_order=número), cargar las 30 figuritas 1-30 al álbum de avatares, publicarlo + marcarlo público.

9. **`PublicAlbumCard`:** el font del nombre escala según largo (≤18 chars→26px, ≤32→21px, más→17px) + 4 líneas máx, para que nombres largos ("Completa y desbloquea todos los avatares") se lean completos.

**Baseline typecheck:** sigue en 22 errores preexistentes (absoluteFillObject ×7, nulls en params RPC, router.push tipado). Tras cada migración con RPC nueva aparece 1 error transitorio hasta regenerar tipos (`supabase gen types typescript --linked | Out-File -Encoding utf8 src/lib/database.types.ts` — OJO `Out-File -Encoding utf8`, NO `>` que mete BOM UTF-16).

#### Sesión 2026-07-04/05 — Refactor dedup + DB + robustez (VALIDADO, commiteado)

Salió de una revisión general del proyecto buscando duplicación, optimizaciones de DB y robustez. Tres tandas:

1. **Deduplicación (sección 1, VALIDADO)**:
   - `components/bottom-sheet.tsx`: componente base de TODOS los modales (Modal + backdrop + sheet + handle + título). Props: `maxHeight`, `footer` (acciones sticky fuera del scroll — preserva el fix del modal de economía), `avoidKeyboard: 'both' | 'ios'`, `dismissable`, `onRequestClose`. Exporta `sheetStyles` (label/hint/error/actions). Los 10 modales migrados. **Modales nuevos: usar BottomSheet, no copiar el esqueleto.**
   - `lib/edge.ts`: `callEdgeFunction(name, body, { timeoutMs })` — único wrapper para llamar Edge Functions (token + headers + parseo + error `{ error: string }`). Reemplazó 5 fetch duplicados en packs/qr/uploads.
   - `parseDailyStatus()` en `lib/queries/daily.ts`: único parser del daily crudo de las RPCs.
   - Edge Functions: boilerplate a `_shared/http.ts` (CORS, jsonOk/jsonError, userClient/adminClient/getCallerId) y `_shared/r2.ts` (putToR2, base64ToBytes). **Fix colateral**: el CORS de `redeem_qr` no permitía el header `apikey` → el preflight fallaba en web.
   - **Bug fix**: `album-owner-view.tsx` usaba `enableQrForAlbum` sin importarlo (ReferenceError al tocar "Activar QR").
2. **DB (sección 2, VALIDADO)**:
   - Migración 0033: índice `user_album_membership(album_id)` (la PK `(user_id, album_id)` no servía para búsquedas por álbum: inventario de matches, member_count admin) + `fn_album_matches` con cap de 5 pares por contraparte vía `row_number()` (antes generaba el producto cartesiano faltantes×repes por usuario antes del limit).
   - `useMyOffers`: 4 round trips → 1 con embedded resources de PostgREST (hints de FK `trade_offers_*_fkey`; nombres verificables en `database.types.ts` → `Relationships`).
   - `useIsAdmin` ya no consulta la DB: deriva `is_admin` del `ProfileProvider`.
3. **Robustez (sección 3, pendiente de validación)**:
   - Dead code eliminado: `usePublicAlbums`, `useMyMemberAlbums`, keys `qk.albums.member/public`, `qk.trades.offers`, `qk.admin.isAdmin`. Las invalidaciones que apuntaban a `albums.public` ahora invalidan `['home-bundle']` (fix: marcar público desde admin no refrescaba el carrusel del Home).
   - 9 queries de lectura que silenciaban `error` ahora hacen `if (error) throw toAppError(error)` — patrón obligatorio para queries nuevas.
   - Pull-to-refresh: los hooks exponen `isRefetching` y las 5 pantallas con RefreshControl lo usan (antes `isLoading`, el spinner se cortaba al instante).
   - `query-client.ts` cablea `focusManager` a `AppState` (solo nativo): `refetchOnWindowFocus` ahora funciona al volver de background. Los `useFocusEffect` por pantalla siguen (cubren navegación interna).
   - `console.log` de debugging eliminados de `uploads.ts`.
   - Baseline de typecheck: 22 errores preexistentes (mayoría `absoluteFillObject`→`absoluteFill` y nulls en params de RPC) — no introducidos por el refactor, quedan como limpieza opcional.

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
- **Vista figurita grande — foil `conic-gradient` del handoff**: DECISIÓN 2026-07-03: se descarta. RN no soporta `conic-gradient` ni `mix-blend-mode` nativos y emular con LinearGradients apilados no valía el trabajo para el resultado. Nos quedamos con el sheen lineal actual + bob vertical, que es aceptable para MVP.

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

#### Sesión 2026-07-05 (parte 2)

31. **`Alert.alert` es NO-OP en react-native-web**: cualquier feedback (resumen, confirm, error) que dependa de Alert desaparece en web. Regla: para feedback que deba verse en web, renderizar UI in-place (estado del modal, texto inline) o gatear con `Platform.OS === 'web'`. Aplicado en bulk upload y en el modo reordenar (errores inline, no Alert).
32. **Cap de ancho desktop sobre el CONTENIDO, no el ScrollView**: envolver el ScrollView deja la barra de scroll flotando en el borde del cap. Patrón correcto: ScrollView full-bleed + `contentContainerStyle={[base, useDesktopCap(n)]}` y bloques fijos externos en `<View style={desktopCap}>`. `useDesktopCap` devuelve undefined en mobile (cero impacto). `DesktopCapped` (wrapper de grupo) solo sirve para grupos sin scroll.
33. **Medir contenedores con `onLayout`, no `useWindowDimensions`, cuando hay caps de ancho**: window width rompe cualquier layout capeado en desktop (pasó con `album-pager` y con `page-texture`). Medir el contenedor real. En mobile la cuenta da idéntica.
34. **SVG en web necesita width/height explícitos en px**: un `<svg>`/`<rect>` con porcentajes o sin tamaño cae al intrínseco default (300×150). En native el layout lo resuelve, en web no. Medir con onLayout y pasar px. Además `<Pattern id>` debe ser único por instancia (todos los SVG comparten el documento HTML; `url(#id)` repetido resuelve al primero montado).
35. **Desbloqueables mapeados con columna existente**: los avatares desbloqueables reusan `preset_images.sort_order` como número de figurita en vez de sumar una columna FK. Menos migración, y el campo ya era editable + servía para ordenar. El gate va server-side en la RPC de escritura (`fn_update_avatar`), el estado para la UI en una RPC de lectura (`fn_my_avatar_unlocks`). Ocultar imágenes "sin spoiler" en el cliente es visual, no seguro (RLS pública deja viajar las URLs) — aceptable para gimmick.

### Próximo paso concreto

Con la base sólida, lo que queda del MVP user-facing es **Paywall + RevenueCat real**. Pasos:
- Conectar RevenueCat SDK real (`react-native-purchases`), config de productos en App Store / Play Store sandbox.
- Reemplazar el secret placeholder del webhook por uno real, validar firma.
- Pantallas 12 (paywall) + 13 (confirmación pro) del handoff.
- Test end-to-end con sandbox: comprar → webhook → `subscriptions` row → `useIsPro()` true.

**Setup admin del álbum de avatares (data, no código — pendiente):**
- Numerar los 30 presets de avatar: `sort_order` = número (1-30) desde Admin → Plantillas.
- Cargar las 30 figuritas (números 1-30) al álbum `29a1fa90-85b3-48fc-b452-2b7f64bd327b`, publicarlo y marcarlo público desde el admin.
- Sin esto, el gate de desbloqueo funciona pero no hay figuritas que pegar.

**Limpieza técnica pendiente:**
- **Imágenes huérfanas en R2 (decisión consciente, sin proceso de limpieza).** La DB guarda solo keys y NUNCA se borra nada de R2. Quedan huérfanas en 4 flujos: (1) eliminar álbum (0042) — todas sus keys bajo `albums/<albumId>/...`; (2) eliminar figurita (`fn_delete_sticker`) — su thumb+large; (3) re-subir cualquier imagen (cover/pack/sticker/avatar/preset) — la versión anterior queda colgada porque cada upload genera uuid nuevo; (4) borrar preset admin. Costo hoy: despreciable (keys aisladas que nadie referencia, R2 cobra por GB). Si algún día molesta, el fix natural es una Edge Function "garbage collector" con `aws4fetch` (list por prefijo + delete): para álbumes borrados basta borrar el prefijo `albums/<albumId>/` — conviene registrar los ids borrados en una tablita `deleted_albums` al momento del DELETE si se quiere hacer async, o compararlo contra `select id from albums`. Para los reemplazos sueltos haría falta listar R2 completo y diffear contra las keys vivas en DB (albums.cover/pack keys + stickers.thumb/large + preset_images + profiles.avatar_thumb_key).
- `runOnJS` de Reanimated 4 emite warnings de deprecation. Funciona, no hay drop-in replacement obvio. Esperar Reanimated 5 o revisar al refactor.
- Baseline de 22 errores de typecheck preexistentes (mayoría `absoluteFillObject`→`absoluteFill` y nulls en params de RPC). No los introdujo ningún refactor reciente; limpieza opcional.

### Operativas

- Si una migración futura cambia signature de RPCs ya granted, recordar `grant execute` al final.
- Después de cualquier cambio a Edge Functions: `supabase functions deploy <name>`.
- Después de migraciones que toquen tablas: regenerar tipos (`supabase gen types ... | Out-File -Encoding utf8 ...`).
- Para validar flujos de intercambios o joining, Nico necesita 2 cuentas — la más simple es cerrar sesión y registrarse con otro mail desde el dev build.
