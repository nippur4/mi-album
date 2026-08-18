// Helpers de búsqueda/filtrado para las pantallas de intercambio (Ofertas y
// Coincidencias). Todo client-side sobre datos ya cargados: los buscadores por
// nombre/número solo se aplican cuando el usuario confirma con "Buscar" (el
// estado "aplicado" vive en la pantalla; el draft en el panel de filtros).

// Búsqueda de texto ya confirmada. card = nombre o número de figurita; user =
// nombre de usuario. Ambos vacíos = sin filtro de texto.
export interface TradeSearch {
  card: string;
  user: string;
}

export const EMPTY_SEARCH: TradeSearch = { card: '', user: '' };

export function hasSearch(s: TradeSearch): boolean {
  return !!(s.card || s.user);
}

// Tope de resultados mostrados tras filtrar — para que la lista (y el render)
// no se vuelva pesada. Se paginan de a PAGE_SIZE.
export const RESULTS_CAP = 50;
export const PAGE_SIZE = 10;

// Fold de acentos para comparar sin sensibilidad a tildes. Hermes moderno
// soporta String.prototype.normalize; si no, degradamos a comparación directa.
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

// ¿Alguna de las cartas matchea la query? Si la query es numérica → por número
// (exacto o prefijo: "12" trae 12, 120, 123). Si es texto → substring del nombre.
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

// ¿Alguno de los nombres de usuario matchea la query? (substring)
export function userMatches(query: string, names: Array<string | null | undefined>): boolean {
  const q = normalize(query);
  if (!q) return true;
  return names.some((n) => !!n && normalize(n).includes(q));
}
