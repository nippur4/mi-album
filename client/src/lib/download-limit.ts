// Límite de descargas de PDF de álbum: 1 por álbum por usuario cada 7 días.
//
// Client-side a propósito (decisión con Nico): la descarga es 100% en el
// dispositivo (no toca el server), y el objetivo es evitar re-descargas al pedo
// —en álbumes grandes bajar todas las imágenes no es trivial—, no frenar fraude.
// Guardamos la última descarga por (uid, albumId) en AsyncStorage (→ localStorage
// en web). El límite vale por dispositivo, que alcanza para el caso real.

import AsyncStorage from '@react-native-async-storage/async-storage';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Namespaced por uid para que dos cuentas en el mismo dispositivo no compartan
// el límite.
function storageKey(uid: string, albumId: string): string {
  return `dl:${uid}:${albumId}`;
}

// ¿Puede descargar este álbum ahora? Bloquea si lo bajó hace menos de 7 días.
// nextAt = ms epoch a partir del cual vuelve a estar habilitado.
export async function canDownloadAlbum(
  uid: string,
  albumId: string,
): Promise<{ allowed: boolean; nextAt: number | null }> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(uid, albumId));
    const last = raw ? Number(raw) : 0;
    if (!last || !Number.isFinite(last)) return { allowed: true, nextAt: null };
    const nextAt = last + WEEK_MS;
    if (Date.now() >= nextAt) return { allowed: true, nextAt: null };
    return { allowed: false, nextAt };
  } catch {
    // Si el storage falla, permitimos (mejor no trabar la feature por esto).
    return { allowed: true, nextAt: null };
  }
}

// Registra que se descargó recién. Best-effort: si falla el storage, no rompe.
export async function recordAlbumDownload(uid: string, albumId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(uid, albumId), String(Date.now()));
  } catch {
    // best-effort
  }
}

// Etiqueta legible del día en que vuelve a poder descargar (ej. "el 30/09").
export function nextDownloadLabel(nextAt: number): string {
  const d = new Date(nextAt);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `el ${dd}/${mm}`;
}
