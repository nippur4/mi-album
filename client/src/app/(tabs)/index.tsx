import Feather from '@expo/vector-icons/Feather';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumCard } from '@/components/album-card';
import { Button } from '@/components/button';
import { HeaderAvatar } from '@/components/header-avatar';
import { JoinCodeInput } from '@/components/join-code-input';
import { PublicAlbumCard } from '@/components/public-album-card';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/auth';
import { unhideAlbumByPlayer, useAlbumsProgress } from '@/lib/queries/albums';
import { useHomeBundle } from '@/lib/queries/home';
import { useMyProfile } from '@/lib/queries/profile';
import { useDesktopCap, useIsDesktop } from '@/lib/use-is-desktop';
import { useFocusRefetchStale } from '@/lib/use-focus-refetch';
import { errorMessage } from '@/lib/errors';

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
  const isDesktop = useIsDesktop();
  // Cap del contenido (no del ScrollView): el scroll ocupa todo el ancho y la
  // barra queda en el borde de la ventana.
  const desktopCap = useDesktopCap(1080);
  const [showHidden, setShowHidden] = useState(false);
  // Bundle: owned + joined (con __hidden) + public en 1 sola RPC.
  // Antes eran 3 queries separadas.
  const {
    owned,
    joined: joinedAll,
    publics,
    refetch: refetchHome,
    isRefetching,
  } = useHomeBundle();

  // Filtramos client-side según el toggle
  const joined = showHidden ? joinedAll : joinedAll.filter((a) => !a.__hidden);
  const hiddenJoinedCount = joinedAll.filter((a) => a.__hidden).length;

  // Progreso SOLO de las memberships (incluidas las ocultas, así el toggle no
  // cambia la query key). Los públicos que el user juega ya son membership;
  // para los que NO juega el conteo daba siempre 0 — se resuelve client-side
  // con un fallback 0/total, sin pagar 2 count(*) por álbum público.
  const allIds = useMemo(() => joinedAll.map((a) => a.id), [joinedAll]);
  const { progress: progressMap, refetch: refetchProgress } = useAlbumsProgress(allIds);

  // Para el pull-to-refresh: fuerza red sin mirar staleness.
  const refreshAll = useCallback(() => {
    refetchHome();
    refetchProgress();
  }, [refetchHome, refetchProgress]);

  // Al recuperar foco solo refetchea si el data está stale.
  useFocusRefetchStale(['home-bundle'], ['albums', 'progress']);

  // "Donde jugás" incluye TODO álbum donde el caller tiene membership —
  // también los propios que se joineó como jugador (Fase 10). En esos casos
  // navegamos con ?as=player para que el thin router muestre la vista de
  // jugador y no la de owner (que es su lugar en Gestionar).
  const ownedIds = new Set(owned.map((a) => a.id));
  const joinedAlbums = joined;

  const displayName =
    profile?.display_name ??
    (session?.user.user_metadata?.display_name as string | undefined) ??
    session?.user.email?.split('@')[0] ??
    '';


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.scroll, desktopCap, { paddingBottom: Spacing.xxl + kbHeight }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refreshAll} tintColor={Colors.red} />
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
                // Con membership el progreso viene del map; sin membership
                // siempre fue 0 — fallback local, ya no se consulta al server.
                const p = progressMap[item.id];
                return (
                  <PublicAlbumCard
                    album={item}
                    progress={p ? p.my_pasted_count / Math.max(1, p.total_stickers) : 0}
                    counter={
                      p
                        ? { current: p.my_pasted_count, total: p.total_stickers }
                        : { current: 0, total: item.total_stickers }
                    }
                    onPress={() => router.push(`/album/${item.id}`)}
                  />
                );
              }}
              contentContainerStyle={styles.carouselContent}
              ItemSeparatorComponent={() => <View style={{ width: Spacing.md }} />}
            />
          </View>
        )}

        {/* Split de joined en "en curso" vs "completados" (100% pegado).
            Usamos el progressMap; si aún no llegó, tratamos como en curso. */}
        {(() => {
          const inProgress: typeof joinedAlbums = [];
          const completed: typeof joinedAlbums = [];
          for (const a of joinedAlbums) {
            const p = progressMap[a.id];
            const total = p?.total_stickers ?? a.total_stickers;
            const done = !!p && total > 0 && p.my_pasted_count >= total;
            (done ? completed : inProgress).push(a);
          }

          const renderCard = (album: typeof joinedAlbums[number]) => {
            const p = progressMap[album.id];
            const total = p?.total_stickers ?? album.total_stickers;
            const counter = { current: p?.my_pasted_count ?? 0, total };
            const progress = p && total > 0 ? p.my_pasted_count / total : 0;
            const isHidden = (album as any).__hidden === true;
            const isOwn = ownedIds.has(album.id);
            // Href explícito: typed routes no acepta el template string con
            // query (`?as=player`) — el shape objeto sí tipa.
            const href: Href = isOwn
              ? { pathname: '/album/[id]', params: { id: album.id, as: 'player' } }
              : { pathname: '/album/[id]', params: { id: album.id } };
            const tag = isHidden ? 'OCULTO' : isOwn ? 'TUYO' : undefined;
            return (
              <View key={album.id} style={[{ gap: 4 }, isDesktop && styles.gridItem]}>
                <AlbumCard
                  album={album}
                  progress={progress}
                  counter={counter}
                  roleTag={tag}
                  onPress={() => router.push(href)}
                />
                {isHidden && (
                  <Pressable
                    onPress={async () => {
                      const { error } = await unhideAlbumByPlayer(album.id);
                      if (error) {
                        Alert.alert('No se pudo mostrar', errorMessage(error));
                        return;
                      }
                      refetchHome();
                    }}
                    style={({ pressed }) => [styles.unhideBtn, pressed && { opacity: 0.6 }]}
                  >
                    <Feather name="eye" size={12} color={Colors.muted} />
                    <Text style={styles.unhideBtnText}>Volver a mostrar</Text>
                  </Pressable>
                )}
              </View>
            );
          };

          return (
            <>
              {inProgress.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Donde jugás</Text>
                  <View style={[styles.cardList, isDesktop && styles.cardGrid]}>
                    {inProgress.map(renderCard)}
                  </View>
                </View>
              )}

              {completed.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionHead}>
                    <Text style={styles.sectionLabel}>Completados</Text>
                    <Text style={styles.sectionTag}>100%</Text>
                  </View>
                  <View style={[styles.cardList, isDesktop && styles.cardGrid]}>
                    {completed.map(renderCard)}
                  </View>
                </View>
              )}

              {inProgress.length === 0 && completed.length === 0 && !showHidden && (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>Todavía no estás jugando ningún álbum.</Text>
                  <Text style={styles.emptyBody}>
                    Unite con un código abajo o explorá los álbumes públicos.
                  </Text>
                </View>
              )}
            </>
          );
        })()}

        {(hiddenJoinedCount > 0 || showHidden) && (
          <Pressable
            onPress={() => setShowHidden((v) => !v)}
            hitSlop={8}
            style={({ pressed }) => [styles.hiddenToggle, pressed && { opacity: 0.6 }]}
          >
            <Feather
              name={showHidden ? 'eye-off' : 'eye'}
              size={13}
              color={Colors.muted}
            />
            <Text style={styles.hiddenToggleText}>
              {showHidden
                ? 'Ocultar los tuyos ocultos'
                : `Mostrar ocultos${hiddenJoinedCount ? ` (${hiddenJoinedCount})` : ''}`}
            </Text>
          </Pressable>
        )}

        {/* En desktop el bloque de acciones se capea a ancho mobile centrado —
            un input de código de 1000px de ancho no tiene sentido. */}
        <View style={isDesktop ? styles.actionsDesktop : styles.actionsMobile}>
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
        </View>
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
  cardList: {
    gap: Spacing.listGap,
  },
  // Desktop: las cards de álbum en grilla de ~3 columnas en vez de lista.
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    flexBasis: '31%',
    flexGrow: 1,
    maxWidth: 360,
  },
  // El wrapper mantiene el mismo gap que el scroll para que en mobile el
  // espaciado entre input y botón no cambie respecto a cuando eran hermanos.
  actionsMobile: {
    gap: Spacing.xl,
  },
  actionsDesktop: {
    gap: Spacing.xl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
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
  hiddenToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.xs,
  },
  hiddenToggleText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  unhideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  unhideBtnText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
});
