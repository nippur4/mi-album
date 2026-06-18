import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Checklist, type ChecklistItem } from '@/components/checklist';
import { ImageUploadCard } from '@/components/image-upload-card';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import {
  publishAlbum,
  updateAlbumContent,
  useAlbumDetail,
} from '@/lib/queries/albums';
import { uploadImage } from '@/lib/queries/uploads';
import { errorMessage } from '@/lib/errors';

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { album, stickers, isLoading, error, refetch } = useAlbumDetail(id);
  const [coverBusy, setCoverBusy] = useState(false);
  const [packBusy, setPackBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);

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

  const items: ChecklistItem[] = [
    { label: 'Nombre y cantidad', done: true },
    { label: 'Carátula del álbum', done: !!album.cover_thumb_key },
    { label: 'Imagen del sobre', done: !!album.pack_thumb_key },
    {
      label: 'Cargar figuritas',
      done: stickers.length >= album.total_stickers,
      hint: `${stickers.length} / ${album.total_stickers}`,
    },
  ];
  const allReady = items.every((i) => i.done);
  const isDraft = album.status === 'draft';

  async function onShare() {
    if (!album) return;
    try {
      await Share.share({
        message: `Unite a mi álbum "${album.name}" con el código ${album.share_code}.`,
      });
    } catch {}
  }

  async function onPickedCover(asset: import('expo-image-picker').ImagePickerAsset) {
    if (!album) return;
    setCoverBusy(true);
    try {
      const keys = await uploadImage(album.id, 'cover', asset);
      const { error: updErr } = await updateAlbumContent(album.id, {
        cover_thumb_key: keys.thumb_key,
        cover_large_key: keys.large_key,
      });
      if (updErr) throw updErr;
      await refetch();
    } catch (err: any) {
      Alert.alert('Error', errorMessage(err));
    } finally {
      setCoverBusy(false);
    }
  }

  async function onPickedPack(asset: import('expo-image-picker').ImagePickerAsset) {
    if (!album) return;
    setPackBusy(true);
    try {
      const keys = await uploadImage(album.id, 'pack', asset);
      const { error: updErr } = await updateAlbumContent(album.id, {
        pack_thumb_key: keys.thumb_key,
        pack_large_key: keys.large_key,
      });
      if (updErr) throw updErr;
      await refetch();
    } catch (err: any) {
      Alert.alert('Error', errorMessage(err));
    } finally {
      setPackBusy(false);
    }
  }

  async function onPublish() {
    if (!album) return;
    setPublishing(true);
    const { error: publishErr } = await publishAlbum(album.id);
    setPublishing(false);
    if (publishErr) {
      Alert.alert('No se pudo publicar', errorMessage(publishErr));
      return;
    }
    await refetch();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={album.name} back />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>CÓDIGO PARA COMPARTIR</Text>
          <Text style={styles.code}>{album.share_code}</Text>
          <Text style={styles.codeHint}>
            Quien lo ingrese se va a unir a tu álbum.
          </Text>
        </View>

        {isDraft && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>PARA PUBLICAR</Text>
              <Checklist items={items} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>IMÁGENES</Text>
              <View style={styles.imageGrid}>
                <View style={styles.imageCol}>
                  <ImageUploadCard
                    thumbKey={album.cover_thumb_key}
                    label="Carátula"
                    hint="4:5"
                    aspect={[4, 5]}
                    onPicked={onPickedCover}
                    busy={coverBusy}
                  />
                </View>
                <View style={styles.imageCol}>
                  <ImageUploadCard
                    thumbKey={album.pack_thumb_key}
                    label="Sobre"
                    hint="3:4"
                    aspect={[3, 4]}
                    onPicked={onPickedPack}
                    busy={packBusy}
                  />
                </View>
              </View>
            </View>
          </>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FIGURITAS</Text>
          <View style={styles.stickersCard}>
            <Text style={styles.placeholderTitle}>
              {stickers.length === 0
                ? 'Aún no hay figuritas.'
                : `${stickers.length} / ${album.total_stickers} cargada${stickers.length === 1 ? '' : 's'}.`}
            </Text>
            {isDraft && (
              <Button
                label="Cargar figurita"
                variant="outline"
                onPress={() => router.push(`/sticker/new?albumId=${album.id}`)}
              />
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Compartir" variant="outline" onPress={onShare} />
        {isDraft && (
          <Button
            label={publishing ? 'Publicando...' : allReady ? 'Publicar álbum' : 'Faltan pasos'}
            onPress={onPublish}
            disabled={!allReady || publishing}
            loading={publishing}
          />
        )}
      </View>
    </SafeAreaView>
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
  scroll: {
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.md,
    paddingBottom: 180,
    gap: Spacing.xl,
  },
  codeCard: {
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  codeLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
  },
  code: {
    fontFamily: FontFamily.display,
    fontSize: 42,
    color: Colors.ink,
    letterSpacing: 4,
    marginTop: Spacing.xs,
  },
  codeHint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  section: { gap: Spacing.sm },
  sectionLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
  },
  imageGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  imageCol: { flex: 1 },
  stickersCard: {
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  placeholderTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  footer: {
    position: 'absolute',
    left: Spacing.screenX,
    right: Spacing.screenX,
    bottom: Spacing.xl,
    gap: Spacing.sm,
  },
});
