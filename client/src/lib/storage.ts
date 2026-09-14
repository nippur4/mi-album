// Helpers para mapear object keys de R2 a URLs completas.
//
// El backend guarda solo la key (ej. "albums/.../sticker/xxx-thumb.webp")
// y el cliente compone la URL pública en runtime. Si más adelante cambiamos
// la base URL (r2.dev → cdn.tuapp.com), no hay que tocar la DB.
//
// Caso especial: "preset:<id>" indica una plantilla local (gradiente) que se
// renderiza con expo-linear-gradient. Ver lib/presets.ts.

import { env } from './env';

const PRESET_PREFIX = 'preset:';

export function isPreset(key: string | null | undefined): key is string {
  return typeof key === 'string' && key.startsWith(PRESET_PREFIX);
}

export function presetIdFromKey(key: string): string {
  return key.slice(PRESET_PREFIX.length);
}

export function makePresetKey(presetId: string): string {
  return `${PRESET_PREFIX}${presetId}`;
}

export function r2Url(key: string | null | undefined): string | null {
  if (!key || isPreset(key)) return null;
  return `${env.r2PublicBaseUrl}/${key}`;
}

// Deriva la key del thumb a partir de la del large. Las dos variantes solo se
// diferencian por el sufijo `-large.` / `-thumb.` (ver upload_image), así que
// donde solo tenemos el large_key (ej. lo que devuelve open_pack) podemos
// pedir el thumb — mucho más liviano y casi siempre ya cacheado por la grilla
// del álbum, que renderiza thumbs. Si la key no matchea el patrón, devolvemos
// la original tal cual (fallback seguro).
export function thumbFromLargeKey(key: string | null | undefined): string | null {
  if (!key || isPreset(key)) return null;
  // isPreset es un type guard `key is string`, así que en esta rama TS reduce
  // key a `never`; el cast lo devuelve a string (en runtime siempre lo es).
  const k = key as string;
  return k.includes('-large.') ? k.replace('-large.', '-thumb.') : k;
}
