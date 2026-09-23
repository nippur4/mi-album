import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumModActions } from '@/components/album-mod-actions';
import { Avatar } from '@/components/avatar';
import { ScreenHeader } from '@/components/screen-header';
import { StatusBadge } from '@/components/status-badge';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { resolveAlbumReports, useAdminReports, type AdminReportRow } from '@/lib/queries/admin';
import { useDesktopCap } from '@/lib/use-is-desktop';
import { useFocusRefetchStale } from '@/lib/use-focus-refetch';
import { errorMessage } from '@/lib/errors';

// Álbumes reportados por usuarios: motivo + detalle de cada reporte + acciones
// (ver / bloquear / eliminar / descartar los reports).
export default function AdminReportsScreen() {
  const desktopCap = useDesktopCap(960);
  const { reports, isLoading, isRefetching, error, refetch } = useAdminReports();

  useFocusRefetchStale(['admin', 'reports']);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={desktopCap}>
        <ScreenHeader title="Reports" back />
        <View style={styles.intro}>
          <Text style={styles.introText}>
            Álbumes reportados por los usuarios. Revisá el motivo, moderá si
            corresponde, y descartá los reports cuando ya los resolviste.
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
        ) : isLoading && reports.length === 0 ? (
          <View style={styles.center}><ActivityIndicator color={Colors.red} /></View>
        ) : reports.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No hay reports pendientes. 🎉</Text>
            <Text style={styles.emptyBody}>Cuando alguien reporte un álbum, aparece acá.</Text>
          </View>
        ) : (
          <View style={{ gap: Spacing.listGap }}>
            {reports.map((r) => (
              <ReportCard key={r.album_id} row={r} onChanged={refetch} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReportCard({ row, onChanged }: { row: AdminReportRow; onChanged: () => void }) {
  const [resolving, setResolving] = useState(false);

  async function onResolve() {
    setResolving(true);
    const { error } = await resolveAlbumReports(row.album_id);
    setResolving(false);
    if (error) {
      Alert.alert('No se pudo', errorMessage(error));
      return;
    }
    onChanged();
  }

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Avatar source={row.album_name} size={42} />
        <View style={styles.center2}>
          <Text style={styles.name} numberOfLines={1}>{row.album_name}</Text>
          <View style={styles.badgeRow}>
            <StatusBadge variant={row.status as any} />
            {!!row.blocked_at && <Text style={styles.blockedChip}>BLOQUEADO</Text>}
            <Text style={styles.countChip}>{row.report_count} report{row.report_count > 1 ? 's' : ''}</Text>
          </View>
          <Text style={styles.meta}>@{row.owner_name}</Text>
        </View>
      </View>

      <View style={styles.reports}>
        {row.reports.map((rep, i) => (
          <View key={i} style={styles.reportItem}>
            <Text style={styles.reportReason}>{rep.reason}</Text>
            {!!rep.details && <Text style={styles.reportDetails}>{rep.details}</Text>}
            <Text style={styles.reportMeta}>
              {rep.reporter ?? 'Anónimo'} · {formatDate(rep.created_at)}
            </Text>
          </View>
        ))}
      </View>

      <AlbumModActions albumId={row.album_id} blocked={!!row.blocked_at} onChanged={onChanged} />

      <Pressable
        onPress={onResolve}
        disabled={resolving}
        hitSlop={8}
        style={({ pressed }) => [styles.resolveBtn, pressed && { opacity: 0.6 }]}
      >
        <Text style={styles.resolveText}>
          {resolving ? '...' : 'Descartar reports (ya resuelto)'}
        </Text>
      </Pressable>
    </View>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
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
  card: {
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  center2: { flex: 1, gap: 4 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginVertical: 2 },
  name: { fontFamily: FontFamily.body, fontSize: FontSize.body, fontWeight: '700', color: Colors.ink },
  meta: { fontFamily: FontFamily.mono, fontSize: 10, color: Colors.muted, letterSpacing: 0.8 },
  blockedChip: {
    fontFamily: FontFamily.mono, fontSize: 9, color: Colors.paper, backgroundColor: Colors.red,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill, letterSpacing: 1, fontWeight: '800',
  },
  countChip: {
    fontFamily: FontFamily.mono, fontSize: 9, color: Colors.ink, backgroundColor: Colors.gold,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill, letterSpacing: 1, fontWeight: '800',
  },
  reports: {
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  reportItem: { gap: 2 },
  reportReason: { fontFamily: FontFamily.body, fontSize: FontSize.bodySmall, fontWeight: '700', color: Colors.ink },
  reportDetails: { fontFamily: FontFamily.body, fontSize: FontSize.bodySmall, color: Colors.inkSoft },
  reportMeta: { fontFamily: FontFamily.mono, fontSize: 9, color: Colors.muted, letterSpacing: 0.8 },
  resolveBtn: { alignSelf: 'flex-start', paddingVertical: Spacing.xs },
  resolveText: {
    fontFamily: FontFamily.mono, fontSize: FontSize.monoLabelSmall, color: Colors.muted,
    letterSpacing: 1, textTransform: 'uppercase', fontWeight: '700', textDecorationLine: 'underline',
  },
});
