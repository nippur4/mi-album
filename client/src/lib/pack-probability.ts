// Cálculo de probabilidades del sorteo de sobres.
//
// IMPORTANTE: estos pesos DEBEN coincidir con supabase/functions/open_pack/index.ts.
// Si cambia uno, cambiar el otro y redeploy de la Edge Function. La aritmética
// es intencional: mostrar en la UI los mismos números que el backend calcula.

import type { Sticker } from '@/lib/queries/albums';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const STICKER_WEIGHTS: Record<Rarity, number> = {
  common: 40,
  rare: 25,
  epic: 18,
  legendary: 12,
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Común',
  rare: 'Rara',
  epic: 'Épica',
  legendary: 'Legendaria',
};

export interface RarityBreakdown {
  rarity: Rarity;
  count: number;              // cuántas figus hay de esta rareza
  probPerPick: number;        // 0..1 — prob de que un pick sea esta rareza
  expectedPerPack: number;    // esperados por sobre (packSize)
}

export interface PackProbability {
  totalWeight: number;
  packSize: number;
  byRarity: RarityBreakdown[];
}

export function computePackProbability(
  stickers: Pick<Sticker, 'rarity'>[],
  packSize: number,
): PackProbability {
  const counts: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
  for (const s of stickers) counts[s.rarity as Rarity]++;

  const weightByRarity: Record<Rarity, number> = {
    common: counts.common * STICKER_WEIGHTS.common,
    rare: counts.rare * STICKER_WEIGHTS.rare,
    epic: counts.epic * STICKER_WEIGHTS.epic,
    legendary: counts.legendary * STICKER_WEIGHTS.legendary,
  };
  const totalWeight =
    weightByRarity.common + weightByRarity.rare + weightByRarity.epic + weightByRarity.legendary;

  const rarities: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
  const byRarity: RarityBreakdown[] = rarities.map((r) => {
    const probPerPick = totalWeight > 0 ? weightByRarity[r] / totalWeight : 0;
    return {
      rarity: r,
      count: counts[r],
      probPerPick,
      expectedPerPack: probPerPick * packSize,
    };
  });

  return { totalWeight, packSize, byRarity };
}

// Prob de sacar UNA figurita específica en un pick.
export function probPerPickForSticker(
  totalWeight: number,
  rarity: Rarity,
): number {
  if (totalWeight <= 0) return 0;
  return STICKER_WEIGHTS[rarity] / totalWeight;
}

// Prob de que UNA figurita específica aparezca AL MENOS UNA VEZ en un sobre.
// Como los picks son independientes con reposición: 1 - (1 - p)^packSize.
export function probInPackForSticker(
  totalWeight: number,
  rarity: Rarity,
  packSize: number,
): number {
  const p = probPerPickForSticker(totalWeight, rarity);
  return 1 - Math.pow(1 - p, packSize);
}

// Sobres esperados para que salga UNA copia de esta figurita en promedio.
// Es 1 / (probPerPick × packSize) ≈ paquetes hasta la primera aparición.
export function expectedPacksToGetSticker(
  totalWeight: number,
  rarity: Rarity,
  packSize: number,
): number {
  const p = probPerPickForSticker(totalWeight, rarity);
  if (p <= 0) return Infinity;
  return 1 / (p * packSize);
}
