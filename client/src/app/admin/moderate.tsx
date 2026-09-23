import { useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AlbumModActions } from '@/components/album-mod-actions';
import { Avatar } from '@/components/avatar';
import { CardSearchField } from '@/components/card-search-field';
import { ScreenHeader } from '@/components/screen-header';
import { StatusBadge } from '@/components/status-badge';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { useAdminAlbums, type AdminAlbumRow } from '@/lib/queries/admin';
import { useDesktopCap } from '@/lib/use-is-desktop';
import { useFocusRefetchStale } from '@/lib/use-focus-refetch';
import { errorMessage } from '@/lib/errors';

// Normaliza para buscar sin tildes / mayúsculas (con fallback si Hermes no
// soporta normalize).
function norm(s: string): string {
  try {
    return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  } catch {
    return s.toLowerCase();
  }
}

// Todos los álbumes con buscador (nombre u owner) + acciones de moderación.
export default function AdminModerateScreen() {
  const desktopCap = useDesktopCap(960);
  const { albums, isLoading, isRefetching, error, refetch } = useAdminAlbums();
  const [query, setQuery] = useState('');

  useFocusRefetchStale(['admin', 'albums']);

  const q = norm(query.trim());
  const filtered = q
    ? albums.filter((a) => norm(a.name).includes(q) || norm(a.owner_name).includes(q))
    : albums;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={desktopCap}>
        <ScreenHeader title="Moderar álbumes" back />
        <View style={styles.intro}>
          <Text style={styles.introText}>
            Todos los álbumes. Bloquear es reversible (lo saca del carrusel y frena
            nuevos jugadores); eliminar es definitivo.
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, desktopCap]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.red} />
        }
      >
        <CardSearchField value={query} onChange={setQuery} placeholder="Buscar por álbum o creador…" />

        {error ? (
          <Text style={styles.errorText}>{errorMessage({ message: error })}</Text>
        ) : isLoading && albums.length === 0 ? (
          <View style={styles.center}><ActivityIndicator color={Colors.red} /></View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {albums.length === 0 ? 'No hay álbumes.' : 'Nada coincide con la búsqueda.'}
            </Text>
          </View>
        ) : (
          <View style={{ gap: Spacing.listGap }}>
            {filtered.map((a) => (
              <ModerateRow key={a.id} row={a} onChanged={refetch} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ModerateRow({ row, onChanged }: { row: AdminAlbumRow; onChanged: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Avatar source={row.name} size={42} />
        <View style={styles.center2}>
          <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
          <View style={styles.badgeRow}>
            <StatusBadge variant={row.status as any} />
            {row.is_public && <Text style={styles.pubChip}>PÚBLICO</Text>}
            {!!row.blocked_at && <Text style={styles.blockedChip}>BLOQUEADO</Text>}
            {row.report_count > 0 && <Text style={styles.reportChip}>{row.report_count} report{row.report_count > 1 ? 's' : ''}</Text>}
          </View>
          <Text style={styles.meta}>
            {row.total_stickers} figus · @{row.owner_name} · {row.member_count} jugando
          </Text>
        </View>
      </View>
      <AlbumModActions albumId={row.id} blocked={!!row.blocked_at} onChanged={onChanged} />
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
  pubChip: {
    fontFamily: FontFamily.mono, fontSize: 9, color: Colors.paper, backgroundColor: Colors.green,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill, letterSpacing: 1, fontWeight: '800',
  },
  blockedChip: {
    fontFamily: FontFamily.mono, fontSize: 9, color: Colors.paper, backgroundColor: Colors.red,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill, letterSpacing: 1, fontWeight: '800',
  },
  reportChip: {
    fontFamily: FontFamily.mono, fontSize: 9, color: Colors.ink, backgroundColor: Colors.gold,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: Radius.pill, letterSpacing: 1, fontWeight: '800',
  },
});
