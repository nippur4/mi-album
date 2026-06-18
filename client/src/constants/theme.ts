// Mi Álbum de Figuritas — Design tokens
// Fuente de verdad: design_handoff_figuritas/README.md
// Toda decisión visual del proyecto debe derivar de acá; no hardcodear hex en
// componentes.

import { Platform } from 'react-native';

// ============================================================================
// COLORS
// ============================================================================

export const Colors = {
  // Tinta (texto principal y superficies oscuras)
  ink: '#2A1E16',
  inkSoft: '#5C4E3C',
  inkSofter: '#7C6A52',
  muted: '#9C8E79',
  mutedWarm: '#B89B6E',

  // Papel (fondos)
  paper: '#FBF3E2',       // bg principal
  paper2: '#F3E7CF',
  paper3: '#EDE0C6',
  paper4: '#F6EFE0',

  // Marca y acciones
  red: '#D23A2E',
  redDark: '#A4271F',
  redShadow: '#8F2019',   // "stacked button" CTA primaria

  // Premium / foil
  gold: '#E8B24A',
  goldDark: '#C98F2A',
  goldDarker: '#A9802F',

  // Éxito
  green: '#7FB83E',
  greenTextDark: '#173405',
  greenTextSoft: '#5B8A26',

  // Pendiente / warning
  amberWarn: '#C77E1A',
  amberWarnBg: '#FCEFD9',

  // Bordes hairline sobre paper (alpha del ink)
  border: 'rgba(42,30,22,0.10)',
  borderStrong: 'rgba(42,30,22,0.14)',
} as const;

// Paleta de figuritas (rareza/variedad). Usada como acento de celdas y creature.
export const StickerHues = {
  coral:   { fg: '#E85D4E', tint: '#FCE6E1' },
  amber:   { fg: '#F2A03D', tint: '#FCEFD9' },
  teal:    { fg: '#3FB6A8', tint: '#DEF1EE' },
  blue:    { fg: '#5B8DEF', tint: '#E2EBFB' },
  violet:  { fg: '#B36BD4', tint: '#EFE3F6' },
  green:   { fg: '#7FB83E', tint: '#EAF3DC' },
  pink:    { fg: '#EE6FA0', tint: '#FBE4EE' },
  cyan:    { fg: '#4FC0DA', tint: '#DFF1F7' },
} as const;

// Mapeo de rareza → color del marco/strip (matchea enum sticker_rarity del backend).
export const RarityFrame: Record<'common' | 'rare' | 'epic' | 'legendary', string> = {
  common: '#B89B6E',
  rare: '#5B8DEF',
  epic: '#7A4FB0',
  legendary: '#E8B24A',  // tiene sheen/foil animado en el componente
};

// ============================================================================
// TYPOGRAPHY
// ============================================================================

// Las fuentes se cargan vía expo-font en _layout.tsx (ver lib/fonts.ts).
// Estos nombres son los family names que registramos.
// Nota: el handoff pide Hanken Grotesque pero ese paquete no existe en
// @expo-google-fonts; usamos Manrope como sustituto cercano.
export const FontFamily = {
  display: 'Anton',                // títulos, números grandes, nombres de figurita
  body: 'Manrope',                 // UI / cuerpo (regular, medium, semibold, bold, extrabold)
  mono: 'SpaceMono',               // labels técnicas, códigos, countdown
} as const;

// Escala tipográfica (del README). Tamaños en px (RN los trata como pt).
export const FontSize = {
  screenTitle: 24,        // título de pantalla (Anton)
  progressNumber: 30,     // número grande de progreso (Anton)
  hBig: 32,               // hero (Anton)
  body: 15,
  bodySmall: 14,
  caption: 12,
  captionSmall: 11,
  monoLabel: 10,
  monoLabelSmall: 9,
} as const;

// ============================================================================
// SPACING / LAYOUT
// ============================================================================

export const Spacing = {
  // Padding horizontal de pantalla
  screenX: 22,
  // Gap entre cards de lista
  listGap: 10,
  // Grilla del álbum
  gridGap: 9,

  // Escala genérica (usar siempre múltiplos)
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  cell: 14,        // celdas de grilla
  card: 16,
  cardLg: 20,
  button: 13,
  buttonLg: 16,
  chip: 20,
  pill: 30,
  full: 9999,
} as const;

// ============================================================================
// SHADOWS
// ============================================================================
// React Native usa shadowColor/Offset/Opacity/Radius en iOS; Android usa elevation.
// Las helpers de abajo devuelven los styles ya armados.

export const Shadow = {
  // CTA primaria con sombra dura inferior — "botón apilado". En press la UI hunde
  // el botón (translateY +5) y reduce shadow a 0 (lo hace el componente Button).
  cta: (color: string = Colors.redShadow) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  }),
  // Card elevada
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 4,
  },
} as const;

// ============================================================================
// MISC
// ============================================================================

export const Layout = {
  // Grilla del álbum: 3 columnas con aspect ratio .82
  gridColumns: 3,
  gridCellAspect: 0.82,
  // Tab bar
  tabIconSize: 22,
  // CTA flotante inferior
  ctaBottomInset: Platform.select({ ios: 8, android: 12 }) ?? 8,
} as const;

// ============================================================================
// LEGACY (referencias del template, no usar para nuevo código)
// ============================================================================
// Mantenemos estas exports vacías por compat con el template hasta que terminemos
// el cleanup en src/components/. Después se borran.

export const Fonts = {
  sans: FontFamily.body,
  serif: FontFamily.body,
  rounded: FontFamily.body,
  mono: FontFamily.mono,
};

export type ThemeColor = keyof typeof Colors;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
