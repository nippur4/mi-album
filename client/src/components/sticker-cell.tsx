import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, FontSize, Layout, RarityFrame, Radius } from '@/constants/theme';
import type { Sticker } from '@/lib/queries/albums';
import { r2Url } from '@/lib/storage';

interface Props {
  sticker: Sticker;
  onPress?: () => void;
}

// Celda de figurita para la grilla 3-col del álbum.
export function StickerCell({ sticker, onPress }: Props) {
  const url = r2Url(sticker.thumb_key);
  const borderColor = RarityFrame[sticker.rarity];

  return (
    <Pressable onPress={onPress} style={[styles.cell, { borderColor }]}>
      {url && (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}
      <View style={styles.numberBadge}>
        <Text style={styles.number}>{String(sticker.number).padStart(3, '0')}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    aspectRatio: Layout.gridCellAspect,
    borderRadius: Radius.cell,
    backgroundColor: Colors.paper2,
    borderWidth: 2,
    overflow: 'hidden',
    justifyContent: 'flex-start',
  },
  numberBadge: {
    position: 'absolute',
    top: 4,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(42,30,22,0.65)',
    borderRadius: 4,
  },
  number: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.paper,
    letterSpacing: 1,
    fontWeight: '700',
  },
});
