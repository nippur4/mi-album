// Thumbnail unificado para carátulas de álbum y sobres.
// Reemplazó AlbumThumb (album-card), PackThumb (daily-album-row) y el bloque
// interno de FloatingPack — los tres tenían la misma lógica con paletas
// duplicadas.
//
// Renderiza en orden de prioridad:
//   1. Preset (gradient) si mediaKey es "preset:X"
//   2. Imagen R2 si mediaKey es una key válida
//   3. Fallback: bloque de color hasheado desde `seed` con la inicial

import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { PresetBackground } from '@/components/preset-background';
import { Colors, FontFamily, Radius } from '@/constants/theme';
import { isPreset, presetIdFromKey, r2Url } from '@/lib/storage';
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
  const radius = borderRadius ?? Radius.card;
  const containerStyle = [
    styles.container,
    { width, height, borderRadius },
    style,
  ];

  if (mediaKey && isPreset(mediaKey)) {
    return (
      <View style={containerStyle}>
        <PresetBackground id={presetIdFromKey(mediaKey)} />
      </View>
    );
  }

  const url = r2Url(mediaKey);
  if (url) {
    return (
      <View style={containerStyle}>
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      </View>
    );
  }

  const bg = fallbackBgFor(seed);
  const initial = initialOf(seed);
  const fontSize = fallbackFontSize ?? Math.round(width * 0.55);

  return (
    <View style={[containerStyle, { backgroundColor: bg }]}>
      <Text style={[styles.initial, { fontSize }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: Colors.paper2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontFamily: FontFamily.display,
    color: Colors.paper,
    letterSpacing: 1,
  },
});
