import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumCard } from '@/components/album-card';
import { Button } from '@/components/button';
import { HeaderAvatar } from '@/components/header-avatar';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAlbumsProgress, useMyOwnedAlbums } from '@/lib/queries/albums';

export default function ManageTab() {
  const router = useRouter();
  const { albums: owned, refetch, isLoading } = useMyOwnedAlbums();
  const progress = useAlbumsProgress(owned.map((a) => a.id));

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.red} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>TUS ÁLBUMES</Text>
            <Text style={styles.title}>GESTIONAR</Text>
          </View>
          <HeaderAvatar size={44} />
        </View>

        {owned.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Todavía no creaste ningún álbum.</Text>
            <Text style={styles.emptyBody}>
              Creá uno y vas a poder cargar las figuritas, publicarlo y compartirlo.
            </Text>
          </View>
        ) : (
          <View style={{ gap: Spacing.listGap }}>
            {owned.map((album) => {
              const p = progress[album.id];
              const current = p?.stickers_loaded ?? 0;
              const total = p?.total_stickers ?? album.total_stickers;
              const pct = total > 0 ? current / total : 0;
              return (
                <AlbumCard
                  key={album.id}
                  album={album}
                  progress={pct}
                  counter={{ current, total }}
                  onPress={() => router.push(`/album/${album.id}`)}
                />
              );
            })}
          </View>
        )}

        <Button label="Crear álbum nuevo" onPress={() => router.push('/album/new')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  scroll: {
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerText: { gap: Spacing.xs, flex: 1 },
  kicker: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    color: Colors.ink,
    letterSpacing: 1,
  },
  empty: {
    paddingTop: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  emptyBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
});
