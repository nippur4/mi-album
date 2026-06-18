import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, FontSize, Radius, Shadow, Spacing } from '@/constants/theme';
import type { Album } from '@/lib/queries/albums';

interface Props {
  album: Album;
  onPress?: () => void;
}

const STATUS_LABEL: Record<Album['status'], string> = {
  draft: 'BORRADOR',
  published: 'PUBLICADO',
  read_only: 'PAUSADO',
  archived: 'ARCHIVADO',
};

const STATUS_BG: Record<Album['status'], string> = {
  draft: Colors.paper3,
  published: Colors.green,
  read_only: Colors.amberWarnBg,
  archived: Colors.paper3,
};

const STATUS_FG: Record<Album['status'], string> = {
  draft: Colors.inkSoft,
  published: Colors.greenTextDark,
  read_only: Colors.amberWarn,
  archived: Colors.muted,
};

export function AlbumCard({ album, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.headRow}>
        <View style={[styles.badge, { backgroundColor: STATUS_BG[album.status] }]}>
          <Text style={[styles.badgeText, { color: STATUS_FG[album.status] }]}>
            {STATUS_LABEL[album.status]}
          </Text>
        </View>
        <Text style={styles.share}>{album.share_code}</Text>
      </View>
      <Text style={styles.name} numberOfLines={2}>{album.name}</Text>
      <Text style={styles.meta}>
        <Text style={styles.metaNum}>{album.total_stickers}</Text>{' figuritas'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadow.card,
  },
  pressed: {
    opacity: 0.85,
  },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  badgeText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  share: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabel,
    color: Colors.muted,
    letterSpacing: 1.2,
  },
  name: {
    fontFamily: FontFamily.display,
    fontSize: 28,
    color: Colors.ink,
    lineHeight: 30,
  },
  meta: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
  },
  metaNum: {
    fontFamily: FontFamily.display,
    color: Colors.ink,
  },
});
