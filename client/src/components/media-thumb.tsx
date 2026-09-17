// Thumbnail para carátulas y sobres: MediaBackground + fallback de color
// hasheado desde `seed` con la inicial.

import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { MediaBackground } from '@/components/media-background';
import { Colors, FontFamily } from '@/constants/theme';
import { fallbackBgFor, initialOf } from '@/lib/thumb-fallback';

interface Props {
  mediaKey?: string | null;
  // Semilla del fallback (típicamente el nombre del álbum). Sin esto no
  // podemos derivar color/letra si no hay imagen.
  seed: string;
  // width (px) — el height se calcula con aspect.
  width: number;
  // Relación w/h. 4/5 para carátulas, 3/4 para sobres, 1 para círculos, etc.
  aspect: number;
  borderRadius?: number;
  // Tamaño de la letra del fallback. Si no se pasa, se escala del width.
  fallbackFontSize?: number;
  style?: StyleProp<ViewStyle>;
}

export function MediaThumb({
  mediaKey,
  seed,
  width,
  aspect,
  borderRadius,
  fallbackFontSize,
  style,
}: Props) {
  const height = width / aspect;
  const fontSize = fallbackFontSize ?? Math.round(width * 0.55);

  return (
    <View style={[styles.container, { width, height, borderRadius }, style]}>
      <MediaBackground
        mediaKey={mediaKey}
        fallback={
          <View style={[StyleSheet.absoluteFill, styles.fallback, { backgroundColor: fallbackBgFor(seed) }]}>
            <Text style={[styles.initial, { fontSize }]}>{initialOf(seed)}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: Colors.paper2,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: FontFamily.display,
    color: Colors.paper,
    letterSpacing: 1,
  },
});
