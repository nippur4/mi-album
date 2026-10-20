import Feather from '@expo/vector-icons/Feather';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActiveAlbumSheet } from '@/components/active-album-sheet';
import { AlbumCard } from '@/components/album-card';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { HeaderAvatar } from '@/components/header-avatar';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { isPausedByDowngrade, useAlbumsProgress, useMyOwnedAlbums } from '@/lib/queries/albums';
import { useIsPro } from '@/lib/queries/subscriptions';
import { useDesktopCap, useIsDesktop } from '@/lib/use-is-desktop';
import { useFocusRefetchStale } from '@/lib/use-focus-refetch';

export default function ManageTab() {
  const router = useRouter();
  const qc = useQueryClient();
  const isDesktop = useIsDesktop();
  const desktopCap = useDesktopCap(1080);
  const [showArchived, setShowArchived] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const { isPro } = useIsPro();
  // Traemos SIEMPRE los archivados y filtramos client-side. Así podemos
  // mostrar el contador ("Mostrar archivados (N)") sin hacer una segunda query.
  const { albums: all, refetch, isRefetching } = useMyOwnedAlbums({ includeHidden: true });
  const archivedCount = all.filter((a) => (a as any).owner_hidden === true).length;
  const owned = showArchived ? all : all.filter((a) => (a as any).owner_hidden !== true);
  const { progress } = useAlbumsProgress(owned.map((a) => a.id));

  // Álbumes pausados por el vencimiento del Pro (read_only SIN retired_at).
  // Nunca están owner_hidden —eso lo setea el retiro manual— así que salen en
  // la lista visible sin depender del toggle de archivados.
  const paused = all.filter(isPausedByDowngrade);
  // Candidatos a "activo": el que está publicado + los pausados por la baja.
  // Quedan afuera los drafts y los que el owner cerró a mano (retired_at).
  const switchable = all.filter(
    (a) => a.retired_at == null && (a.status === 'published' || a.status === 'read_only'),
  );
  const showPausedBanner = !isPro && paused.length > 0;

  useFocusRefetchStale(['albums', 'owned'], ['albums', 'progress']);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scroll, desktopCap]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.red} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>TUS ÁLBUMES</Text>
            <Text style={styles.title}>GESTIONAR</Text>
          </View>
          <HeaderAvatar size={44} />
        </View>

        {/* Explicación de por qué se pausaron álbumes. Sin esto el owner ve
            sus álbumes en solo lectura sin ningún aviso: la bajada la aplica
            un webhook cuando él no está mirando. */}
        {showPausedBanner && (
          <View style={styles.pausedBanner}>
            <View style={styles.pausedHead}>
              <Feather name="pause-circle" size={18} color={Colors.amberWarn} />
              <Text style={styles.pausedTitle}>
                {paused.length === 1 ? 'Tenés 1 álbum en pausa' : `Tenés ${paused.length} álbumes en pausa`}
              </Text>
            </View>
            <Text style={styles.pausedBody}>
              Tu suscripción Pro no está activa, y el plan free permite un álbum activo a la vez.
              No se borró nada: las figuritas y los jugadores siguen intactos. Podés elegir cuál
              mantener activo, o volver a Pro para reactivarlos todos.
            </Text>
            <View style={styles.pausedActions}>
              <Pressable
                onPress={() => setPickerVisible(true)}
                style={({ pressed }) => [styles.pausedBtn, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.pausedBtnText}>Elegir álbum activo</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/paywall' as any)}
                style={({ pressed }) => [styles.pausedLink, pressed && { opacity: 0.6 }]}
              >
                <Text style={styles.pausedLinkText}>Volver a Pro</Text>
              </Pressable>
            </View>
          </View>
        )}

        {owned.length === 0 ? (
          <EmptyState
            style={styles.empty}
            title={
              showArchived ? 'No hay álbumes archivados.' : 'Todavía no creaste ningún álbum.'
            }
            body={
              showArchived
                ? undefined
                : 'Creá uno y vas a poder cargar las figuritas, publicarlo y compartirlo.'
            }
          />
        ) : (
          <View style={[styles.cardList, isDesktop && styles.cardGrid]}>
            {owned.map((album) => {
              const p = progress[album.id];
              const current = p?.stickers_loaded ?? 0;
              const total = p?.total_stickers ?? album.total_stickers;
              const pct = total > 0 ? current / total : 0;
              const archived = album.owner_hidden === true;
              return (
                <View key={album.id} style={isDesktop ? styles.gridItem : undefined}>
                  <AlbumCard
                    album={album}
                    progress={pct}
                    counter={{ current, total }}
                    roleTag={
                      archived ? 'ARCHIVADO' : isPausedByDowngrade(album) ? 'EN PAUSA' : undefined
                    }
                    // Gestionar = contexto de gestión: siempre al editor del
                    // owner (?as=edit). Sin esto, un álbum publicado abriría la
                    // vista de jugador (el default del thin router).
                    onPress={() => router.push(`/album/${album.id}?as=edit`)}
                  />
                </View>
              );
            })}
          </View>
        )}

        {/* Toggle "mostrar archivados": solo aparece si hay algo para mostrar
            (evita ruido en cuentas sin archivos). Cuando showArchived=true lo
            dejamos siempre para poder volver. */}
        {(archivedCount > 0 || showArchived) && (
          <Pressable
            onPress={() => setShowArchived((v) => !v)}
            hitSlop={8}
            style={({ pressed }) => [styles.archivedToggle, pressed && { opacity: 0.6 }]}
          >
            <Feather
              name={showArchived ? 'eye-off' : 'archive'}
              size={13}
              color={Colors.muted}
            />
            <Text style={styles.archivedToggleText}>
              {showArchived ? 'Ocultar archivados' : `Mostrar archivados${archivedCount ? ` (${archivedCount})` : ''}`}
            </Text>
          </Pressable>
        )}

        <View style={isDesktop ? styles.createDesktop : undefined}>
          <Button label="Crear álbum nuevo" onPress={() => router.push('/album/new')} />
        </View>
      </ScrollView>

      <ActiveAlbumSheet
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        albums={switchable}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ['albums'] });
          qc.invalidateQueries({ queryKey: ['home-bundle'] });
        }}
      />
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
  cardList: {
    gap: Spacing.listGap,
  },
  // Desktop: grilla de ~3 columnas en vez de lista vertical.
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridItem: {
    flexBasis: '31%',
    flexGrow: 1,
    maxWidth: 360,
  },
  createDesktop: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  // El vacío va debajo del header del tab, no al tope de la pantalla.
  empty: { paddingTop: Spacing.lg },
  pausedBanner: {
    backgroundColor: Colors.amberWarnBg,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.amberWarn,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  pausedHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pausedTitle: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  pausedBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
  },
  pausedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
  pausedBtn: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.button,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  pausedBtnText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.paper,
  },
  pausedLink: { paddingVertical: Spacing.sm },
  pausedLinkText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.inkSoft,
    textDecorationLine: 'underline',
  },
  archivedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.xs,
  },
  archivedToggleText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
});
