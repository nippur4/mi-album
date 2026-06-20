@AGENTS.md

## Estado del proyecto

Última actualización: 2026-06-20.

### Lo que se completó

**Backend (`supabase/`):** 11 migraciones aplicadas (schema + RLS + RPCs de owner lifecycle, membership, packs, apply_pack_open, apply_qr_redeem, trades, subscription gates, qr_secret column security, cron jobs, keys-not-urls, album_progress) + 4 Edge Functions deployadas (`open_pack`, `redeem_qr`, `revenuecat_webhook`, `upload_image`) + `pg_cron` activo.

**Infra:** proyecto Supabase `baexxbixcrhngbjptlkt` en sa-east-1 + bucket Cloudflare R2 `mi-album-figuritas` con r2.dev público. Secrets cargados: `R2_*` (real) y `REVENUECAT_*` (placeholders).

**Auth E2E:** magic link via Supabase, deep link `mialbum://` parseado por `useDeepLinkAuth` (token en fragment) + `useJoinDeepLink` para `mialbum://join/<CODE>`. Dev build de EAS instalado en el teléfono de Nico.

**Cliente (`client/`):** Expo SDK 56 + expo-router con grupos `(auth)` / `(tabs)` / `album` / `sticker` / `join` / `pack` / `trade`. Design tokens del handoff en `src/constants/theme.ts`. Fuentes Anton + Manrope + SpaceMono.

**Flujo Owner completo:**
- Inicio (Landing) con avatar, carrusel `PublicAlbumCard` (nombre Anton + barra + counter), lista `AlbumCard` (avatar + barra + counter + tag rol), `JoinCodeInput` dark.
- Crear álbum (hero Anton "NUEVO ÁLBUM" + badge `PLAN FREE/PRO` + Stepper rojo con sombra dura).
- Detalle de álbum: `ProgressCard` oscura (Anton gold), header multilínea + `StatusBadge` chico, `Checklist` para publicar, `ImageUploadCard` cover+pack con botón "Usar plantilla" → `PresetPickerModal` (6 gradientes), grilla 3-col con `StickerCell` + `StickerCellEmpty` (dashed), modal de editar `total_stickers`.
- Cargar figurita (form con `RarityPills` Pro-only, gate `common` para free).
- Editar/eliminar figurita.
- Publicar álbum (one-way, código + botón Compartir aparecen recién después).

**Flujo User completo:**
- Joinear via código o link → welcome pack automático.
- Vista user del álbum (`UserAlbumView` dentro del mismo `[id].tsx`): banner "¡TE UNISTE!", `ProgressCard` con stats, grilla mixta `StickerCell` (pegada con badge REPE) / `StickerCell state="to_paste"` (borde gold + tap pega) / `StickerCellMissing` (silueta).
- Banner amber "Tenés N sin pegar" cuando hay figuritas con `pasted=false`.
- CTA inferior con 3 estados: `Tenés N sobres · Abrir` / `Sobre diario disponible` / `Próximo en HH:MM:SS` (`Countdown` 1s tick).
- Botón outline "Ver cambios posibles".

**Abrir sobre (`app/pack/open.tsx`):** máquina `idle → opening → revealed` con Reanimated. Sobre con shake idle (sine wobble) + sacudida hard en open. Reveal de 5 cards con stagger 110ms × i + cubic-bezier overshoot. Cada card con strip de rareza, imagen large, ribbon NUEVA/REPE rotado. Botón "Pegar N nuevas" llama `pasteSticker` por cada nueva; botón "Abrir otro sobre" busca el próximo unopened del backend.

**Sistema de intercambios:** `app/(tabs)/trades.tsx` con segmented Recibidas/Enviadas + `TradeOfferCard` (avatar + headline + pill status + mini-cartas + swap + botones según side/status). `app/trade/matches.tsx` con segmented Repes/Coincidencias. `app/trade/new.tsx` con cards "VOS DAS" / "RECIBÍS" + swap circular ink. Backend: `useMyOffers` hidrata en cliente (profiles + stickers + albums), `useAlbumMatches` llama `fn_album_matches`, mutations `createTradeOffer` / `resolveTradeOffer`.

**Tab bar:** migrado de `NativeTabs` a `Tabs` clásico con `@expo/vector-icons` (Feather: home / grid / mail / repeat / user), labels en SpaceMono 9px tracking 1, activo rojo / inactivo muted.

### Lo que quedó pendiente o a medias

- **Pantalla 03 (figurita grande)**: tap en una celda pegada del user todavía no abre el detalle con la carta foil legendaria animada + botón "Proponer cambio".
- **Panel admin (pantalla 11)**: no existe UI. Para marcar álbumes como `is_public=true` hoy hay que correr SQL manual (`update profiles set is_admin=true where id=...` + llamar `fn_set_album_public`).
- **QR de sobres (pantallas 05/06)**: Edge Function + RPC ya existen, falta UI del owner para generar/mostrar QR y del user para escanear (requiere `expo-camera`, otro rebuild EAS).
- **Paywall + Confirmación Pro (pantallas 12/13)**: ni RevenueCat real conectado ni screens. El secret de webhook es placeholder.
- **Tab "Álbum"**: existe placeholder pero sin contenido — sin concepto de "álbum activo" en el modelo. Decidir si redirige al último joinedo, lista de mis álbumes, o se remueve.
- **Push notifications**: cero. `profiles.push_token` existe pero no se setea ni se usa.
- **Vista detalle de figurita (pantalla 03)** con foil animado para legendarias (sheen + bob + conic-gradient overlay).
- **Empty state pulido del owner pre-cargar imágenes**: el "AÚN NO HAY FIGURITAS" Anton aparece pero el grid fantasma de fondo podría tener más drama.
- **Sobre flotante animado** en el welcome del user (handoff 15) no está implementado.

### Decisiones técnicas tomadas en esta sesión

1. **Upload de imágenes 100% client-side**: el procesamiento (resize + JPEG + base64) lo hace `expo-image-manipulator`. La Edge Function `upload_image` es un proxy R2 trivial sin libs de imagen. Razón: `npm:sharp` en Deno Edge tira `WORKER_RESOURCE_LIMIT` por cold start largo del binario nativo.
2. **R2 con `aws4fetch`, no `@aws-sdk/client-s3`**: el SDK npm queda colgado >150s antes de fallar. `aws4fetch` (ESM, ~5KB) hace AWS Sig V4 sobre fetch nativo.
3. **Keys, no URLs, en la DB**: backend guarda paths relativos (`albums/<id>/cover/<uuid>-thumb.jpg`), cliente arma URL con `r2Url(key)` usando `EXPO_PUBLIC_R2_PUBLIC_BASE_URL`. Migrar de r2.dev a dominio custom = cambiar env, no UPDATE masivo.
4. **Plantillas de fondo via convención `preset:<id>`** en el mismo campo `cover_thumb_key`. El cliente detecta el prefijo y renderiza `expo-linear-gradient` local. Backend transparente.
5. **`Tabs` clásico (no NativeTabs)**: `expo-router/unstable-native-tabs` requería drawables Android inexistentes. Cambio a `Tabs` + `@expo/vector-icons` da control total y se ve coherente con el handoff.
6. **Magic link callback**: dos hooks separados (`useDeepLinkAuth` para tokens en fragment, `useJoinDeepLink` para path `/join/<CODE>`). Ambos en `_layout.tsx` root.
7. **Hanken Grotesque → Manrope**: el paquete `@expo-google-fonts/hanken-grotesque` no existe en npm. Sustitución visualmente cercana con los mismos pesos.
8. **`web.output: "single"`** (no static): AsyncStorage no funciona en SSR. SPA puro.
9. **Detalle del álbum bifurcado**: `app/album/[id].tsx` decide en runtime si renderiza la vista owner (checklist, edición, publicar) o la vista user (`UserAlbumView`: banner welcome, ProgressCard, grilla con states, CTA de sobres/daily, botón "Ver cambios posibles"). Misma ruta para no romper deep links.
10. **Estado `to_paste`** explícito en grilla: las figuritas recibidas (sobre/trade) entran con `pasted=false` y se muestran distintas a las missing (borde gold + badge "PEGAR" + tap). Ritual de pegar siempre explícito, decisión de UX validada con Nico.
11. **Publicado = inmutable + irreversible**: regla del mundo físico. `published → draft` no existe. Compartir solo aparece post-publish. Backend ya lo enforza, UI lo refuerza ocultando código y botón compartir en draft.
12. **`SUPABASE_URL`/`SUPABASE_ANON_KEY`** se inyectan automáticamente en Edge Functions (no hay que `supabase secrets set`).
13. **JWT del caller en Edge Functions** para RPCs `SECURITY DEFINER` que dependen de `auth.uid()`. `service_role` queda para webhook RC + lectura de `qr_secret`.
14. **Migración 0009 `revoke select(qr_secret)`**: column-level security porque RLS es row-level y un miembro podría leer `qr_secret` directo. Las RPCs `SECURITY DEFINER` bypassean el revoke.
15. **Fontes de progreso**: `fn_album_progress(uuid[])` para batch — owner ve `stickers_loaded`, user ve `my_pasted_count`. El Landing pide progreso de TODOS los álbumes visibles en una sola RPC.
16. **El owner NO juega su propio álbum**: `fn_join_album` lo rechaza. En el Landing los álbumes "owned" muestran progreso de construcción; los "joined" muestran progreso de colección. `roleTag` de `AlbumCard` los distingue.

### Próximo paso concreto

**Recomendado: Panel admin (pantalla 11)** + setear `is_admin=true` para Nico vía SQL. Sin esto los álbumes nunca pueden volverse públicos y el carrusel del Landing se ve vacío en testing. Es chico: 1 pantalla + ya existe `fn_set_album_public`. Sirve para validar el flujo público end-to-end (otro user ve el álbum en el carrusel sin necesidad de código).

**Alternativas (pickear lo que prefiera Nico):**
- **Pantalla 03 (figurita grande con foil)**: cierra el flujo de tap-en-celda-pegada. Pieza emblemática del handoff. Animaciones Reanimated (sheen + bob + conic overlay). Necesario para sentir "el premio" de las legendarias.
- **QR de sobres**: requiere `expo-camera` → rebuild EAS (~15 min) + setup de permisos. Cierra el incentivo presencial del owner para distribuir sobres.
- **Paywall + RevenueCat real**: monetización end-to-end. Requiere productos en App Store Connect (días/semanas de trámite, no hacer si no se planea publicar pronto).

**Tareas operativas antes de la próxima sesión:**
- Si Nico todavía no probó el flujo de intercambios, hacerlo con dos cuentas (segunda cuenta en otro teléfono o cerrar sesión y registrarse con otro mail).
- Cualquier bug visual de los Sprints handoff (overflow del grid 3-col, ProgressCard, etc.) se anota acá.
