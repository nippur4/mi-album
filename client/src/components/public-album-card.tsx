import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PresetBackground } from '@/components/preset-background';
import { ProgressBar } from '@/components/progress-bar';
import { Colors, FontFamily, Radius, Shadow, Spacing } from '@/constants/theme';
import { getPreset } from '@/lib/presets';
import { isPreset, presetIdFromKey, r2Url } from '@/lib/storage';

// Solo los campos que la card renderiza — compatible con el Album completo
// y con la proyección mínima del bundle del Home (HomeAlbum).
interface PublicCardAlbum {
  name: string;
  total_stickers: number;
  cover_large_key: string | null;
}

interface Props {
  album: PublicCardAlbum;
  // Progreso del caller en este álbum (0..1). Si el caller no se unió, 0.
  progress?: number;
  // Contador "X/N · P%"
  counter?: { current: number; total: number };
  onPress?: () => void;
}

// Card del carrusel de "Álbumes públicos" (handoff 01).
// Gradient (o foto) + tag PÚBLICO + total gold + nombre Anton grande + barra
// + contador "X/N · P%". Texto blanco siempre encima.
export function PublicAlbumCard({ album, progress = 0, counter, onPress }: Props) {
  const url = r2Url(album.cover_large_key);
  const presetId = isPreset(album.cover_large_key) ? presetIdFromKey(album.cover_large_key!) : null;
  const preset = presetId ? getPreset(presetId) : null;

  // Tinte de fallback si no hay imagen ni preset
  const fallbackColors: [string, string] = [Colors.red, Colors.redDark];

  const pctText = counter
    ? `${counter.current}/${counter.total} · ${Math.round((counter.current / counter.total) * 100)}%`
    : `${album.total_stickers}`;

  // El cuerpo del nombre escala según el largo para que entre COMPLETO en la
  // card (a 26px un nombre largo se comía el "..." a las 3 líneas).
  const nameSize = album.name.length <= 18 ? 26 : album.name.length <= 32 ? 21 : 17;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      {/* Capa de fondo */}
      {url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : preset ? (
        <PresetBackground id={preset.id} />
      ) : (
        <LinearGradient
          colors={fallbackColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      {/* Overlay sutil para mejorar legibilidad sobre fotos */}
      {url && (
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.45)']}
          start={{ x: 0, y: 0.3 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Top row: tag PÚBLICO + total */}
      <View style={styles.topRow}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>PÚBLICO</Text>
        </View>
        <Text style={styles.totalGold}>{album.total_stickers}</Text>
      </View>

      {/* Nombre Anton grande + barra + counter */}
      <View style={styles.bottom}>
        <Text
          style={[styles.name, { fontSize: nameSize, lineHeight: nameSize + 2 }]}
          numberOfLines={4}
        >
          {album.name.toUpperCase()}
        </Text>
        {counter && (
          <>
            <ProgressBar value={progress} variant="gold" trackColor="rgba(0,0,0,0.25)" />
            <Text style={styles.counter}>{pctText}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 196,
    aspectRatio: 4 / 5,
    borderRadius: Radius.cardLg,
    overflow: 'hidden',
    padding: Spacing.md,
    justifyContent: 'space-between',
    ...Shadow.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 4,
  },
  tagText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  totalGold: {
    fontFamily: FontFamily.display,
    fontSize: 14,
    color: Colors.gold,
    letterSpacing: 0.5,
  },
  bottom: {
    gap: 6,
  },
  name: {
    fontFamily: FontFamily.display,
    fontSize: 26,
    color: '#FFFFFF',
    lineHeight: 28,
    letterSpacing: 0.5,
  },
  counter: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 1.2,
    fontWeight: '700',
  },
});
