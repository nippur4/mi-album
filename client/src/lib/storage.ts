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
