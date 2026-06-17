# Setup de infraestructura

Guía paso a paso para levantar Supabase + R2 desde cero. RevenueCat se deja para más adelante (requiere products aprobados en App Store / Play Console).

Cuando completes cada paso, marcá el checkbox y avisame cualquier dato que necesites guardar.

---

## Parte 1 — Supabase

### 1.1 Crear cuenta y proyecto

- [ ] Ir a [supabase.com](https://supabase.com) → sign up.
- [ ] **New project**:
  - Name: `mi-album-figuritas` (o lo que prefieras).
  - Database password: **generá una fuerte y guardala** (la vas a necesitar después).
  - Region: la más cercana a tus users (Argentina → `South America (São Paulo)` `sa-east-1` es lo mejor para latencia regional).
  - Plan: Free está bien para arrancar.
- [ ] Esperar ~2 min a que se aprovisione.

Cuando esté listo, anotá del dashboard:

| Dato | Dónde lo encontrás |
|---|---|
| **Project Ref** | en la URL del dashboard: `https://supabase.com/dashboard/project/<REF>` |
| **Project URL** | Settings → API → "Project URL" (ej: `https://xxx.supabase.co`) |
| **Anon key** | Settings → API → "Project API keys" → `anon` `public` |
| **Service role key** | misma página → `service_role` `secret` **(nunca commitear)** |

### 1.2 Instalar Supabase CLI

Windows con scoop:
```powershell
scoop install supabase
```

Sin scoop (con npm):
```powershell
npm install -g supabase
```

Verificar:
```powershell
supabase --version
```

### 1.3 Linkear el repo local con el proyecto remoto

```powershell
cd c:\Users\nico_\Desktop\Hackerman\mi-album
supabase init           # crea supabase/config.toml; aceptá los defaults
supabase login          # abre browser para autenticar
supabase link --project-ref <REF>
```

Te va a pedir la database password de 1.1.

### 1.4 Aplicar las 9 migraciones

```powershell
supabase db push
```

Esto corre las migraciones `0001` a `0009` en orden contra la DB remota. Si alguna falla, el output te dice cuál — avisame con el error y lo resolvemos.

### 1.5 Habilitar `pg_cron`

Las migraciones `0008_cron_jobs.sql` requieren la extensión `pg_cron`, que en Supabase Cloud se habilita desde el dashboard:

- [ ] Dashboard → Database → Extensions → buscar `pg_cron` → toggle **Enable**.
- [ ] Re-aplicar `0008` si falló antes:
  ```powershell
  supabase db push --include-all
  ```

### 1.6 Deployar las 4 Edge Functions

```powershell
supabase functions deploy open_pack
supabase functions deploy redeem_qr
supabase functions deploy revenuecat_webhook
supabase functions deploy upload_image
```

⚠️ **Importante sobre `upload_image`**: usa `npm:sharp@0.33.5`. Si el deploy falla por el binario nativo (mensaje del estilo "Cannot find module 'sharp-linux-x64'"), avisame — el plan B es migrar a `imagescript` (pure-Deno) y procesar HEIC en cliente.

### 1.7 Cargar los secrets de las Edge Functions

Estas variables las leen las Edge Functions vía `Deno.env.get(...)`. Setealas con el CLI:

```powershell
supabase secrets set REVENUECAT_WEBHOOK_SECRET="<por ahora dejarlo en cualquier string, lo cambiás cuando montes RC>"
supabase secrets set REVENUECAT_PRO_ENTITLEMENT_ID="pro"
supabase secrets set R2_ACCOUNT_ID="<viene en parte 2>"
supabase secrets set R2_ACCESS_KEY_ID="<viene en parte 2>"
supabase secrets set R2_SECRET_ACCESS_KEY="<viene en parte 2>"
supabase secrets set R2_BUCKET_NAME="<viene en parte 2>"
supabase secrets set R2_PUBLIC_BASE_URL="<viene en parte 2>"
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` ya las inyecta Supabase automáticamente — no hace falta setearlas.

---

## Parte 2 — Cloudflare R2

### 2.1 Crear cuenta y bucket

- [ ] Ir a [cloudflare.com](https://www.cloudflare.com) → sign up (si no tenés cuenta).
- [ ] Dashboard → **R2** (sidebar izquierdo) → **Create bucket**.
  - Name: `mi-album-figuritas` (todo lowercase, sin espacios).
  - Location: dejá `Automatic`.
- [ ] Subscripción a R2: requiere agregar tarjeta para pasar del free tier, pero **el free tier es 10GB de storage + cero egreso** — para MVP no vas a pagar nada.

### 2.2 Generar API token de R2

- [ ] Dashboard → R2 → **Manage R2 API Tokens** (botón arriba a la derecha).
- [ ] **Create API token**:
  - Name: `supabase-edge-functions`
  - Permissions: **Object Read & Write**
  - Scope: **Apply to specific buckets** → seleccionar `mi-album-figuritas`
  - TTL: dejá vacío (no expira)
- [ ] **Guardar inmediatamente**:
  - `Access Key ID` → `R2_ACCESS_KEY_ID`
  - `Secret Access Key` → `R2_SECRET_ACCESS_KEY` (no se muestra dos veces)

También necesitás el `R2_ACCOUNT_ID`:
- [ ] Dashboard → R2 → sidebar derecho, "Account details" → copiar **Account ID**.

### 2.3 Configurar dominio público para servir las imágenes

R2 soporta servir contenido público de dos formas: dominio custom (recomendado) o el dominio público de R2.dev (rate-limited, no para producción).

**Opción A — dominio custom** (mejor para producción, requiere dominio):
- [ ] R2 → bucket → **Settings** → **Custom Domains** → **Connect Domain**.
- [ ] Ingresar subdominio (ej: `cdn.tuapp.com`). Cloudflare gestiona los DNS automáticamente si el dominio ya está en Cloudflare.
- [ ] Una vez activo, anotar como `R2_PUBLIC_BASE_URL` (ej: `https://cdn.tuapp.com`).

**Opción B — r2.dev** (rápido para arrancar, rate-limited):
- [ ] R2 → bucket → **Settings** → **Public Development URL** → **Allow Access**.
- [ ] Anotar la URL que te da (ej: `https://pub-xxxxx.r2.dev`) como `R2_PUBLIC_BASE_URL`.

Mi recomendación: **arrancar con (B)** y migrar a (A) cuando estés cerca de soft-launch.

### 2.4 Cargar los R2 secrets en Supabase

Volver al directorio del proyecto y completar los placeholders del paso 1.7:

```powershell
supabase secrets set R2_ACCOUNT_ID="<de 2.2>"
supabase secrets set R2_ACCESS_KEY_ID="<de 2.2>"
supabase secrets set R2_SECRET_ACCESS_KEY="<de 2.2>"
supabase secrets set R2_BUCKET_NAME="mi-album-figuritas"
supabase secrets set R2_PUBLIC_BASE_URL="<de 2.3, sin slash al final>"
```

---

## Parte 3 — Conectar cliente Expo

### 3.1 Generar tipos de la DB

```powershell
cd c:\Users\nico_\Desktop\Hackerman\mi-album
supabase gen types typescript --linked > client/src/lib/database.types.ts
```

Esto reemplaza el placeholder con tipos reales de las tablas/enums/funciones. Vas a ver enums como `album_status`, `sticker_rarity`, etc. y los args de los RPCs.

### 3.2 Completar `.env` del cliente

```powershell
cd client
copy .env.example .env
```

Editar `client/.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

(Valores de 1.1.)

### 3.3 Instalar deps y arrancar

```powershell
cd client
npm install
npm run ios        # o android, o start
```

Si todo va bien deberías ver la app con las 5 tabs y los placeholders. Si `env.ts` tira error en el arranque, falta completar el `.env`.

---

## Parte 4 — RevenueCat (más tarde)

Requiere productos aprobados en App Store Connect y Google Play Console, lo cual lleva varios días + tu Apple Developer ($99/año) + Google Play Developer ($25 one-time). Lo dejamos para cuando estés más cerca de TestFlight.

Cuando llegue el momento:
- Configurar productos en ASC + Play Console
- Conectar productos en RevenueCat dashboard
- Setear webhook URL: `https://<PROJECT_REF>.functions.supabase.co/revenuecat_webhook`
- Setear `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`
- Actualizar `REVENUECAT_WEBHOOK_SECRET` con el secret real
- Configurar `Purchases.logIn(user.id)` en el cliente (donde `user.id = auth.users.id`)

---

## Validación end-to-end

Cuando termines Parte 1 + 2 + 3, te paso un script de smoke test SQL para crear un álbum + figuritas + abrir un sobre. Sirve para validar que las migraciones se aplicaron bien antes de armar UI.
