import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { DailyAlbumRow } from '@/components/daily-album-row';
import { HeaderAvatar } from '@/components/header-avatar';
import { MediaThumb } from '@/components/media-thumb';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { useMyPacksTabData } from '@/lib/queries/packs-tab';
import { useIsDesktop } from '@/lib/use-is-desktop';

export default function PacksTab() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  // Bundle: pending packs + playable albums (con daily status) en 1 sola RPC.
  // Antes eran 4 queries (pending + owned + joined + daily batch).
  const { pending, playable, refetch } = useMyPacksTabData();

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>SOBRES</Text>
            <Text style={styles.title}>POR ABRIR</Text>
          </View>
          <HeaderAvatar size={44} />
        </View>

        {/* Acceso rápido a escanear QR de owner */}
        <Pressable
          onPress={() => router.push('/pack/scan')}
          style={({ pressed }) => [styles.scanRow, pressed && styles.pressed]}
        >
          <Feather name="camera" size={20} color={Colors.paper} />
          <View style={{ flex: 1 }}>
            <Text style={styles.scanTitle}>Escanear QR del owner</Text>
            <Text style={styles.scanSub}>Sumá sobres extra escaneando un QR.</Text>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.paper} />
        </Pressable>

        {/* Sobres pendientes (sin abrir) por álbum */}
        {pending.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No tenés sobres pendientes.</Text>
            <Text style={styles.emptyBody}>
              Reclamá tu sobre diario o escaneá el QR de un álbum.
            </Text>
          </View>
        ) : (
          <View style={[styles.rowList, isDesktop && styles.rowGrid]}>
            {pending.map((row) => (
              <Pressable
                key={row.album_id}
                style={({ pressed }) => [
                  styles.pendingRow,
                  isDesktop && styles.rowGridItem,
                  pressed && styles.pressed,
                ]}
                onPress={() => router.push(`/pack/open?albumId=${row.album_id}`)}
              >
                <MediaThumb
                  mediaKey={row.pack_thumb_key}
                  seed={row.album_name}
                  width={42}
                  aspect={3 / 4}
                  borderRadius={8}
                />
                <View style={styles.center}>
                  <Text style={styles.name} numberOfLines={1}>{row.album_name}</Text>
                  <Text style={styles.subPending}>
                    {row.count} sobre{row.count > 1 ? 's' : ''} sin abrir
                  </Text>
                </View>
                <View style={styles.actionRed}>
                  <Text style={styles.actionLabelLight}>Abrir</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {/* Sobre diario por álbum jugable */}
        {playable.length > 0 && (
          <View style={{ gap: Spacing.sm }}>
            <Text style={styles.sectionLabel}>SOBRE DIARIO GRATIS</Text>
            <View style={[styles.rowList, isDesktop && styles.rowGrid]}>
              {playable.map((row) => (
                <View key={row.album_id} style={isDesktop ? styles.rowGridItem : undefined}>
                  <DailyAlbumRow
                    album={{
                      id: row.album_id,
                      name: row.album_name,
                      pack_thumb_key: row.pack_thumb_key,
                    }}
                    status={row.daily}
                    onClaimed={() => refetch()}
                  />
                </View>
              ))}
            </View>
          </View>
        )}
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
  sectionLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
  },
  rowList: {
    gap: Spacing.listGap,
  },
  // Desktop: filas en 2 columnas.
  rowGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  rowGridItem: {
    flexBasis: '48%',
    flexGrow: 1,
    maxWidth: 540,
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
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  pressed: { opacity: 0.85 },
  center: { flex: 1, gap: 2 },
  name: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  subPending: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.red,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  actionRed: {
    backgroundColor: Colors.red,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  actionLabelLight: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '800',
    color: Colors.paper,
    letterSpacing: 0.5,
  },
  scanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.ink,
    borderRadius: Radius.cardLg,
    padding: Spacing.md,
  },
  scanTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.paper,
  },
  scanSub: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.muted,
    marginTop: 2,
  },
});
