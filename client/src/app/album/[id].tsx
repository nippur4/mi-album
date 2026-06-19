import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Checklist, type ChecklistItem } from '@/components/checklist';
import { EditTotalModal } from '@/components/edit-total-modal';
import { ImageUploadCard } from '@/components/image-upload-card';
import { PresetPickerModal } from '@/components/preset-picker-modal';
import { ScreenHeader } from '@/components/screen-header';
import { StickerCell } from '@/components/sticker-cell';
import { Colors, FontFamily, FontSize, Layout, Radius, Spacing } from '@/constants/theme';
import {
  publishAlbum,
  updateAlbumContent,
  useAlbumDetail,
} from '@/lib/queries/albums';
import { useIsPro } from '@/lib/queries/subscriptions';
import { uploadImage } from '@/lib/queries/uploads';
import { makePresetKey } from '@/lib/storage';
import { errorMessage } from '@/lib/errors';

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { album, stickers, isLoading, error, refetch } = useAlbumDetail(id);
  const { isPro } = useIsPro();
  const [coverBusy, setCoverBusy] = useState(false);
  const [packBusy, setPackBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [presetFor, setPresetFor] = useState<'cover' | 'pack' | null>(null);
  const [editingTotal, setEditingTotal] = useState(false);

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
    const link = `mialbum://join/${album.share_code}`;
    try {
      await Share.share({
        message:
          `Unite a mi álbum "${album.name}" en Mi Álbum de Figuritas:\n\n` +
          `Código: ${album.share_code}\n` +
          `Link directo: ${link}`,
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

  async function onPresetSelected(presetId: string) {
    if (!album || !presetFor) return;
    const key = makePresetKey(presetId);
    const patch =
      presetFor === 'cover'
        ? { cover_thumb_key: key, cover_large_key: key }
        : { pack_thumb_key: key, pack_large_key: key };
    if (presetFor === 'cover') setCoverBusy(true);
    else setPackBusy(true);
    try {
      const { error: updErr } = await updateAlbumContent(album.id, patch);
      if (updErr) throw updErr;
      await refetch();
    } catch (err: any) {
      Alert.alert('Error', errorMessage(err));
    } finally {
      setCoverBusy(false);
      setPackBusy(false);
    }
  }

  async function onSaveTotal(newTotal: number) {
    if (!album) return;
    const { error: updErr } = await updateAlbumContent(album.id, {
      total_stickers: newTotal,
    });
    if (updErr) {
      Alert.alert('No se pudo guardar', errorMessage(updErr));
      throw updErr;
    }
    await refetch();
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
        <View style={[styles.statusBanner, { backgroundColor: statusBg(album.status) }]}>
          <Text style={[styles.statusLabel, { color: statusFg(album.status) }]}>
            {statusText(album.status)}
          </Text>
        </View>

        {album.status === 'published' && (
          <View style={styles.codeCard}>
            <Text style={styles.codeLabel}>CÓDIGO PARA COMPARTIR</Text>
            <Text style={styles.code}>{album.share_code}</Text>
            <Text style={styles.codeHint}>
              Quien lo ingrese se va a unir a tu álbum.
            </Text>
          </View>
        )}

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
                  <Pressable onPress={() => setPresetFor('cover')} style={styles.presetBtn}>
                    <Text style={styles.presetBtnText}>Usar plantilla</Text>
                  </Pressable>
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
                  <Pressable onPress={() => setPresetFor('pack')} style={styles.presetBtn}>
                    <Text style={styles.presetBtnText}>Usar plantilla</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>
              FIGURITAS · {stickers.length} / {album.total_stickers}
            </Text>
            {isDraft && (
              <Pressable onPress={() => setEditingTotal(true)} hitSlop={8}>
                <Text style={styles.linkText}>Editar cantidad</Text>
              </Pressable>
            )}
          </View>

          {stickers.length === 0 ? (
            <View style={styles.stickersCard}>
              <Text style={styles.placeholderTitle}>Aún no hay figuritas.</Text>
              {isDraft && (
                <Button
                  label="Cargar figurita"
                  variant="outline"
                  onPress={() => router.push(`/sticker/new?albumId=${album.id}`)}
                />
              )}
            </View>
          ) : (
            <>
              <View style={styles.grid}>
                {stickers.map((s) => (
                  <View key={s.id} style={styles.gridCell}>
                    <StickerCell
                      sticker={s}
                      onPress={isDraft ? () => router.push(`/sticker/${s.id}`) : undefined}
                    />
                  </View>
                ))}
              </View>
              {isDraft && (
                <Button
                  label={`Cargar otra (${stickers.length}/${album.total_stickers})`}
                  variant="outline"
                  onPress={() => router.push(`/sticker/new?albumId=${album.id}`)}
                />
              )}
            </>
          )}
        </View>
      </ScrollView>

      <PresetPickerModal
        visible={presetFor !== null}
        onClose={() => setPresetFor(null)}
        onSelect={onPresetSelected}
      />

      <EditTotalModal
        visible={editingTotal}
        currentTotal={album.total_stickers}
        minTotal={stickers.reduce((m, s) => Math.max(m, s.number), 1)}
        maxTotal={isPro ? 1000 : 75}
        onClose={() => setEditingTotal(false)}
        onSave={onSaveTotal}
      />

      <View style={styles.footer}>
        {isDraft && (
          <>
            {!allReady && (
              <Text style={styles.gateHint}>
                Para publicar y compartir, completá todos los pasos del checklist.
              </Text>
            )}
            <Button
              label={publishing ? 'Publicando...' : allReady ? 'Publicar álbum' : 'Faltan pasos'}
              onPress={onPublish}
              disabled={!allReady || publishing}
              loading={publishing}
            />
          </>
        )}
        {album.status === 'published' && (
          <Button label="Compartir" onPress={onShare} />
        )}
        {album.status === 'read_only' && (
          <Text style={styles.pausedHint}>
            Álbum en pausa. Renová tu suscripción para reactivarlo.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

function statusText(s: string) {
  switch (s) {
    case 'draft': return 'BORRADOR · EN CONSTRUCCIÓN';
    case 'published': return 'PUBLICADO';
    case 'read_only': return 'PAUSADO';
    case 'archived': return 'ARCHIVADO';
    default: return s.toUpperCase();
  }
}
function statusBg(s: string) {
  switch (s) {
    case 'draft': return Colors.paper3;
    case 'published': return Colors.green;
    case 'read_only': return Colors.amberWarnBg;
    case 'archived': return Colors.paper3;
    default: return Colors.paper3;
  }
}
function statusFg(s: string) {
  switch (s) {
    case 'draft': return Colors.inkSoft;
    case 'published': return Colors.greenTextDark;
    case 'read_only': return Colors.amberWarn;
    case 'archived': return Colors.muted;
    default: return Colors.muted;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusBanner: {
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    alignItems: 'center',
  },
  statusLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    letterSpacing: 1.8,
    fontWeight: '700',
  },
  gateHint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  pausedHint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.amberWarn,
    textAlign: 'center',
    backgroundColor: Colors.amberWarnBg,
    padding: Spacing.md,
    borderRadius: 12,
  },
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
  },
  linkText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.red,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textDecorationLine: 'underline',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.gridGap,
  },
  gridCell: {
    // 3 columnas con gap de 9px → cada celda ~31% para que entren con los gaps
    flexBasis: '31.5%',
    flexGrow: 0,
    flexShrink: 0,
  },
  imageGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  imageCol: { flex: 1, gap: Spacing.sm },
  presetBtn: {
    alignSelf: 'center',
    paddingVertical: Spacing.xs,
  },
  presetBtnText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.red,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textDecorationLine: 'underline',
  },
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
