import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/auth';
import { useAlbumDetail } from '@/lib/queries/albums';
import { errorMessage } from '@/lib/errors';

import { OwnerAlbumView } from './_owner-view';
import { UserAlbumView } from './_user-view';

// Router del detalle del álbum: carga el álbum y bifurca según el caller sea
// el owner o un miembro. La lógica de cada vista vive en los archivos `_*-view.tsx`.
export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const { album, stickers, isLoading, error, refetch } = useAlbumDetail(id);

  useFocusEffect(useCallback(() => { refetch(); }, [refetch]));

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

  const isOwner = session?.user.id === album.owner_id;
  return isOwner ? (
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
