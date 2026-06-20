import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { setAlbumPublic, useAdminAlbums, type AdminAlbumRow } from '@/lib/queries/admin';
import { errorMessage } from '@/lib/errors';

export default function AdminScreen() {
  const { albums, isLoading, error, refetch } = useAdminAlbums();

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title="Admin"
        back
        right={<Feather name="shield" size={20} color={Colors.ink} />}
      />
      <View style={styles.intro}>
        <Text style={styles.introText}>
          Marcá un álbum como público para que aparezca en el carrusel del Landing.
          Privado = solo accesible con código.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.red} />
        }
      >
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
        <Text style={styles.meta}>
          {row.total_stickers} figus · @{row.owner_name} · {row.member_count} jugando
        </Text>
      </View>
      <Switch
        value={optimistic}
        onValueChange={onToggle}
        disabled={busy}
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
  center2: { flex: 1, gap: 2 },
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
