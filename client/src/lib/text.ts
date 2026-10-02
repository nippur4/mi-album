// Helpers de texto compartidos. Viven acá (y no en el módulo de cada
// pantalla) porque la misma normalización la necesitan los buscadores de
// intercambios, el panel de admin y el slug del PDF — estaban copiados en
// los tres, cada copia con su propio criterio sobre el fallback de Hermes.

// Hermes moderno soporta String.prototype.normalize, pero no está garantizado
// en todas las builds: si falta, tira. Degradamos a comparación directa en vez
// de romper la pantalla que esté buscando.
export function stripAccents(s: string): string {
  try {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch {
    return s;
  }
}

// Forma canónica para comparar texto escrito por el usuario: sin tildes,
// minúsculas y sin espacios en los extremos.
export function normalize(s: string): string {
  return stripAccents(s.toLowerCase()).trim();
}

// Número de figurita con 3 dígitos ('7' → '007'). El '#' lo pone cada caller,
// que es quien sabe si va en el copy o no.
export function padStickerNumber(n: number): string {
  return String(n).padStart(3, '0');
}
