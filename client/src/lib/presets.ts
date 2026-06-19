// Plantillas de fondo para carátula y sobre cuando el owner no quiere subir
// imagen propia. Se guardan en cover_thumb_key / cover_large_key con el
// prefijo "preset:" (ver lib/storage.ts → isPreset/makePresetKey).
//
// El cliente detecta el prefijo y renderiza un LinearGradient local con
// expo-linear-gradient en vez de fetchear R2. El backend no necesita saber
// nada — es un string como cualquier otro.

export interface Preset {
  id: string;
  name: string;
  colors: [string, string]; // [top, bottom]
  textColor: string;
}

export const PRESETS: Preset[] = [
  { id: 'red',    name: 'Rojo',    colors: ['#D23A2E', '#8F2019'], textColor: '#FFFFFF' },
  { id: 'blue',   name: 'Azul',    colors: ['#5B8DEF', '#3A6BC5'], textColor: '#FFFFFF' },
  { id: 'teal',   name: 'Teal',    colors: ['#3FB6A8', '#2A8F84'], textColor: '#FFFFFF' },
  { id: 'violet', name: 'Violeta', colors: ['#B36BD4', '#7A4FB0'], textColor: '#FFFFFF' },
  { id: 'gold',   name: 'Dorado',  colors: ['#E8B24A', '#A9802F'], textColor: '#2A1E16' },
  { id: 'green',  name: 'Verde',   colors: ['#7FB83E', '#5B8A26'], textColor: '#FFFFFF' },
];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
