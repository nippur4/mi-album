# Mi Álbum de Figuritas — Cliente (Expo)

App móvil React Native con Expo SDK 56 + expo-router. Backend en Supabase (ver `../supabase/`).

## Setup

```bash
cd client
npm install         # o npx expo install para que las versiones se ajusten al SDK
cp .env.example .env
# completar EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY con los del proyecto Supabase
```

### Tipos de la DB (cuando exista el proyecto Supabase)

```bash
npx supabase gen types typescript --project-id <REF> > src/lib/database.types.ts
```

## Correr

```bash
npm run ios          # simulador iOS (requiere macOS)
npm run android      # emulador Android
npm run web          # navegador
npm start            # Metro bundler + QR para Expo Go
```

## Estructura

```
client/
├── app.json                  config Expo (name, slug, scheme, plugins)
├── src/
│   ├── app/                  rutas file-based de expo-router
│   │   ├── _layout.tsx       Stack root + carga de fonts + splash
│   │   └── (tabs)/
│   │       ├── _layout.tsx   NativeTabs (5 ítems)
│   │       ├── index.tsx     Inicio (Landing)
│   │       ├── album.tsx     Álbum
│   │       ├── packs.tsx     Sobres
│   │       ├── trades.tsx    Cambios
│   │       └── profile.tsx   Perfil
│   ├── components/           UI compartida
│   ├── constants/
│   │   └── theme.ts          design tokens del handoff (colors, typography, spacing, radii, shadows)
│   └── lib/
│       ├── env.ts            lectura de EXPO_PUBLIC_*
│       ├── fonts.ts          useAppFonts() (Anton, Hanken Grotesque, Space Mono)
│       ├── supabase.ts       cliente Supabase tipado
│       ├── database.types.ts placeholder hasta `supabase gen types`
│       └── errors.ts         mapeo SQLSTATE P00XX → keys de UI + copy en español
```

## Decisiones

- **expo-router v5** con file-based routing + grupos para tabs.
- **NativeTabs** (`expo-router/unstable-native-tabs`): UITabBar nativo en iOS, BottomNavigationView en Android. Iconos vía SF Symbols / Android drawables.
- **AsyncStorage** para la sesión de Supabase (no SecureStore — tiene cap de 2KB).
- **Toda mutación pasa por RPC o Edge Function** del backend. El cliente nunca hace UPDATE/INSERT directo sobre tablas críticas.
- **Errores del backend** vienen con SQLSTATE `P00XX`. Usar `toAppError(err)` para normalizar a `AppErrorKey` y `errorMessage(err)` para copy en español.
