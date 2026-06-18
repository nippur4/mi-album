// Helpers para mapear object keys de R2 a URLs completas.
//
// El backend guarda solo la key (ej. "albums/.../sticker/xxx-thumb.webp")
// y el cliente compone la URL pública en runtime. Si más adelante cambiamos
// la base URL (r2.dev → cdn.tuapp.com), no hay que tocar la DB.

import { env } from './env';

export function r2Url(key: string | null | undefined): string | null {
  if (!key) return null;
  return `${env.r2PublicBaseUrl}/${key}`;
}
