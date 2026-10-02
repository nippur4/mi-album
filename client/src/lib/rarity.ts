// Rarezas: orden canónico y etiquetas en español. Única fuente — estaban
// duplicadas en rarity-pills (selector del editor), sticker-view-mode (vista
// grande, en mayúsculas) y pack-probability (desglose de probabilidades), con
// el riesgo de que una se renombrara y las otras no.
//
// Los PESOS del sorteo no van acá: viven en lib/pack-probability.ts porque
// tienen que espejar los de la Edge Function open_pack.

import type { Rarity } from '@/lib/queries/stickers';

export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Común',
  rare: 'Rara',
  epic: 'Épica',
  legendary: 'Legendaria',
};
