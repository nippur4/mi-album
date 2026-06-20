import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useSticker } from '@/lib/queries/stickers';

import { EditStickerView } from './_edit-mode';
import { ViewStickerView } from './_view-mode';

// Router del detalle de figurita: carga sticker + album mínimo y bifurca.
// Owner del álbum (en draft) → editor. Resto → vista grande con foil.
export default function StickerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const { sticker, isLoading } = useSticker(id);

  const [album, setAlbum] = useState<{
    owner_id: string;
    status: string;
    name: string;
    total_stickers: number;
  } | null>(null);

  useEffect(() => {
    if (!sticker) return;
    supabase
      .from('albums')
      .select('owner_id, status, name, total_stickers')
      .eq('id', sticker.album_id)
      .maybeSingle()
      .then(({ data }) => setAlbum(data as any));
  }, [sticker]);

  if (isLoading && !sticker) {
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
    <EditStickerView sticker={sticker} />
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
