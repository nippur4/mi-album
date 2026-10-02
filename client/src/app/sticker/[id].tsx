import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/auth';
import { useAlbumRow } from '@/lib/queries/albums';
import type { PackConfig } from '@/lib/queries/economy';
import { useSticker } from '@/lib/queries/stickers';

import { EditStickerView } from '@/components/sticker-edit-mode';
import { ViewStickerView } from '@/components/sticker-view-mode';

// Router del detalle de figurita: carga sticker + album mínimo y bifurca.
// Owner del álbum (en draft) → editor. Resto → vista grande con foil.
export default function StickerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const { sticker, isLoading } = useSticker(id);
  // useAlbumRow y no una query suelta: reusa como initialData el detalle del
  // álbum si ya está en cache (venís de la grilla → cero fetch) y cachea el
  // resultado para las siguientes figuritas que abras del mismo álbum.
  const { album, isLoading: albumLoading } = useAlbumRow(sticker?.album_id);

  // El álbum también cuenta como "cargando": antes, mientras bajaba su fila,
  // la pantalla mostraba el error de "no encontramos la figurita" por un frame.
  if ((isLoading && !sticker) || (!!sticker && albumLoading && !album)) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Figurita" back />
        <View style={styles.center}><ActivityIndicator color={Colors.red} /></View>
      </SafeAreaView>
    );
  }

  if (!sticker || !album) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Figurita" back />
        <View style={styles.center}>
          <Text style={styles.errorText}>No encontramos la figurita.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isOwnerDraft =
    session?.user.id === album.owner_id && album.status === 'draft';

  return isOwnerDraft ? (
    <EditStickerView
      sticker={sticker}
      packConfig={album.pack_config as PackConfig | null}
    />
  ) : (
    <ViewStickerView
      sticker={sticker}
      albumName={album.name}
      albumTotal={album.total_stickers}
    />
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
