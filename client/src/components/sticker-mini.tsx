import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, FontSize, RarityFrame, Radius } from '@/constants/theme';
import { r2Url } from '@/lib/storage';
import type { Database } from '@/lib/database.types';

type Rarity = Database['public']['Enums']['sticker_rarity'];

interface Props {
  thumbKey: string | null;
  number: number;
  name: string;
  rarity: Rarity;
  size?: 'sm' | 'md';
}

// Mini carta de figurita para listas de coincidencias / ofertas. Imagen +
// número en mono + nombre Anton.
export function StickerMini({ thumbKey, number, name, rarity, size = 'md' }: Props) {
  const url = r2Url(thumbKey);
  const borderColor = RarityFrame[rarity];
  const dims = size === 'sm' ? { w: 64, h: 80 } : { w: 84, h: 104 };

  return (
    <View style={[styles.card, { borderColor, width: dims.w }]}>
      <View style={[styles.imageBox, { height: dims.h - 30 }]}>
        {url && (
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        )}
      </View>
      <View style={styles.footer}>
        <Text style={styles.number}>#{String(number).padStart(3, '0')}</Text>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.cell,
    borderWidth: 2,
    backgroundColor: Colors.paper,
    overflow: 'hidden',
  },
  imageBox: {
    backgroundColor: Colors.paper2,
  },
  footer: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  number: {
    fontFamily: FontFamily.mono,
    fontSize: 8,
    color: Colors.muted,
    letterSpacing: 1,
    fontWeight: '700',
  },
  name: {
    fontFamily: FontFamily.display,
    fontSize: 12,
    color: Colors.ink,
    lineHeight: 13,
  },
});
