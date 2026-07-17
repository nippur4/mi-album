import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ScreenHeader } from '@/components/screen-header';
import { StatusBadge } from '@/components/status-badge';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { setAlbumPublic, setAlbumPublicRank, useAdminAlbums, type AdminAlbumRow } from '@/lib/queries/admin';
import { useDesktopCap } from '@/lib/use-is-desktop';
import { useFocusRefetchStale } from '@/lib/use-focus-refetch';
import { errorMessage } from '@/lib/errors';

export default function AdminScreen() {
  const router = useRouter();
  const desktopCap = useDesktopCap(960);
  const { albums, isLoading, isRefetching, error, refetch } = useAdminAlbums();

  useFocusRefetchStale(['admin', 'albums']);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={desktopCap}>
        <ScreenHeader
          title="Admin"
          back
          right={<Feather name="shield" size={20} color={Colors.ink} />}
        />
        <View style={styles.intro}>
          <Text style={styles.introText}>
            Marcá un álbum publicado como público para que aparezca en el carrusel del Landing.
            Los borradores y pausados no pueden volverse públicos hasta que el owner los publique.
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, desktopCap]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.red} />
        }
      >
        <Pressable
          onPress={() => router.push('/admin/presets')}
          style={styles.menuItem}
        >
          <Feather name="image" size={20} color={Colors.ink} />
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Plantillas de imágenes</Text>
            <Text style={styles.menuSubtitle}>
              Carátulas y sobres por defecto disponibles para todos los owners.
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.muted} />
        </Pressable>

        <Pressable
          // Cast: la ruta recién entra a los tipos generados de expo-router
          // cuando el dev server la descubre (próximo `expo start`).
          onPress={() => router.push('/admin/stats' as any)}
          style={styles.menuItem}
        >
          <Feather name="bar-chart-2" size={20} color={Colors.ink} />
          <View style={{ flex: 1 }}>
            <Text style={styles.menuTitle}>Estadísticas</Text>
            <Text style={styles.menuSubtitle}>
              Usuarios, actividad diaria, álbumes, figuritas, sobres y cambios.
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.muted} />
        </Pressable>

        <Text style={styles.sectionLabel}>ÁLBUMES</Text>

        {error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{errorMessage({ message: error })}</Text>
          </View>
        ) : isLoading && albums.length === 0 ? (
          <View style={styles.center}><ActivityIndicator color={Colors.red} /></View>
        ) : albums.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No hay álbumes publicados todavía.</Text>
            <Text style={styles.emptyBody}>
              Cuando algún owner publique un álbum, lo vas a ver acá.
            </Text>
          </View>
        ) : (
          <View style={{ gap: Spacing.listGap }}>
            {albums.map((a) => (
              <AdminAlbumRowItem key={a.id} row={a} onChanged={refetch} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function AdminAlbumRowItem({ row, onChanged }: { row: AdminAlbumRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean>(row.is_public);
  // Orden en el carrusel (mayor = aparece antes). Optimista para respuesta ágil.
  const [rank, setRank] = useState<number>(row.public_rank);
  const [rankBusy, setRankBusy] = useState(false);

  // Solo álbumes published pueden ser públicos (el RPC también lo enforza).
  const canToggle = row.status === 'published';

  async function onToggle(next: boolean) {
    setOptimistic(next);
    setBusy(true);
    const { error } = await setAlbumPublic(row.id, next);
    setBusy(false);
    if (error) {
      setOptimistic(row.is_public);
      Alert.alert('No se pudo cambiar', errorMessage(error));
      return;
    }
    onChanged();
  }

  async function changeRank(delta: number) {
    const next = Math.max(0, rank + delta);
    if (next === rank) return;
    const prev = rank;
    setRank(next);
    setRankBusy(true);
    const { error } = await setAlbumPublicRank(row.id, next);
    setRankBusy(false);
    if (error) {
      setRank(prev);
      // Inline no hace falta acá (admin desktop-first); Alert cubre native.
      Alert.alert('No se pudo cambiar el orden', errorMessage(error));
      return;
    }
    onChanged();
  }

  return (
    <View style={styles.rowCol}>
      <View style={styles.row}>
        <Avatar source={row.name} size={42} />
        <View style={styles.center2}>
          <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
          <View style={styles.badgeRow}>
            <StatusBadge variant={row.status as any} />
          </View>
          <Text style={styles.meta}>
            {row.total_stickers} figus · @{row.owner_name} · {row.member_count} jugando
          </Text>
        </View>
        <Switch
          value={optimistic}
          onValueChange={onToggle}
          disabled={busy || !canToggle}
          trackColor={{ true: Colors.green, false: Colors.paper3 }}
          thumbColor={optimistic ? Colors.paper : Colors.paper2}
        />
      </View>

      {/* Orden del carrusel: solo tiene sentido para públicos. Mayor = antes. */}
      {optimistic && (
        <View style={styles.rankRow}>
          <Text style={styles.rankLabel}>ORDEN EN EL CARRUSEL</Text>
          <View style={styles.rankControl}>
            <Pressable
              onPress={() => changeRank(-1)}
              disabled={rankBusy || rank === 0}
              hitSlop={8}
              style={({ pressed }) => [
                styles.rankBtn,
                (rankBusy || rank === 0) && styles.rankBtnDisabled,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Feather name="minus" size={16} color={Colors.ink} />
            </Pressable>
            <Text style={styles.rankValue}>{rank}</Text>
            <Pressable
              onPress={() => changeRank(1)}
              disabled={rankBusy}
              hitSlop={8}
              style={({ pressed }) => [styles.rankBtn, pressed && { opacity: 0.6 }]}
            >
              <Feather name="plus" size={16} color={Colors.ink} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  intro: {
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  introText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    lineHeight: 18,
  },
  scroll: {
    paddingHorizontal: Spacing.screenX,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  menuTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  menuSubtitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
    marginTop: Spacing.sm,
  },
  center: {
    paddingTop: Spacing.xxl,
    alignItems: 'center',
  },
  empty: {
    paddingTop: Spacing.xxl,
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
  errorText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    color: Colors.red,
    textAlign: 'center',
  },
  rowCol: {
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  rankLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.2,
  },
  rankControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rankBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBtnDisabled: {
    opacity: 0.35,
  },
  rankValue: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
    minWidth: 24,
    textAlign: 'center',
  },
  center2: { flex: 1, gap: 4 },
  badgeRow: { flexDirection: 'row', marginVertical: 2 },
  name: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  meta: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 0.8,
  },
});
