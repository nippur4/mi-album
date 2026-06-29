import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumCard } from '@/components/album-card';
import { Button } from '@/components/button';
import { HeaderAvatar } from '@/components/header-avatar';
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
  const scrollRef = useRef<ScrollView>(null);
  const [kbHeight, setKbHeight] = useState(0);

  // Padding dinámico al final del scroll para que el JoinCodeInput pueda
  // quedar arriba del teclado al focusearse. KeyboardAvoidingView solo no
  // alcanza dentro de Tabs en Android.
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, (e) => setKbHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvt, () => setKbHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);
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
  const { progress: progressMap, refetch: refetchProgress } = useAlbumsProgress(allIds);

  const refreshAll = useCallback(() => {
    refetchOwned();
    refetchJoined();
    refetchPublics();
    refetchProgress();
  }, [refetchOwned, refetchJoined, refetchPublics, refetchProgress]);

  useFocusEffect(useCallback(() => { refreshAll(); }, [refreshAll]));

  // Los owned se gestionan en la tab Gestionar. En home solo mostramos los
  // álbumes donde el caller juega como member (no owner).
  const ownedIds = new Set(owned.map((a) => a.id));
  const joinedAlbums = joined.filter((a) => !ownedIds.has(a.id));

  const displayName =
    profile?.display_name ??
    (session?.user.user_metadata?.display_name as string | undefined) ??
    session?.user.email?.split('@')[0] ??
    '';

  const isLoading = loadingOwned || loadingJoined || loadingPublics;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, { paddingBottom: Spacing.xxl + kbHeight }]}
        keyboardShouldPersistTaps="handled"
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
          <HeaderAvatar size={48} />
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
                const total = p?.total_stickers ?? album.total_stickers;
                // Counter siempre visible con el total del álbum; current=?
                // mientras no llegue el progress (better than mostrar 0).
                const counter = { current: p?.my_pasted_count ?? 0, total };
                const progress = p && total > 0 ? p.my_pasted_count / total : 0;
                return (
                  <AlbumCard
                    key={album.id}
                    album={album}
                    progress={progress}
                    counter={counter}
                    onPress={() => router.push(`/album/${album.id}`)}
                  />
                );
              })}
            </View>
          </View>
        )}

        {joinedAlbums.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Todavía no estás jugando ningún álbum.</Text>
            <Text style={styles.emptyBody}>
              Unite con un código abajo o explorá los álbumes públicos.
            </Text>
          </View>
        )}

        <JoinCodeInput
          onJoined={(albumId) => router.push(`/album/${albumId}`)}
          onInputFocus={() => {
            // Esperamos a que el teclado termine de aparecer (~300ms en iOS y
            // ~250ms en Android) antes de scrollear, así el layout ya se
            // recortó y scrollToEnd nos deja el input arriba del teclado.
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 350);
          }}
        />

        <Button label="Crear álbum nuevo" variant="outline" onPress={() => router.push('/album/new')} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  scroll: {
    paddingHorizontal: Spacing.screenX,
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
