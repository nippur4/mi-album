# Mi Álbum de Figuritas — Contexto del proyecto

> Documento de contexto para arrancar el proyecto con Claude Code. Resume qué es la app y todas las decisiones de arquitectura ya tomadas.

## Qué es

App móvil para **crear álbumes de figuritas digitales y compartirlos**. Owners arman álbumes (definen figuritas y sobres); otros usuarios entran, abren sobres, pegan figuritas y las intercambian. Mobile-first, nativa.

## Stack decidido

- **Frontend:** React Native con **Expo**. (Salto desde experiencia previa en React/Vite. Se eligió Expo sobre PWA porque la app necesita cámara/QR y notificaciones push nativas.)
- **Backend / DB / Auth:** **Supabase** (Postgres + Auth + Edge Functions).
- **Storage de imágenes:** **Cloudflare R2** (S3-compatible, free tier 10GB + cero egreso, permanente).
- **Entrega de imágenes:** R2 vía CDN de Cloudflare, URLs públicas. Cacheadas en cliente con `expo-image`.
- **Pagos / suscripciones:** **RevenueCat** sobre el pago in-app de las stores (StoreKit / Google Play Billing). Webhooks a Supabase.

## Decisiones de arquitectura clave

### 1. La lógica sensible vive en el servidor, NO en el cliente
A diferencia de proyectos previos (patrón "componente → DB directo"), esta app **no puede confiar la lógica al cliente**. Abrir un sobre, decidir qué figurita sale, validar el QR y ejecutar un intercambio deben correr en **Supabase Edge Functions**. Si esto vive en el teléfono, cualquiera se autorregala figuritas.

### 2. Una figurita = una imagen, compartida por todos
No se duplica storage por usuario. La imagen de la figurita #47 se aloja **una sola vez** en R2. Cada usuario solo tiene un registro en su colección: `{album, figurita, pegada, cantidad}`. Mil usuarios con el mismo álbum = las mismas N imágenes.

### 3. R2 es storage crudo → optimización en el upload
R2 no transforma imágenes on-the-fly (Cloudflare Images no tiene free tier). Por lo tanto, **al subir una figurita generamos los tamaños nosotros** (con `sharp`): una miniatura (~300px) para la grilla y una versión grande (~1000px) para el detalle. Se guardan ambas en R2. Una sola vez por figurita.

### 4. Upload por backend, lectura directa
El **upload** a R2 (solo owners) pasa por una Edge Function/Worker con las credenciales de R2 — nunca exponer las llaves en la app. Las **lecturas** son públicas y directas desde el CDN. Usar el SDK de S3 (`@aws-sdk/client-s3`) apuntando al endpoint de R2.

### 5. Intercambio asincrónico (no real-time, por ahora)
Sistema de **ofertas**: un usuario deja una oferta ("te doy la #30 por tu #12"), el otro la acepta cuando entra. Funciona offline, es robusto, y la base correcta. El intercambio se ejecuta como **transacción atómica en Postgres** (ambas figuritas cambian de dueño o ninguna) dentro de una Edge Function. Real-time se podría agregar como capa de UX más adelante; mientras, push notifications dan sensación de inmediatez.

### 6. Imágenes: caché + prefetch
`expo-image` cachea en disco/memoria por defecto. Al abrir un álbum, hacer `Image.prefetch()` de las figuritas en background para que se sienta instantáneo. Descarga offline total se deja para después si hace falta.

### 7. Monetización: freemium con suscripción al owner, vía store
El owner me paga a mí (no es marketplace, no manejo plata de terceros, no hay split de pagos). Modelo **freemium con suscripción**:
- **Free:** 1 álbum, figuritas ilimitadas, sobres diarios.
- **Pago (suscripción mensual/anual):** álbumes ilimitados + features pro (principal: **QR de sobres**).

La experiencia del **usuario** (no-owner) es siempre gratis y no toca pagos.

**Por qué suscripción y no pago único por álbum:** el costo no es crear el álbum sino mantenerlo vivo (R2, Supabase, usuarios activos consumiendo recursos en el tiempo). La suscripción se alinea con ese costo continuo y da ingreso recurrente; el pago único no cubre la infra que sigue corriendo.

**Por qué pago in-app de las stores y no Mercado Pago externo:** los links de pago externos (vía para esquivar la comisión) hoy solo se permiten en el storefront de EE.UU.; en Argentina fallan la revisión. Así que para AR el pago in-app es el camino correcto, no solo el de mejor UX. Con el **Small Business Program** de Apple/Google la comisión baja a **15%** (no 30%), razonable para este cobro.

**Implementación:** usar **RevenueCat** (no integrar StoreKit / Play Billing a mano). Abstrae las dos stores, maneja recibos/renovaciones/estado de suscripción y da webhooks. Tiene free tier holgado.

**Flujo:** owner se suscribe vía store → RevenueCat confirma → webhook a Supabase Edge Function → se marca al owner como `pro` en Postgres. La app **lee** el estado de suscripción para gatear (gate) las features de owner. **El gateo real de features se valida server-side**, no solo en UI (mismo principio que el resto de la lógica sensible).

## Roles

- **Admin** (uno): todo lo de owner + marcar álbumes como públicos (aparecen en landing).
- **Owner**: crea álbumes, los configura (nombre, privacidad, cantidad de figuritas y de sobres), carga figuritas, define cómo se consiguen los sobres (diario N sobres / N sobres por QR escaneado / etc.). Puede ser **free** (1 álbum) o **pro/suscripto** (álbumes ilimitados + QR de sobres).
- **Usuario**: entra a álbumes, abre sobres, pega figuritas, intercambia. Siempre gratis.

Un usuario puede ser owner de unos álbumes y usuario de otros.

## Reglas de negocio

- Álbumes **privados por default**, se comparten vía link/código.
- Admin puede marcar un álbum como **público** → aparece en landing principal.
- Métodos de obtención de sobres configurables por el owner (diseñar extensible: empezar con "diario" y "QR", poder sumar más).
- El QR de sobres lo tiene el owner; escanearlo otorga N sobres (validar server-side para evitar abuso/repetición). **El QR es feature pro** (requiere suscripción).
- **Gate de owner free:** máximo 1 álbum. Crear un 2º álbum o activar el QR requiere suscripción. El gate se valida server-side, no solo en UI.

## Modelo de datos (a definir en detalle — punto de partida)

Colecciones/tablas previstas (Postgres):
- `albums` — id, owner, nombre, privacidad, público (admin), config de sobres, cantidad de figuritas.
- `stickers` — figuritas de un álbum: id, album_id, número/nombre, url_miniatura, url_grande.
- `user_collection` — qué tiene cada usuario: user_id, sticker_id, pegada, cantidad (para repetidas).
- `packs` / `pack_grants` — sobres disponibles y su origen (diario, QR), control de cuándo se otorgan.
- `trades` / `trade_offers` — ofertas de intercambio: from_user, to_user, sticker_ofrecida, sticker_pedida, estado.
- `subscriptions` — estado de plan del owner: user_id, plan (free/pro), estado (activo/vencido), provider (RevenueCat), datos del entitlement. Actualizada por webhook de RevenueCat.

(Este modelo se afina como primer paso técnico del proyecto.)

## Pendientes para definir al arrancar
1. Modelo de datos detallado + esquema SQL.
2. Flujo de upload + generación de tamaños con `sharp` en Edge Function.
3. Lógica de "abrir sobre" (aleatoriedad, qué figurita sale, rareza si aplica).
4. Esquema del QR y su validación server-side.
5. Setup de RevenueCat + entitlements + webhook a Supabase + gate server-side de features.
6. Precios concretos (mensual/anual) y límites exactos del free.
7. Plan de implementación por fases.

## Anti-objetivos (lo que NO hacemos ahora)
- Intercambio en tiempo real.
- Pago por álbum / cobro a usuarios / marketplace con split (el owner me paga a mí, nada más).
- Mercado Pago / pago externo (no aplica en AR por reglas de stores).
- Conversión de monedas / pagos a terceros.
- Cloudflare Images de pago (optimizamos nosotros).
- Onboarding/tutorial extenso.
