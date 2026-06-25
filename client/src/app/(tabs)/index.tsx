import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumCard } from '@/components/album-card';
import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { JoinCodeInput } from '@/components/join-code-input';
import { PublicAlbumCard } from '@/components/public-album-card';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/auth';
import {
  useAlbumsProgress,
  useMyMemberAlbums,
  useMyOwnedAlbums,
  usePublicAlbums,
} from '@/lib/queries/albums';
import { useMyProfile } from '@/lib/queries/profile';

export default function HomeTab() {
  const router = useRouter();
  const { session } = useSession();
  const { profile } = useMyProfile();
  const { albums: owned, refetch: refetchOwned, isLoading: loadingOwned } = useMyOwnedAlbums();
  const { albums: joined, refetch: refetchJoined, isLoading: loadingJoined } = useMyMemberAlbums();
  const { albums: publics, refetch: refetchPublics, isLoading: loadingPublics } = usePublicAlbums();

  // Pedimos progreso de TODOS los ids visibles
  const allIds = useMemo(
    () => Array.from(new Set([...owned.map((a) => a.id), ...joined.map((a) => a.id), ...publics.map((a) => a.id)])),
    [owned, joined, publics],
  );
  const progressMap = useAlbumsProgress(allIds);

  const refreshAll = useCallback(() => {
    refetchOwned();
    refetchJoined();
    refetchPublics();
  }, [refetchOwned, refetchJoined, refetchPublics]);

  useFocusEffect(useCallback(() => { refreshAll(); }, [refreshAll]));

  // Separamos en dos sub-secciones: "Donde jugás" (member) y "Tuyos" (owner)
  const ownedIds = new Set(owned.map((a) => a.id));
  const joinedAlbums = joined.filter((a) => !ownedIds.has(a.id));
  const hasAny = owned.length > 0 || joinedAlbums.length > 0;

  const displayName =
    profile?.display_name ??
    (session?.user.user_metadata?.display_name as string | undefined) ??
    session?.user.email?.split('@')[0] ??
    '';

  const isLoading = loadingOwned || loadingJoined || loadingPublics;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refreshAll} tintColor={Colors.red} />
        }
      >
        {/* Header con avatar del user */}
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>HOLA DE NUEVO</Text>
            <Text style={styles.greeting}>{displayName.toUpperCase()}</Text>
          </View>
          <Avatar source={displayName || 'Vos'} size={48} />
        </View>

        {/* Álbumes públicos */}
        {publics.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>Álbumes públicos</Text>
              <Text style={styles.sectionTag}>CURADOS</Text>
            </View>
            <FlatList
              data={publics}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(a) => a.id}
              renderItem={({ item }) => {
                const p = progressMap[item.id];
                return (
                  <PublicAlbumCard
                    album={item}
                    progress={p ? p.my_pasted_count / Math.max(1, p.total_stickers) : 0}
                    counter={p ? { current: p.my_pasted_count, total: p.total_stickers } : undefined}
                    onPress={() => router.push(`/album/${item.id}`)}
                  />
                );
              }}
              contentContainerStyle={styles.carouselContent}
              ItemSeparatorComponent={() => <View style={{ width: Spacing.md }} />}
            />
          </View>
        )}

        {/* Donde jugás */}
        {joinedAlbums.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Donde jugás</Text>
            <View style={{ gap: Spacing.listGap }}>
              {joinedAlbums.map((album) => {
                const p = progressMap[album.id];
                const current = p?.my_pasted_count ?? 0;
                const total = p?.total_stickers ?? album.total_stickers;
                const progress = total > 0 ? current / total : 0;
                return (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    progress={progress}
                    counter={{ current, total }}
                    onPress={() => router.push(`/album/${album.id}`)}
                  />
                );
              })}
            </View>
          </View>
        )}

        {/* Tus álbumes (owner) */}
        {owned.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tus álbumes</Text>
            <View style={{ gap: Spacing.listGap }}>
              {owned.map((album) => {
                const p = progressMap[album.id];
                const current = p?.stickers_loaded ?? 0;
                const total = p?.total_stickers ?? album.total_stickers;
                const progress = total > 0 ? current / total : 0;
                return (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    progress={progress}
                    counter={{ current, total }}
                    onPress={() => router.push(`/album/${album.id}`)}
                  />
                );
              })}
            </View>
          </View>
        )}

        {!hasAny && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Todavía no tenés álbumes.</Text>
            <Text style={styles.emptyBody}>Creá uno o unite con un código.</Text>
          </View>
        )}

        <JoinCodeInput onJoined={(albumId) => router.push(`/album/${albumId}`)} />

        <Button label="Crear álbum nuevo" variant="outline" onPress={() => router.push('/album/new')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  scroll: {
    paddingHorizontal: Spacing.screenX,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  header: {
    paddingTop: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerText: {
    gap: Spacing.xs,
  },
  kicker: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  greeting: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    color: Colors.ink,
    letterSpacing: 1,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  sectionLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  sectionTag: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.muted,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  carouselContent: {
    paddingVertical: Spacing.xs,
  },
  empty: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.xs,
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
  },
});
