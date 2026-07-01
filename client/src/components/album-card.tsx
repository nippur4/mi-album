import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PresetBackground } from '@/components/preset-background';
import { ProgressBar } from '@/components/progress-bar';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import type { Album } from '@/lib/queries/albums';
import { isPreset, presetIdFromKey, r2Url } from '@/lib/storage';

interface Props {
  album: Album;
  // 0..1 — progreso (pegadas o cargadas según role)
  progress?: number;
  // Contador "X / N"
  counter?: { current: number; total: number };
  // Etiqueta de rol opcional ("TUYO", "JUGÁS")
  roleTag?: string;
  onPress?: () => void;
}

// Lista compacta del Landing: avatar + nombre + barra + contador mono.
// Refleja el diseño del handoff (screen 01, "Mis álbumes").
export function AlbumCard({ album, progress, counter, roleTag, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <AlbumThumb album={album} />
      <View style={styles.center}>
        <View style={styles.titleRow}>
          <Text style={styles.name} numberOfLines={1}>{album.name}</Text>
          {roleTag && <Text style={styles.roleTag}>{roleTag}</Text>}
        </View>
        {progress !== undefined && (
          <ProgressBar value={progress} variant="gold" />
        )}
      </View>
      {counter && (
        <View style={styles.counter}>
          <Text style={styles.counterCurrent}>{counter.current}</Text>
          <Text style={styles.counterTotal}>/{counter.total}</Text>
        </View>
      )}
    </Pressable>
  );
}

// Thumbnail del álbum en el MISMO formato que se le pide al owner cargar
// (4:5, carátula). Puede ser preset (gradient) o imagen R2. Si el álbum aún
// no tiene carátula, fallback: bloque de color hasheado + iniciales.
const THUMB_FALLBACK_PALETTE = [
  Colors.red, '#5B8DEF', '#7FB83E', Colors.gold,
  '#3FB6A8', '#B36BD4', '#EE6FA0', '#F2A03D',
];
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function AlbumThumb({ album }: { album: Album }) {
  const key = album.cover_thumb_key;
  const bg = useMemo(
    () => THUMB_FALLBACK_PALETTE[hashStr(album.name) % THUMB_FALLBACK_PALETTE.length],
    [album.name],
  );
  const initial = (album.name.trim()[0] ?? '?').toUpperCase();
  if (key && isPreset(key)) {
    return (
      <View style={styles.thumb}>
        <PresetBackground id={presetIdFromKey(key)} />
      </View>
    );
  }
  const url = r2Url(key);
  if (url) {
    return (
      <View style={styles.thumb}>
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      </View>
    );
  }
  return (
    <View style={[styles.thumb, { backgroundColor: bg }]}>
      <Text style={styles.thumbFallbackText}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: '#FFFFFF',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  pressed: {
    backgroundColor: Colors.paper,
  },
  center: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  roleTag: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  counter: {
    alignItems: 'flex-end',
  },
  counterCurrent: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.ink,
    lineHeight: 14,
  },
  counterTotal: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabel,
    color: Colors.muted,
    lineHeight: 12,
  },
  // 4:5 = mismo aspect que se le pide al owner al subir la carátula.
  thumb: {
    width: 44,
    height: 55,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.paper2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbFallbackText: {
    fontFamily: FontFamily.display,
    fontSize: 26,
    color: Colors.paper,
    letterSpacing: 1,
  },
});
