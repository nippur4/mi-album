import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumCard } from '@/components/album-card';
import { Button } from '@/components/button';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useMyOwnedAlbums } from '@/lib/queries/albums';

export default function HomeTab() {
  const router = useRouter();
  const { albums, isLoading, refetch } = useMyOwnedAlbums();

  // Re-fetchear cuando la pantalla vuelve a foco (ej. tras crear un álbum)
  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={albums}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <AlbumCard
            album={item}
            onPress={() => router.push(`/album/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.kicker}>HOLA DE NUEVO</Text>
            <Text style={styles.title}>Inicio</Text>
          </View>
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Todavía no creaste ningún álbum.</Text>
              <Text style={styles.emptyBody}>Arrancá creando uno para coleccionistas.</Text>
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.listGap }} />}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.red} />}
      />
      <View style={styles.footer}>
        <Button label="Crear álbum" onPress={() => router.push('/album/new')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  list: {
    paddingHorizontal: Spacing.screenX,
    paddingBottom: 120,
    flexGrow: 1,
  },
  header: {
    paddingVertical: Spacing.lg,
    gap: Spacing.xs,
  },
  kicker: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.screenTitle,
    color: Colors.ink,
  },
  empty: {
    paddingTop: Spacing.xxl * 2,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    left: Spacing.screenX,
    right: Spacing.screenX,
    bottom: Spacing.xl,
  },
});
