import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import type { PackConfig } from '@/lib/queries/economy';
import type { Rarity } from '@/lib/queries/stickers';

// Probabilidades default si el álbum aún no las customizó.
// Coinciden con los defaults del backend (open_pack Edge Function).
const DEFAULT_RARITY_PROBS: Record<Rarity, number> = {
  common: 50,
  rare: 27,
  epic: 15,
  legendary: 8,
};

interface Props {
  rarity: Rarity;
  packConfig?: PackConfig | null;
}

// Una línea explicando qué implica la rareza para el owner: % de salida en
// sobres + cuántos sobres en promedio para sacar una. La cantidad esperada
// por sobre es prob * pack_size; si >= 1 sale en cada sobre, si no decimos
// "1 cada N sobres".
export function RarityInfoLine({ rarity, packConfig }: Props) {
  const probs = (packConfig as any)?.rarity_probs ?? DEFAULT_RARITY_PROBS;
  const packSize = packConfig?.pack_size ?? 5;
  const prob = (probs[rarity] ?? DEFAULT_RARITY_PROBS[rarity]) as number;
  const expectedPerPack = (prob / 100) * packSize;

  let frequency: string;
  if (expectedPerPack >= 1.5) {
    const perPack = Math.round(expectedPerPack);
    frequency = `~${perPack} por sobre en promedio`;
  } else if (expectedPerPack >= 0.8) {
    frequency = 'casi 1 por sobre';
  } else {
    const sobres = Math.round(1 / expectedPerPack);
    frequency = `1 cada ~${sobres} sobres`;
  }

  return (
    <View style={styles.box}>
      <Text style={styles.text}>
        <Text style={styles.strong}>{prob}%</Text> de probabilidad por figurita
        <Text style={styles.dim}> · </Text>
        {frequency}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: Colors.paper2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  text: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    lineHeight: 18,
  },
  strong: {
    fontFamily: FontFamily.mono,
    fontWeight: '800',
    color: Colors.ink,
  },
  dim: {
    color: Colors.muted,
  },
});
