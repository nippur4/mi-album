import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
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

// Thumbnail circular del álbum: usa la carátula (preset o imagen R2). Si el
// álbum aún no tiene carátula (típicamente en draft), fallback al Avatar
// con iniciales del nombre.
function AlbumThumb({ album }: { album: Album }) {
  const key = album.cover_thumb_key;
  if (!key) return <Avatar source={album.name} />;
  if (isPreset(key)) {
    return (
      <View style={styles.thumb}>
        <PresetBackground id={presetIdFromKey(key)} />
      </View>
    );
  }
  const url = r2Url(key);
  if (!url) return <Avatar source={album.name} />;
  return (
    <View style={styles.thumb}>
      <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paper,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pressed: {
    backgroundColor: Colors.paper2,
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
  thumb: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    backgroundColor: Colors.paper2,
  },
});
