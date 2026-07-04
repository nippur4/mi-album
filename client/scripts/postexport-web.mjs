// Post-processing del output de `expo export --platform web`.
//
// Motivo: Cloudflare Pages ignora silenciosamente cualquier archivo dentro
// de una carpeta llamada `node_modules/` — es una convención del uploader
// (wrangler), no está documentada. Expo Web pone los assets bajo
// `dist/assets/node_modules/@expo-google-fonts/...` y `@expo/vector-icons/...`,
// así que TODAS las fuentes + iconos vector se pierden en el upload.
//
// Este script renombra la carpeta a `vendor/` y actualiza las referencias
// en los JS bundles del `_expo/static/js/web/`. Cross-platform (usa APIs de
// Node), reemplazando la versión bash que teníamos en el build command.

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const oldPath = path.join(distDir, 'assets', 'node_modules');
const newPath = path.join(distDir, 'assets', 'vendor');
const bundlesDir = path.join(distDir, '_expo', 'static', 'js', 'web');

const OLD_TOKEN = 'assets/node_modules';
const NEW_TOKEN = 'assets/vendor';

function fail(msg) {
  console.error(`[postexport-web] ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(distDir)) {
  fail(`No se encontró ${distDir}. Corré antes: npx expo export --platform web`);
}

if (fs.existsSync(oldPath)) {
  if (fs.existsSync(newPath)) {
    // Idempotencia: si ya corrió antes, limpiar el vendor viejo primero.
    fs.rmSync(newPath, { recursive: true, force: true });
  }
  fs.renameSync(oldPath, newPath);
  console.log(`[postexport-web] Renombrado assets/node_modules → assets/vendor`);
} else if (fs.existsSync(newPath)) {
  console.log(`[postexport-web] Ya estaba renombrado (idempotente).`);
} else {
  console.log(`[postexport-web] No hay assets/node_modules — skip.`);
}

// Reescribir referencias en los JS bundles. Expo genera ~2 archivos (entry, index).
if (fs.existsSync(bundlesDir)) {
  const files = fs.readdirSync(bundlesDir).filter((f) => f.endsWith('.js'));
  let touched = 0;
  for (const file of files) {
    const filePath = path.join(bundlesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes(OLD_TOKEN)) {
      const updated = content.split(OLD_TOKEN).join(NEW_TOKEN);
      fs.writeFileSync(filePath, updated, 'utf8');
      touched++;
    }
  }
  console.log(`[postexport-web] Bundles actualizados: ${touched}/${files.length}`);
} else {
  console.log(`[postexport-web] No se encontró ${bundlesDir} — nada que reescribir.`);
}
