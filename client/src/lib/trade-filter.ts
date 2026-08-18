// Helpers de búsqueda/filtrado para las pantallas de intercambio. card = nombre
// o número de figurita; user = nombre de usuario.
export interface TradeSearch {
  card: string;
  user: string;
}

export const EMPTY_SEARCH: TradeSearch = { card: '', user: '' };

export function hasSearch(s: TradeSearch): boolean {
  return !!(s.card || s.user);
}

// Tope de resultados mostrados tras filtrar; se paginan de a PAGE_SIZE.
export const RESULTS_CAP = 50;
export const PAGE_SIZE = 10;

// Hermes moderno soporta normalize; si no, degradamos a comparación directa.
function stripAccents(s: string): string {
  try {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  } catch {
    return s;
  }
}

export function normalize(s: string): string {
  return stripAccents(s.toLowerCase()).trim();
}

type CardLike = { name: string; number: number } | null | undefined;

// Query numérica → por número (exacto o prefijo). Texto → substring del nombre.
export function cardMatches(query: string, cards: CardLike[]): boolean {
  const q = normalize(query);
  if (!q) return true;
  const numeric = /^\d+$/.test(q);
  return cards.some((c) => {
    if (!c) return false;
    if (numeric) {
      const n = String(c.number);
      return n === q || n.startsWith(q);
    }
    return normalize(c.name).includes(q);
  });
}

export function userMatches(query: string, names: Array<string | null | undefined>): boolean {
  const q = normalize(query);
  if (!q) return true;
  return names.some((n) => !!n && normalize(n).includes(q));
}
