import Feather from '@expo/vector-icons/Feather';
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
import {
  rejectAlbumPublicRequest,
  setAlbumPublic,
  setAlbumPublicRank,
  useAdminAlbums,
  type AdminAlbumRow,
} from '@/lib/queries/admin';
import { useDesktopCap } from '@/lib/use-is-desktop';
import { useFocusRefetchStale } from '@/lib/use-focus-refetch';
import { errorMessage } from '@/lib/errors';

// Gestión de álbumes públicos: los que ya están en el carrusel + las solicitudes
// pendientes (con su motivo). Aprobar = prender el switch; descartar = borrar el
// pedido. El RPC ordena las pendientes primero.
export default function AdminPublicScreen() {
  const desktopCap = useDesktopCap(960);
  const { albums, isLoading, isRefetching, error, refetch } = useAdminAlbums();

  useFocusRefetchStale(['admin', 'albums']);

  const relevant = albums.filter(
    (a) => a.is_public || (!!a.public_requested_at && !a.is_public),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={desktopCap}>
        <ScreenHeader title="Álbumes públicos" back />
        <View style={styles.intro}>
          <Text style={styles.introText}>
            Álbumes en el carrusel del inicio + solicitudes pendientes (arriba, con
            su motivo). Solo álbumes publicados pueden ser públicos.
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, desktopCap]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.red} />
        }
      >
        {error ? (
          <Text style={styles.errorText}>{errorMessage({ message: error })}</Text>
        ) : isLoading && albums.length === 0 ? (
          <View style={styles.center}><ActivityIndicator color={Colors.red} /></View>
        ) : relevant.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No hay públicos ni solicitudes.</Text>
            <Text style={styles.emptyBody}>
              Cuando un owner pida ser público, lo vas a ver acá.
            </Text>
          </View>
        ) : (
          <View style={{ gap: Spacing.listGap }}>
            {relevant.map((a) => (
              <PublicAlbumRow key={a.id} row={a} onChanged={refetch} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PublicAlbumRow({ row, onChanged }: { row: AdminAlbumRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [optimistic, setOptimistic] = useState<boolean>(row.is_public);
  const [rank, setRank] = useState<number>(row.public_rank);
  const [rankBusy, setRankBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const canToggle = row.status === 'published';
  const isPending = !!row.public_requested_at && !optimistic;

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

  async function onReject() {
    setRejecting(true);
    const { error } = await rejectAlbumPublicRequest(row.id);
    setRejecting(false);
    if (error) {
      Alert.alert('No se pudo descartar', errorMessage(error));
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
            {isPending && <Text style={styles.pendingChip}>PENDIENTE</Text>}
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

      {isPending && (
        <View style={styles.pendingBox}>
          <Text style={styles.pendingLabel}>MOTIVO DE LA SOLICITUD</Text>
          <Text style={styles.pendingNote}>
            {row.public_request_note?.trim() || '(sin motivo)'}
          </Text>
          <View style={styles.pendingActions}>
            <Text style={styles.pendingHint}>Aprobá con el switch de arriba, o:</Text>
            <Pressable
              onPress={onReject}
              disabled={rejecting}
              hitSlop={8}
              style={({ pressed }) => [styles.rejectBtn, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.rejectBtnText}>{rejecting ? '...' : 'Descartar'}</Text>
            </Pressable>
          </View>
        </View>
      )}

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
  intro: { paddingHorizontal: Spacing.screenX, paddingTop: Spacing.sm, paddingBottom: Spacing.md },
  introText: { fontFamily: FontFamily.body, fontSize: FontSize.bodySmall, color: Colors.inkSoft, lineHeight: 18 },
  scroll: { paddingHorizontal: Spacing.screenX, paddingBottom: Spacing.xxl, gap: Spacing.md },
  center: { paddingTop: Spacing.xxl, alignItems: 'center' },
  empty: { paddingTop: Spacing.xxl, alignItems: 'center', gap: Spacing.sm },
  emptyTitle: { fontFamily: FontFamily.body, fontSize: FontSize.body, fontWeight: '700', color: Colors.ink },
  emptyBody: { fontFamily: FontFamily.body, fontSize: FontSize.bodySmall, color: Colors.inkSoft, textAlign: 'center', paddingHorizontal: Spacing.xl },
  errorText: { fontFamily: FontFamily.body, fontSize: FontSize.body, color: Colors.red, textAlign: 'center' },
  rowCol: {
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  center2: { flex: 1, gap: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginVertical: 2 },
  name: { fontFamily: FontFamily.body, fontSize: FontSize.body, fontWeight: '700', color: Colors.ink },
  meta: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.muted, letterSpacing: 0.8 },
  pendingChip: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.ink,
    backgroundColor: Colors.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    letterSpacing: 1,
    fontWeight: '800',
  },
  pendingBox: {
    backgroundColor: Colors.amberWarnBg,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.gold,
    padding: Spacing.md,
    gap: 6,
  },
  pendingLabel: { fontFamily: FontFamily.mono, fontSize: FontSize.monoLabelSmall, color: Colors.goldDark, letterSpacing: 1.2, fontWeight: '700' },
  pendingNote: { fontFamily: FontFamily.body, fontSize: FontSize.bodySmall, color: Colors.ink },
  pendingActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  pendingHint: { fontFamily: FontFamily.body, fontSize: FontSize.caption, color: Colors.inkSoft, flex: 1 },
  rejectBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.paper },
  rejectBtnText: { fontFamily: FontFamily.body, fontSize: FontSize.bodySmall, fontWeight: '700', color: Colors.ink },
  rankRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  rankLabel: { fontFamily: FontFamily.mono, fontSize: FontSize.monoLabelSmall, color: Colors.muted, letterSpacing: 1.2 },
  rankControl: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rankBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colors.paper, borderWidth: 1, borderColor: Colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  rankBtnDisabled: { opacity: 0.35 },
  rankValue: { fontFamily: FontFamily.mono, fontSize: FontSize.body, fontWeight: '700', color: Colors.ink, minWidth: 24, textAlign: 'center' },
});
