# Handoff: Mi Álbum de Figuritas — App móvil de figuritas digitales

## Overview
App móvil (mobile-first, ~390px de ancho de referencia, iOS + Android) para **crear álbumes de figuritas digitales y coleccionarlos socialmente**. Los *owners* arman un álbum (definen figuritas y sobres); los *usuarios* abren sobres, pegan figuritas y las intercambian. Inspiración: la nostalgia del álbum Panini físico, en versión social y digital. El bundle cubre 15 pantallas agrupadas en 6 flujos.

## About the Design Files
El archivo `Mi Álbum de Figuritas.dc.html` es una **referencia de diseño hecha en HTML** — un prototipo que muestra el look & feel y el comportamiento buscado, **no código de producción para copiar tal cual**. La tarea es **recrear estos diseños en el entorno del codebase destino** (la app es React Native / Expo según el brief) usando sus patrones, librerías y design system ya establecidos. Si todavía no hay entorno, elegir el framework más apropiado (React Native / Expo) e implementarlos ahí.

Notas de formato del prototipo:
- Está construido como un único archivo que dibuja **13 "phone frames"** lado a lado sobre un fondo oscuro tipo estudio. En la app real, **cada phone frame es una pantalla full-screen**; el marco de teléfono, la status bar simulada y el "home indicator" son cromo de presentación y **no deben portarse**.
- Todo está estilado inline. Los íconos son SVGs simples de una sola línea; reemplazarlos por el icon set del codebase (p. ej. lucide-react-native, SF Symbols).
- Las "figuritas/monstruos" están dibujadas con formas CSS básicas (círculos, border-radius, triángulos) como **placeholders**. En producción son **imágenes servidas desde CDN** en dos tamaños (miniatura para grilla, grande para detalle). Contemplar skeletons/placeholders mientras cargan.

## Fidelity
**High-fidelity (hifi).** Colores, tipografía, espaciados e interacciones son finales. Recrear la UI de forma fiel usando las librerías y patrones del codebase. Los valores exactos están en *Design Tokens* más abajo.

---

## Design Tokens

### Colores
| Token | Hex | Uso |
|---|---|---|
| `ink` | `#2A1E16` | Texto principal, superficies oscuras (cards de progreso) |
| `ink-soft` | `#5C4E3C` / `#7C6A52` | Texto secundario sobre claro |
| `muted` | `#9C8E79` / `#B89B6E` | Labels, captions, iconos inactivos |
| `paper` (screen bg) | `#FBF3E2` | Fondo de pantalla principal |
| `paper-2` | `#F3E7CF` / `#EDE0C6` / `#F6EFE0` | Fondos recesados, celdas faltantes, segmentos |
| `red` (primario) | `#D23A2E` | CTAs, marca, tab activo, acentos |
| `red-dark` | `#A4271F` | Gradiente de packs/covers |
| `red-shadow` | `#8F2019` | Sombra dura (botón estilo "stacked") de CTAs rojos |
| `gold` (foil) | `#E8B24A` | Acento premium, foil, números destacados, plan Pro |
| `gold-dark` | `#C98F2A` / `#A9802F` | Gradiente/sombra de elementos dorados |
| `green` (éxito/repe) | `#7FB83E` | "Pegada", repetidas, ofertas aceptadas, toggles ON |
| `green-text` | `#173405` / `#5B8A26` | Texto sobre verde |
| `amber-warn` | `#C77E1A` sobre `#FCEFD9` | Estado "pendiente", badges Pro inline |
| Borde hairline | `rgba(42,30,22,0.10–0.14)` | Bordes de cards sobre paper |
| Studio bg (presentación) | `#221A13` + radial `#2c2218→#1c150f` | Solo del lienzo de presentación — NO portar |

**Colores de figuritas (rareza / variedad):** `#E85D4E` coral, `#F2A03D` ámbar, `#3FB6A8` teal, `#5B8DEF` azul, `#B36BD4` violeta, `#7FB83E` verde, `#EE6FA0` rosa, `#4FC0DA` cyan. Tints suaves correspondientes para fondos de celda: `#FCE6E1`, `#FCEFD9`, `#DEF1EE`, `#E2EBFB`, `#EFE3F6`, `#EAF3DC`, `#FBE4EE`, `#DFF1F7`.

**Rareza → color de marco/strip:** Común `#B89B6E`, Rara `#5B8DEF`, Épica `#7A4FB0`, Legendaria `#E8B24A` (con foil/sheen animado).

### Tipografía
- **Display / títulos / números grandes:** `Anton` (400, condensada, all-caps). Para títulos de pantalla, números de progreso, nombres de figurita, precios.
- **UI / cuerpo:** `Hanken Grotesque` (400/500/600/700/800).
- **Técnica / labels / códigos / countdown:** `Space Mono` (400/700), uppercase con `letter-spacing` ~0.08–0.2em.

Escala aprox.: título pantalla `Anton 22–24px`; número progreso `Anton 30px`; H grande `Anton 30–32px`; cuerpo `14–15px/700`; caption `11–12px`; label mono `9–11px`. Hero del lienzo `Anton 74px` (solo presentación).

### Espaciado / radios / sombras
- Padding horizontal de pantalla: **22px** (algunas 20/24px).
- Gap entre cards de lista: **9–11px**.
- Radios: celdas grilla `14px`, cards `16–20px`, botones `13–16px`, chips/pills `20–30px`, avatares `50%`.
- Grilla del álbum: `grid-template-columns: repeat(3, 1fr); gap: 9px;` celdas con `aspect-ratio: .82`.
- Sombra de CTA primario: borde inferior duro `box-shadow: 0 5px 0 <color-dark>` (efecto "botón apilado"/coleccionable). Cards elevadas: `0 8px 20px -12px rgba(0,0,0,.3)`.
- Tab bar: 5 ítems, ícono 22px + label `9px/600–700`, activo en `red`, inactivo `#9C8E79`.

### Status bar / home indicator
Cromo de presentación. En la app real usar la status bar nativa y safe-areas reales.

---

## Screens / Views

> Convención de estados de figurita en toda la app: **faltante** (silueta gris sobre celda recesada con dashed border + número en `Anton` translúcido), **pegada** (figurita a color sobre tint), **repetida** (pegada + badge verde `REPE` / `×N`).

### Sección 1 — Entrar y coleccionar

**01 · Landing / Home**
- Propósito: punto de entrada; descubrir álbumes públicos, acceder a los propios, unirse por código.
- Layout: top bar (saludo "Hola de nuevo / SOFI" + avatar circular). Scroll vertical con: carrusel horizontal de **álbumes públicos** (cards 196px, gradiente rojo/azul, tag `PÚBLICO`, nombre en Anton, barra de progreso, "147/200 · 73%"); lista **Mis álbumes** (row: thumb 46px + nombre + mini-progreso + contador mono); bloque oscuro **"¿Te pasaron un código?"** (input dashed + botón dorado "Unirme"). Tab bar abajo (Inicio activo).

**02 · Detalle de álbum (la grilla) — PANTALLA CENTRAL**
- Propósito: ver la colección y el progreso; abrir sobres.
- Layout: header (chevron back + título Anton + menú ⋯). Card oscura de **progreso**: número grande `147/200` en gold + barra (gradiente gold→red, 73%) + stats ("28 repetidas", "53 faltan"). Chips de filtro (Todas / Faltan 53 / Repes 28). **Grilla 3-col** de celdas scrolleable. CTA fija inferior roja "Tenés 2 sobres · Abrir". Tab bar (Álbum activo).
- Celda: número mono arriba-izq; pegada = creature a color sobre tint; faltante = silueta + número; repe = badge verde `REPE` abajo-der.

**03 · Figurita (vista grande)**
- Propósito: ver una figurita en grande tras tocarla; lanzar intercambio.
- Layout: sheet sobre fondo `ink`. Header mono "FIGURITA 112 / 200" + cerrar. **Carta foil** centrada (230px, aspect .7, gradiente dorado con sheen animado y conic-gradient overlay; interior crema con `#112`, badge rareza `LEGENDARIA`, creature grande, nombre "GLORP EL VORAZ", subtítulo mono de clase/hábitat). Badges "✓ Pegada" y "Tenés 3 · 2 repes". CTA roja "Proponer cambio" + paginador de puntos.

### Sección 2 — El momento (dopamina)

**04 · Abrir sobre (INTERACTIVO — pantalla estrella)**
- Propósito: el ritual de apertura, suspenso → reveal.
- Estados: `idle` → `shaking` → `open`. Ver *Interactions*.
- Layout: fondo radial cálido. Header "EL GRAN BESTIARIO / 1 sobre disponible". Centro: **sobre** (172×230, gradiente rojo, banda dorada "BESTIARIO", "SOBRE OFICIAL", "5 figuritas", sheen) con hint "Tocá para abrir" (dot pulsante). Al abrir: header de resultado "¡5 figuritas! / 3 nuevas · 2 repetidas" + **5 mini-cards** que aparecen escalonadas, con strip de rareza, creature, nombre/#, y ribbon `NUEVA` (verde) o `REPE` (marrón). Acciones: botón verde "Pegar N nuevas" (→ "¡Listo, pegadas!") + "Abrir otro sobre".

**05 · Conseguir sobres**
- Propósito: ver sobres disponibles y métodos de obtención.
- Layout: card roja "2 sobres listos" + CTA "Abrir ahora". Card **countdown** "Sobre diario gratis · próximo en `HH:MM:SS`" (timer en vivo, mono, rojo). Sección "Otras formas": rows "Escanear QR del owner", "Canjear código" (ícono + título + sub + chevron).

**06 · Escanear QR (cámara)**
- Propósito: sumar sobres escaneando el QR del owner.
- Layout: fondo cámara oscuro simulado. Header (back + "Escaneá el QR del owner"). **Visor**: 4 esquinas en gold (212px) + línea de escaneo con glow. Texto guía mono. Card inferior "¿No funciona la cámara? Ingresá el código a mano".

### Sección 3 — Intercambio (asincrónico)

**07 · Mis repes / coincidencias**
- Layout: título "Intercambio" + **segmented control** (Mis repes · 28 / Me faltan · 53). Grid 4-col de repes (creature + badge `×N`). Lista de **coincidencias**: avatar inicial + "le das #30 · te da #12" + botón rojo "Ofrecer". Tab bar (Cambios activo).

**08 · Crear oferta**
- Layout: sheet (fondo `paper-2`). Header (back + "Proponer a Mateo" + avatar). Card **"Vos das"** (label rojo, mini-carta + "ÑAM #30" + "Tenés 3 · te sobran 2" + "Cambiar"). **Ícono swap** circular oscuro al medio. Card **"Recibís"** (label verde, carta + "BLIP #12" + "Te falta · ¡la necesitás!"). CTA roja "Enviar oferta" + nota.

**09 · Bandeja de ofertas**
- Layout: título "Ofertas" + segmented (Recibidas · 2 / Enviadas · 3). Cards por estado:
  - **Pendiente**: avatar + "Lucía te ofrece" + pill ámbar `PENDIENTE`; fila recibís/das con mini-cartas y swap; botones "Aceptar" (verde) / "Rechazar" (outline).
  - **Aceptada**: fondo verde claro, check, "Cambio con Valen aceptado · ya en tu álbum", pill `HECHO`.
  - **Rechazada**: opacity .72, "Tom rechazó tu oferta", pill `RECHAZADA`.
  - Tab bar con **badge "2"** en Cambios.

### Sección 4 — Owner

**10 · Crear / configurar álbum (owner FREE)**
- Layout: header "Nuevo álbum" + badge `PLAN FREE`. Campos: Nombre (input con caret), Privacidad (toggle Privado/Público — "Público lo decide el admin"), Cantidad de figuritas (stepper −/200/+), **Cómo se consiguen sobres** (opción "Sobre diario gratis" seleccionada en verde; **opción "QR de sobres" BLOQUEADA**: dashed, candado, badge `PRO`, botón "Desbloancear" → lleva al paywall), Figuritas cargadas (grid 5-col + tile "+"). Footer: "Compartir" (outline) + "Publicar álbum" (rojo).
- **Importante (monetización):** los controles pago se muestran con **candado/teaser, no ocultos**; tocarlos abre el paywall.

**11 · Panel admin**
- Layout: header escudo + "Admin · públicos". Nota explicativa. Lista de álbumes con toggle ON/OFF (verde/gris) para marcar público; subtítulo "N figus · @owner · N jugando". Mantener simple (uso de una sola persona).

### Sección 5 — Suscripción (solo owner)

**12 · Planes / Paywall**
- Aparece cuando un owner free intenta una acción pago (2º álbum, activar QR).
- Layout: fondo oscuro. Badge "★ OWNER PRO", título "Creá sin límites", sub "Tus coleccionistas siguen jugando gratis. Siempre." Comparativa free vs pago (filas con check verde + "free: …"; la fila **QR de sobres** resaltada en gold como feature estrella). Dos planes: **Mensual $4.99** (outline) / **Anual $39.99** (card dorada destacada, badge "AHORRÁS 33%", "$3.33/mes"). CTA "Suscribirme — anual" + nota "Pago seguro vía App Store / Google Play". **No diseñar la pantalla de pago en sí** (la maneja la store nativa).

**13 · Confirmación Pro**
- Layout: fondo oscuro, check dorado grande con glow pulsante + sparkles, badge "★ OWNER PRO ACTIVO", título "¡Ya sos Pro!", sub con "QR de sobres" resaltado. Tres mini-stats (∞ Álbumes / QR Sobres / PRO Badge). CTA "Crear mi 2° álbum".

---

## Interactions & Behavior

- **Abrir sobre (04):** máquina de estados `idle → shaking → open`.
  - Tap en el sobre (solo si `idle`): set `shaking`; el sobre corre `@keyframes figShake` (~0.6s) y aparece un glow radial dorado (fade 0.3s).
  - A los **650ms**: set `open`. El sobre se desvanece y escala (`opacity:0; transform: scale(1.6) translateY(-20px); transition: all .5s`).
  - Las 5 cards aparecen con `opacity 0→1` y `transform: translateY(34px) scale(.6) → 0`, transición `cubic-bezier(.2,1.3,.4,1) .55s`, **stagger de 110ms × índice**.
  - "Pegar N nuevas": marca las nuevas como pegadas (check verde overlay) y el botón pasa a "¡Listo, pegadas!". "Abrir otro sobre": vuelve a `idle`.
- **Countdown (05):** `setInterval` 1s, formato `HH:MM:SS` en `Space Mono`; target = ahora + tiempo restante. `clearInterval` al desmontar.
- **Foil legendario (03/12/13):** sheen lineal cruzando (`@keyframes figShine`, ~3.4s loop), conic-gradient overlay con `mix-blend-mode: overlay`, y `figFloat` (bob vertical 4s).
- **CTAs primarios:** sombra dura inferior (`0 5px 0`) que sugiere botón físico/coleccionable; en press, hundir (traducir Y +5px y reducir la sombra).
- **Segmented controls / toggles / chips:** estado activo = relleno (rojo o blanco con sombra) vs inactivo plano.
- **Navegación entre pantallas:** Tab bar (Inicio / Álbum / Sobres / Cambios / Perfil). Flujos: Landing→Álbum→Figurita; Álbum/Sobres→Abrir sobre; Conseguir→QR; Intercambio→Crear oferta→Bandeja; Owner: Crear álbum→(acción pago)→Paywall→Confirmación.

### Keyframes usados (referencia)
`figShake` (rotaciones ±5–7° con micro-translate), `figFloat` (±9px Y), `figGlow` (box-shadow dorada pulsante), `figShine` (translateX -120%→220% rotado 18°), `figPop` (scale .6→1 con overshoot).

## State Management
- `pack`: `'idle' | 'shaking' | 'open'` — estado de apertura de sobre.
- `pegadas`: set/objeto de ids de figuritas ya pegadas del último sobre.
- `countdown`: ms restantes hasta el próximo sobre diario (derivado de un target timestamp).
- Datos a traer del backend: álbum (lista de figuritas + qué tiene pegado el usuario + repetidas), sobres disponibles + próximo timestamp, ofertas (recibidas/enviadas con estado), plan del owner (free/pro), álbumes públicos curados.

### Estados a contemplar (del brief)
Figurita faltante/pegada/repetida · sobre disponible vs en countdown · oferta pendiente/aceptada/rechazada · álbum vacío (owner recién creado, sin figuritas) · álbum recién unido (0 pegadas → empujar a abrir sobre) · owner free vs pago (features con candado vs desbloqueadas) · owner free que toca acción pago → paywall.

## Design Tokens (resumen rápido)
Ver tabla completa arriba. Primario `#D23A2E`, premium `#E8B24A`, éxito `#7FB83E`, ink `#2A1E16`, paper `#FBF3E2`. Fuentes: Anton / Hanken Grotesque / Space Mono. Radios 13–20px. Padding pantalla 22px.

## Assets
- **Figuritas:** placeholders dibujados con CSS (formas básicas). En producción: **imágenes de CDN, 2 tamaños** (miniatura grilla / grande detalle) con caché y skeletons.
- **Íconos:** SVGs monoline inline (home, grid, sobre, swap, perfil, candado, QR, reloj, escudo, check, close, chevron). Sustituir por el icon set del codebase.
- **Fuentes:** Google Fonts (Anton, Hanken Grotesque, Space Mono) — o sus equivalentes empaquetados en la app.
- Sin logos de marca de terceros. El tema de ejemplo "El Gran Bestiario" (monstruos) es contenido original de muestra.

### Sección 6 — Estados vacíos (primer impulso)

**14 · Álbum vacío (owner recién creado)**
- Propósito: guiar al owner a cargar figuritas antes de publicar.
- Layout: header con badge `BORRADOR`. Card oscura **checklist de setup** (3/5: nombre ✓, cantidad ✓, sobres ✓, "Cargar figuritas" ○ marcado "ahora", "Compartir link" ○). Grilla vacía con tiles dashed (uno con "+"). Empty-state central: "Aún no hay figuritas" + guía. CTA roja "Cargar figuritas".

**15 · Álbum recién unido (usuario, 0 pegadas)**
- Propósito: empujar a abrir el primer sobre.
- Layout: banner rojo "¡Te uniste! / Empezá tu colección". Progreso "0/200 · 0%". Grilla **fantasma** (siluetas) con overlay de fade hacia abajo; sobre flotante (animación `figFloat` + sheen) + "Tenés 1 sobre de bienvenida". CTA prominente "Abrí tu primer sobre" (dot dorado pulsante). Tab bar (Álbum activo).

## Screenshots
La carpeta `screenshots/` incluye una imagen por pantalla, numeradas `01`–`15` igual que la numeración de este README (01 Landing … 15 Recién unido). Son referencia visual; los valores exactos están en este documento.

## Files
- `Mi Álbum de Figuritas.dc.html` — prototipo de referencia con las **15 pantallas** (incluido en este bundle). Es un Design Component; la lógica (estados de sobre, countdown, datos de grilla) está en el `<script>` al final del archivo y el markup arriba. Usalo como fuente de verdad para medidas, colores y copy exactos.
- `screenshots/01-screen.png` … `15-screen.png` — captura de cada pantalla.
- `support.js` — runtime del Design Component (solo necesario si abrís el HTML en un navegador; no es parte de la implementación).
