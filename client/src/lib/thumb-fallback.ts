// Fallback consistente para thumbnails cuando no hay imagen R2 ni preset.
// Deriva un color de la paleta hasheando el seed (typically el nombre del
// álbum) y muestra la primera letra en Anton grande.
//
// Reemplazó las 3 copias que había en album-card, daily-album-row y
// floating-pack — mismo hash, misma paleta, misma lógica.

import { Colors } from '@/constants/theme';

export const THUMB_FALLBACK_PALETTE = [
  Colors.red,
  '#5B8DEF',
  '#7FB83E',
  Colors.gold,
  '#3FB6A8',
  '#B36BD4',
  '#EE6FA0',
  '#F2A03D',
] as const;

// djb2-ish simple hash: consistente cross-platform, sin dependencias.
export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// El seed suele ser el nombre del álbum, que viene de un RPC y PODRÍA ser
// null/undefined (o incluso un no-string) si el payload cambia. En release NO
// hay LogBox: un throw en render acá cerraría la app entera (pasaba en el tab
// Sobres). Estas dos funciones corren por CADA thumbnail, así que blindan a
// toda la app: nunca lanzan por un seed inválido.
function safeSeed(seed: unknown): string {
  return typeof seed === 'string' ? seed : '';
}

export function fallbackBgFor(seed: string): string {
  return THUMB_FALLBACK_PALETTE[hashStr(safeSeed(seed)) % THUMB_FALLBACK_PALETTE.length];
}

export function initialOf(seed: string): string {
  return (safeSeed(seed).trim()[0] ?? '?').toUpperCase();
}
