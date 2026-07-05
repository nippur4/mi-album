import Feather from '@expo/vector-icons/Feather';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ScreenHeader } from '@/components/screen-header';
import { StatusBadge } from '@/components/status-badge';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { setAlbumPublic, useAdminAlbums, type AdminAlbumRow } from '@/lib/queries/admin';
import { useDesktopCap } from '@/lib/use-is-desktop';
import { errorMessage } from '@/lib/errors';

export default function AdminScreen() {
  const router = useRouter();
  const desktopCap = useDesktopCap(960);
  const { albums, isLoading, isRefetching, error, refetch } = useAdminAlbums();

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

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

  return (
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
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
