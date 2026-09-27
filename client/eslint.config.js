// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // dist: build de web. database.types.ts: generado por `supabase gen types`
    // (viene con BOM UTF-16 a propósito, ver CLAUDE.md) → no lo linteamos.
    ignores: ["dist/*", "src/lib/database.types.ts"],
  },
  {
    rules: {
      // eslint-plugin-react-hooks v6 (lo trae eslint-config-expo) incluye reglas
      // del react-compiler muy estrictas, con falsos positivos para patrones
      // correctos y deliberados de esta app:
      //
      // - immutability: marca como error mutar `.value` de un shared value de
      //   Reanimated (`shake.value = ...`), que es EXACTAMENTE cómo la librería
      //   está diseñada para usarse. El analizador no modela Reanimated → off.
      //
      // - set-state-in-effect: marca el reset/sync de estado local de los modales
      //   cuando se abren (`useEffect(() => { if (visible) setX(props) })`) y el
      //   sync de settings desde el server. Es un patrón intencional y estándar;
      //   lo dejamos como warning (advisory) en vez de error para no bloquear.
      "react-hooks/immutability": "off",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
