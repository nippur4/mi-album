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
  { key: 'fern',     name: 'Helecho',  bg: '#B2D4A4' },
  { key: 'olive',    name: 'Oliva',    bg: '#C9C98F' },
  { key: 'moss',     name: 'Musgo',    bg: '#9FB784' },
  { key: 'slate',    name: 'Pizarra',  bg: '#DDE2E6' },
  { key: 'stone',    name: 'Piedra',   bg: '#C9C2BC' },
  // Tonos un escalón más oscuros que el resto de la paleta.
  { key: 'clay',     name: 'Arcilla',  bg: '#C49A6C' },
  { key: 'grape',    name: 'Uva',      bg: '#9A87B8' },
  { key: 'pine',     name: 'Pino',     bg: '#8FAF97' },
  { key: 'jungle',   name: 'Selva',    bg: '#77A06B' },
  { key: 'swamp',    name: 'Pantano',  bg: '#8E9A6D' },
  { key: 'wine',     name: 'Vino',     bg: '#A86B7E' },
  { key: 'ocean',    name: 'Océano',   bg: '#7D93B5' },
  { key: 'graphite', name: 'Grafito',  bg: '#8A8D94' },
];

export const DEFAULT_PAGE_COLOR = 'white';

export function resolveColor(key: string | null | undefined): string {
  if (!key) return PAGE_COLORS[0].bg;
  const found = PAGE_COLORS.find((c) => c.key === key);
  return found?.bg ?? PAGE_COLORS[0].bg;
}

export type PageOrientation = 'portrait' | 'landscape';

export interface PageLayout {
  key: string;
  name: string;
  cols: number;
  rows: number;
  capacity: number;
  // Los layouts en formato retrato profundo (más filas que columnas o muy
  // apretados) no tienen sentido con figuritas apaisadas: la página se estira
  // hacia abajo y las figus quedan chatas. Se ofrece la opción de orientación
  // solo en layouts cuadrados o con pocas celdas.
  supportsLandscape?: boolean;
}

// Layouts disponibles. capacity = cols * rows. El cliente calcula el tamaño
// efectivo de cada celda según el espacio que cada layout deja disponible
// dentro de la hoja (que tiene tamaño constante).
export const PAGE_LAYOUTS: PageLayout[] = [
  { key: '3x4', name: '3 × 4', cols: 3, rows: 4, capacity: 12 },
  { key: '2x2', name: '2 × 2', cols: 2, rows: 2, capacity: 4,  supportsLandscape: true },
  { key: '2x3', name: '2 × 3', cols: 2, rows: 3, capacity: 6 },
  { key: '3x3', name: '3 × 3', cols: 3, rows: 3, capacity: 9,  supportsLandscape: true },
  { key: '2x4', name: '2 × 4', cols: 2, rows: 4, capacity: 8 },
  { key: '4x4', name: '4 × 4', cols: 4, rows: 4, capacity: 16, supportsLandscape: true },
];

export const DEFAULT_PAGE_LAYOUT = '3x4';
export const DEFAULT_PAGE_ORIENTATION: PageOrientation = 'portrait';

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
  // Tanda "prehistórica" (pensada para álbumes de dinosaurios).
  { key: 'paws',       name: 'Huellas' },
  { key: 'scales',     name: 'Escamas' },
  { key: 'bones',      name: 'Huesitos' },
  { key: 'ferns',      name: 'Helechos' },
];

export const DEFAULT_PAGE_TEXTURE = 'none';

export interface CellAspect {
  key: string;
  name: string;
  // Relación w/h de la celda (antes de aplicar orientation landscape).
  ratio: number;
  // Par [w,h] para el crop del ImagePicker al subir la foto de una figurita.
  crop: [number, number];
}

// Proporciones de figurita disponibles. La key se guarda en DB (default a
// nivel álbum + override por hoja); el ratio se resuelve en cliente.
// 'tall' existe porque las imágenes generadas tipo carta (2:3) se recortaban
// en la celda clásica.
export const CELL_ASPECTS: CellAspect[] = [
  { key: 'classic', name: 'Clásica',  ratio: 0.82,  crop: [4, 5] },
  { key: 'tall',    name: 'Carta',    ratio: 2 / 3, crop: [2, 3] },
  { key: 'square',  name: 'Cuadrada', ratio: 1,     crop: [1, 1] },
];

export const DEFAULT_CELL_ASPECT = 'classic';

export function resolveCellAspect(key: string | null | undefined): number {
  return (
    CELL_ASPECTS.find((a) => a.key === (key ?? DEFAULT_CELL_ASPECT))?.ratio ??
    CELL_ASPECTS[0].ratio
  );
}

export function cellAspectCrop(key: string | null | undefined): [number, number] {
  return (
    CELL_ASPECTS.find((a) => a.key === (key ?? DEFAULT_CELL_ASPECT))?.crop ??
    CELL_ASPECTS[0].crop
  );
}

export interface PageOverride {
  page: number;            // 0-indexed
  color?: string;
  layout?: string;
  texture?: string;
  // Título visible arriba de la hoja. Viaja dentro del jsonb de overrides,
  // así que no necesitó migración (el server lo guarda pasante).
  title?: string;
  // Proporción de figurita de esta hoja (key de CELL_ASPECTS).
  cellAspect?: string;
  // Solo aplica si el layout soporta landscape (ver supportsLandscape).
  // Cuando se persiste 'portrait' es equivalente a no persistirlo (default).
  orientation?: PageOrientation;
}

export interface BuiltPage {
  index: number;
  layout: PageLayout;
  colorKey: string;        // resuelto (default si no hay override)
  textureKey: string;
  cellAspectKey: string;
  orientation: PageOrientation;
  title?: string;          // solo si la hoja tiene título (no hay default)
  numbers: number[];
}

// Asigna sticker numbers a páginas según los layouts (con overrides).
// Cada página llena su capacidad y la siguiente sigue desde el último número.
// startNumber: primer número del álbum (1 salvo el álbum especial 0..1000).
export function buildPages(
  totalStickers: number,
  defaultColor: string,
  defaultTexture: string,
  overrides: PageOverride[],
  startNumber = 1,
  defaultCellAspect = DEFAULT_CELL_ASPECT,
  defaultLayout = DEFAULT_PAGE_LAYOUT,
): BuiltPage[] {
  const overrideByPage = new Map<number, PageOverride>();
  for (const o of overrides) overrideByPage.set(o.page, o);

  const pages: BuiltPage[] = [];
  const lastNumber = startNumber + totalStickers - 1;
  let n = startNumber;
  let pageIdx = 0;

  while (n <= lastNumber) {
    const ov = overrideByPage.get(pageIdx);
    const layout = resolveLayout(ov?.layout ?? defaultLayout);
    const cap = layout.capacity;
    const nums: number[] = [];
    for (let i = 0; i < cap && n <= lastNumber; i++) {
      nums.push(n++);
    }
    // Solo respetamos landscape si el layout lo soporta — evita quedar con
    // valores viejos guardados en overrides si el owner cambia el layout.
    const orientation: PageOrientation =
      ov?.orientation === 'landscape' && layout.supportsLandscape
        ? 'landscape'
        : DEFAULT_PAGE_ORIENTATION;
    const title = ov?.title?.trim();
    pages.push({
      index: pageIdx,
      layout,
      colorKey: ov?.color ?? defaultColor,
      textureKey: ov?.texture ?? defaultTexture,
      cellAspectKey: ov?.cellAspect ?? defaultCellAspect,
      orientation,
      title: title || undefined,
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
  cellAspect: string = DEFAULT_CELL_ASPECT,
  layout: string = DEFAULT_PAGE_LAYOUT,
) {
  return supabase.rpc('fn_update_album_pages', {
    p_album_id: albumId,
    p_bg_color: bgColor,
    p_texture: texture,
    p_cell_aspect: cellAspect,
    p_layout: layout,
    p_overrides: overrides as any,
  } as any);
}
