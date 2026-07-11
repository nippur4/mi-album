import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/auth';
import { useAlbumDetail } from '@/lib/queries/albums';
import { useFocusRefetchStale } from '@/lib/use-focus-refetch';
import { errorMessage } from '@/lib/errors';

import { OwnerAlbumView } from '@/components/album-owner-view';
import { UserAlbumView } from '@/components/album-user-view';

// Router del detalle del álbum: carga el álbum y bifurca según el caller sea
// el owner o un miembro. La lógica de cada vista vive en los archivos `_*-view.tsx`.
export default function AlbumDetailScreen() {
  const { id, as: viewAs } = useLocalSearchParams<{ id: string; as?: string }>();
  const { session } = useSession();
  const { album, stickers, isLoading, error, refetch } = useAlbumDetail(id);

  // Solo si está stale: el detail baja el álbum + TODAS sus figuritas (hasta
  // 1001 filas en el especial) — refetchear en cada "volver" era carísimo.
  useFocusRefetchStale(['albums', 'detail', id]);

  if (isLoading && !album) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Álbum" back />
        <View style={styles.center}><ActivityIndicator color={Colors.red} /></View>
      </SafeAreaView>
    );
  }

  if (!album) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Álbum" back />
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {error ? errorMessage(error.raw) : 'No encontramos el álbum.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Bifurcación:
  //   - Owner: vista owner por default. Con `?as=player` fuerza vista user
  //     (para que el owner pueda jugar su propio álbum, Fase 10).
  //   - Non-owner: siempre vista user.
  const isOwner = session?.user.id === album.owner_id;
  const asPlayer = viewAs === 'player';
  const showOwnerView = isOwner && !asPlayer;
  return showOwnerView ? (
    <OwnerAlbumView album={album} stickers={stickers} refetch={refetch} />
  ) : (
    <UserAlbumView album={album} stickers={stickers} />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    color: Colors.red,
    paddingHorizontal: Spacing.screenX,
    textAlign: 'center',
  },
});
