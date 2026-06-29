// Configuración de hojas del álbum: paleta de colores + layouts disponibles,
// helpers de build y persistencia.

import { supabase } from '@/lib/supabase';

export interface PageColor {
  key: string;
  name: string;
  bg: string;
}

// Paleta predefinida. Las keys se guardan en DB; el bg se resuelve en cliente.
// Si en el futuro cambiamos el hex, los álbumes existentes se actualizan automáticamente.
// El default es blanco para que la hoja destaque sobre el fondo cream del body.
export const PAGE_COLORS: PageColor[] = [
  { key: 'white',    name: 'Blanco',   bg: '#FFFFFF' },
  { key: 'paper',    name: 'Paper',    bg: '#FBF3E2' },
  { key: 'cream',    name: 'Crema',    bg: '#F7EDD9' },
  { key: 'butter',   name: 'Manteca',  bg: '#F4E8B0' },
  { key: 'ocre',     name: 'Ocre',     bg: '#F0E4C8' },
  { key: 'peach',    name: 'Durazno',  bg: '#FCDDC5' },
  { key: 'coral',    name: 'Coral',    bg: '#F5C8A8' },
  { key: 'rose',     name: 'Rosa',     bg: '#F4DDDD' },
  { key: 'plum',     name: 'Ciruela',  bg: '#D2BCE0' },
  { key: 'lavender', name: 'Lavanda',  bg: '#E2D9F1' },
  { key: 'sky',      name: 'Cielo',    bg: '#D9E8F4' },
  { key: 'teal',     name: 'Turquesa', bg: '#B8E0DA' },
  { key: 'mint',     name: 'Menta',    bg: '#D5EBDC' },
  { key: 'sage',     name: 'Salvia',   bg: '#C8D8B5' },
  { key: 'slate',    name: 'Pizarra',  bg: '#DDE2E6' },
  { key: 'stone',    name: 'Piedra',   bg: '#C9C2BC' },
];

export const DEFAULT_PAGE_COLOR = 'white';

export function resolveColor(key: string | null | undefined): string {
  if (!key) return PAGE_COLORS[0].bg;
  const found = PAGE_COLORS.find((c) => c.key === key);
  return found?.bg ?? PAGE_COLORS[0].bg;
}

export interface PageLayout {
  key: string;
  name: string;
  cols: number;
  rows: number;
  capacity: number;
}

// Layouts disponibles. capacity = cols * rows. El cliente calcula el tamaño
// efectivo de cada celda según el espacio que cada layout deja disponible
// dentro de la hoja (que tiene tamaño constante).
export const PAGE_LAYOUTS: PageLayout[] = [
  { key: '3x4', name: '3 × 4', cols: 3, rows: 4, capacity: 12 },
  { key: '2x3', name: '2 × 3', cols: 2, rows: 3, capacity: 6 },
  { key: '3x3', name: '3 × 3', cols: 3, rows: 3, capacity: 9 },
  { key: '2x4', name: '2 × 4', cols: 2, rows: 4, capacity: 8 },
  { key: '4x4', name: '4 × 4', cols: 4, rows: 4, capacity: 16 },
];

export const DEFAULT_PAGE_LAYOUT = '3x4';

export function resolveLayout(key: string | null | undefined): PageLayout {
  return (
    PAGE_LAYOUTS.find((l) => l.key === (key ?? DEFAULT_PAGE_LAYOUT)) ?? PAGE_LAYOUTS[0]
  );
}

export interface PageTexture {
  key: string;
  name: string;
}

// Texturas que se aplican sobre el color de la hoja, debajo de las celdas.
// El render real lo hace components/page-texture.tsx con react-native-svg.
export const PAGE_TEXTURES: PageTexture[] = [
  { key: 'none',       name: 'Sin textura' },
  { key: 'dots',       name: 'Puntos' },
  { key: 'lines',      name: 'Líneas' },
  { key: 'grid',       name: 'Cuadrícula' },
  { key: 'crosshatch', name: 'Tramado' },
  { key: 'diagonals',  name: 'Diagonales' },
  { key: 'rings',      name: 'Anillos' },
  { key: 'triangles',  name: 'Triángulos' },
  { key: 'stars',      name: 'Estrellas' },
  { key: 'plus',       name: 'Cruces' },
  { key: 'waves',      name: 'Olas' },
  { key: 'zigzag',     name: 'Zigzag' },
];

export const DEFAULT_PAGE_TEXTURE = 'none';

export interface PageOverride {
  page: number;            // 0-indexed
  color?: string;
  layout?: string;
  texture?: string;
}

export interface BuiltPage {
  index: number;
  layout: PageLayout;
  colorKey: string;        // resuelto (default si no hay override)
  textureKey: string;
  numbers: number[];
}

// Asigna sticker numbers a páginas según los layouts (con overrides).
// Cada página llena su capacidad y la siguiente sigue desde el último número.
export function buildPages(
  totalStickers: number,
  defaultColor: string,
  defaultTexture: string,
  overrides: PageOverride[],
): BuiltPage[] {
  const overrideByPage = new Map<number, PageOverride>();
  for (const o of overrides) overrideByPage.set(o.page, o);

  const pages: BuiltPage[] = [];
  let n = 1;
  let pageIdx = 0;

  while (n <= totalStickers) {
    const ov = overrideByPage.get(pageIdx);
    const layout = resolveLayout(ov?.layout);
    const cap = layout.capacity;
    const nums: number[] = [];
    for (let i = 0; i < cap && n <= totalStickers; i++) {
      nums.push(n++);
    }
    pages.push({
      index: pageIdx,
      layout,
      colorKey: ov?.color ?? defaultColor,
      textureKey: ov?.texture ?? defaultTexture,
      numbers: nums,
    });
    pageIdx++;
  }

  return pages;
}

export async function updateAlbumPages(
  albumId: string,
  bgColor: string,
  texture: string,
  overrides: PageOverride[],
) {
  return supabase.rpc('fn_update_album_pages', {
    p_album_id: albumId,
    p_bg_color: bgColor,
    p_texture: texture,
    p_overrides: overrides as any,
  });
}
