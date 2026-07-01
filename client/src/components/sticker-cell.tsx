import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, FontFamily, FontSize, Layout, RarityFrame, Radius } from '@/constants/theme';
import type { Sticker } from '@/lib/queries/albums';
import { r2Url } from '@/lib/storage';

interface Props {
  sticker: Sticker;
  // 'pasted' = ya pegada en el álbum. 'to_paste' = la tengo pero falta pegarla
  //   (la celda se ve "viva" con borde gold + badge PEGAR para invitar al tap).
  state?: 'pasted' | 'to_paste';
  // Si > 0, hay repetidas adicionales.
  extraCount?: number;
  onPress?: () => void;
  // Override de estilos (se aplica al final para pisar aspectRatio, etc.).
  // Se usa desde AlbumPager para forzar orientación landscape en algunos layouts.
  style?: StyleProp<ViewStyle>;
}

// Celda de figurita en la grilla. Tres modos de uso:
//   - state='pasted' (default): pegada en el álbum, borde de rareza
//   - state='to_paste': tengo sin pegar (gold, tap para pegar)
//   - extraCount>0: badge REPE ×N abajo-derecha
export function StickerCell({ sticker, state = 'pasted', extraCount = 0, onPress, style }: Props) {
  const url = r2Url(sticker.thumb_key);
  const borderColor = state === 'to_paste' ? Colors.gold : RarityFrame[sticker.rarity];

  return (
    <Pressable onPress={onPress} style={[styles.cell, { borderColor }, state === 'to_paste' && styles.cellToPaste, style]}>
      {url && (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}
      <View style={styles.numberBadge}>
        <Text style={styles.number}>{String(sticker.number).padStart(3, '0')}</Text>
      </View>
      {state === 'to_paste' ? (
        <View style={styles.toPasteBadge}>
          <Text style={styles.toPasteText}>
            PEGAR{extraCount > 0 ? ` ×${extraCount + 1}` : ''}
          </Text>
        </View>
      ) : extraCount > 0 ? (
        <View style={styles.repeBadge}>
          <Text style={styles.repeText}>REPE ×{extraCount}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// Placeholder de figurita vacía en el draft del owner (dashed, opcional +).
interface EmptyCellProps {
  number: number;
  showPlus?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}
export function StickerCellEmpty({ number, showPlus, onPress, style }: EmptyCellProps) {
  return (
    <Pressable onPress={onPress} style={[styles.cellEmpty, style]}>
      <Text style={styles.emptyNumber}>{String(number).padStart(3, '0')}</Text>
      {showPlus && <Text style={styles.plus}>+</Text>}
    </Pressable>
  );
}

// Placeholder de figurita faltante en la grilla del user (silueta gris).
interface MissingCellProps {
  number: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}
export function StickerCellMissing({ number, onPress, style }: MissingCellProps) {
  return (
    <Pressable onPress={onPress} style={[styles.cellMissing, style]}>
      <Text style={styles.missingNumber}>{String(number).padStart(3, '0')}</Text>
      <View style={styles.silhouette} />
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
  repeBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: Colors.green,
    borderRadius: 4,
  },
  repeText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.greenTextDark,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // Variante to_paste: borde gold + glow leve + badge gold "PEGAR"
  cellToPaste: {
    backgroundColor: Colors.paper2,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
  toPasteBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: Colors.gold,
    borderRadius: 4,
  },
  toPasteText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.ink,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  // Empty (draft del owner): celda recesada con borde dashed.
  cellEmpty: {
    aspectRatio: Layout.gridCellAspect,
    borderRadius: Radius.cell,
    backgroundColor: Colors.paper3,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  emptyNumber: {
    position: 'absolute',
    top: 4,
    left: 6,
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1,
    fontWeight: '700',
  },
  plus: {
    fontFamily: FontFamily.display,
    fontSize: 28,
    color: Colors.muted,
    lineHeight: 30,
  },
  // Missing (vista del user): silueta gris con número translúcido encima.
  cellMissing: {
    aspectRatio: Layout.gridCellAspect,
    borderRadius: Radius.cell,
    backgroundColor: Colors.paper3,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  missingNumber: {
    position: 'absolute',
    top: 4,
    left: 6,
    fontFamily: FontFamily.display,
    fontSize: 18,
    color: Colors.mutedWarm,
    opacity: 0.5,
    letterSpacing: 1,
  },
  silhouette: {
    width: '50%',
    height: '50%',
    borderRadius: 999,
    backgroundColor: Colors.mutedWarm,
    opacity: 0.35,
  },
});
