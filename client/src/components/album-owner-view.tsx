import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
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
import { ProgressCard } from '@/components/progress-card';
import { QrPosterModal } from '@/components/qr-poster-modal';
import { ScreenHeader } from '@/components/screen-header';
import { StatusBadge } from '@/components/status-badge';
import { StickerCell, StickerCellEmpty } from '@/components/sticker-cell';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import {
  publishAlbum,
  updateAlbumContent,
  type Album,
  type Sticker,
} from '@/lib/queries/albums';
import { enableQrForAlbum } from '@/lib/queries/qr';
import { useIsPro } from '@/lib/queries/subscriptions';
import { uploadImage } from '@/lib/queries/uploads';
import { errorMessage } from '@/lib/errors';

interface Props {
  album: Album;
  stickers: Sticker[];
  // Re-fetch del detalle, llamado tras cualquier mutación
  refetch: () => Promise<void> | void;
}

// Vista del owner sobre su propio álbum.
// Draft: checklist + uploads (imágenes + plantillas) + grilla editable + publicar.
// Published: code card + botón Compartir. read_only: aviso de pausa.
export function OwnerAlbumView({ album, stickers, refetch }: Props) {
  const router = useRouter();
  const { isPro } = useIsPro();
  const [coverBusy, setCoverBusy] = useState(false);
  const [packBusy, setPackBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [enablingQr, setEnablingQr] = useState(false);
  const [presetFor, setPresetFor] = useState<'cover' | 'pack' | null>(null);
  const [editingTotal, setEditingTotal] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // El feedback "Copiado" se autodestruye tras 2s.
  useEffect(() => {
    if (!codeCopied) return;
    const t = setTimeout(() => setCodeCopied(false), 2000);
    return () => clearTimeout(t);
  }, [codeCopied]);

  async function copyShareCode() {
    if (!album.share_code) return;
    await Clipboard.setStringAsync(album.share_code);
    setCodeCopied(true);
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

  async function onPresetSelected(keys: { thumb_key: string; large_key: string }) {
    if (!presetFor) return;
    const patch =
      presetFor === 'cover'
        ? { cover_thumb_key: keys.thumb_key, cover_large_key: keys.large_key }
        : { pack_thumb_key: keys.thumb_key, pack_large_key: keys.large_key };
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
    const { error: updErr } = await updateAlbumContent(album.id, { total_stickers: newTotal });
    if (updErr) {
      Alert.alert('No se pudo guardar', errorMessage(updErr));
      throw updErr;
    }
    await refetch();
  }

  async function onPublish() {
    setPublishing(true);
    const { error: publishErr } = await publishAlbum(album.id);
    setPublishing(false);
    if (publishErr) {
      Alert.alert('No se pudo publicar', errorMessage(publishErr));
      return;
    }
    await refetch();
  }

  const stickerByNumber = new Map<number, Sticker>(stickers.map((s) => [s.number, s]));
  const gridCells = Array.from({ length: album.total_stickers }, (_, i) => i + 1);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader
        title={album.name}
        back
        multiline
        right={<StatusBadge variant={album.status as any} />}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <ProgressCard
          current={stickers.length}
          total={album.total_stickers}
          caption="CARGADAS"
          rightStat={isDraft ? `${album.total_stickers - stickers.length} para terminar` : undefined}
        />

        {album.status === 'published' && (
          <Pressable
            onPress={copyShareCode}
            style={({ pressed }) => [styles.codeCard, pressed && styles.codeCardPressed]}
            accessibilityRole="button"
            accessibilityLabel="Copiar código al portapapeles"
          >
            <Text style={styles.codeLabel}>
              {codeCopied ? '¡COPIADO!' : 'CÓDIGO PARA COMPARTIR · TOCÁ PARA COPIAR'}
            </Text>
            <Text style={styles.code}>{album.share_code}</Text>
            <Text style={styles.codeHint}>Quien lo ingrese se va a unir a tu álbum.</Text>
          </Pressable>
        )}

        {album.status === 'published' && (
          <QrSection
            isPro={isPro}
            qrEnabled={(album.pack_config as any)?.qr?.enabled === true}
            enabling={enablingQr}
            onShow={() => setShowQr(true)}
            onEnable={async () => {
              setEnablingQr(true);
              try {
                await enableQrForAlbum(album.id);
                await refetch();
              } catch (err: any) {
                Alert.alert('No se pudo activar', errorMessage(err));
              } finally {
                setEnablingQr(false);
              }
            }}
          />
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

          {stickers.length === 0 && isDraft ? (
            <View style={styles.emptyHero}>
              <View style={styles.grid}>
                {gridCells.slice(0, 6).map((n) => (
                  <View key={n} style={styles.gridCell}>
                    <StickerCellEmpty number={n} showPlus={n === 1} />
                  </View>
                ))}
              </View>
              <Text style={styles.emptyHeroTitle}>AÚN NO HAY{'\n'}FIGURITAS</Text>
              <Text style={styles.emptyHeroBody}>
                Subí las imágenes y a cada una asigná número y nombre.
                Recién ahí tus jugadores pueden empezar a coleccionar.
              </Text>
              <Button
                label="Cargar figuritas"
                onPress={() => router.push(`/sticker/new?albumId=${album.id}`)}
              />
            </View>
          ) : (
            <>
              <View style={styles.grid}>
                {gridCells.map((n) => {
                  const s = stickerByNumber.get(n);
                  if (s) {
                    // Siempre permitir abrir la figurita. El thin router en
                    // [id].tsx bifurca: owner+draft → editor, sino → vista grande.
                    return (
                      <View key={n} style={styles.gridCell}>
                        <StickerCell
                          sticker={s}
                          onPress={() => router.push(`/sticker/${s.id}`)}
                        />
                      </View>
                    );
                  }
                  return (
                    <View key={n} style={styles.gridCell}>
                      <StickerCellEmpty
                        number={n}
                        onPress={
                          isDraft
                            ? () => router.push(`/sticker/new?albumId=${album.id}&number=${n}`)
                            : undefined
                        }
                      />
                    </View>
                  );
                })}
              </View>
              {isDraft && stickers.length < album.total_stickers && (
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
        kind={presetFor}
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

      <QrPosterModal
        visible={showQr}
        albumId={album.id}
        albumName={album.name}
        onClose={() => setShowQr(false)}
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

// Sección QR de sobres: muestra el botón apropiado según estado pro + qr_enabled.
function QrSection({
  isPro,
  qrEnabled,
  enabling,
  onShow,
  onEnable,
}: {
  isPro: boolean;
  qrEnabled: boolean;
  enabling: boolean;
  onShow: () => void;
  onEnable: () => void;
}) {
  return (
    <View style={qrStyles.card}>
      <View style={qrStyles.head}>
        <Text style={qrStyles.label}>QR DE SOBRES</Text>
        {!isPro && <Text style={qrStyles.proBadge}>PRO</Text>}
      </View>
      {!isPro ? (
        <Text style={qrStyles.hint}>
          Generá un QR para que jugadores escaneen y reciban sobres en eventos o
          espacios físicos. Función Pro.
        </Text>
      ) : qrEnabled ? (
        <>
          <Text style={qrStyles.hint}>
            Mostrá el QR a los jugadores para que reciban sobres escaneando.
          </Text>
          <Button label="Mostrar QR" variant="gold" onPress={onShow} />
        </>
      ) : (
        <>
          <Text style={qrStyles.hint}>
            Activá el QR para empezar a distribuir sobres por escaneo.
          </Text>
          <Button
            label={enabling ? 'Activando...' : 'Activar QR'}
            onPress={onEnable}
            disabled={enabling}
            loading={enabling}
          />
        </>
      )}
    </View>
  );
}

const qrStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  proBadge: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.ink,
    backgroundColor: Colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  hint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
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
  codeCardPressed: {
    backgroundColor: Colors.paper3,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.gridGap,
  },
  gridCell: {
    flexBasis: '31.5%',
    flexGrow: 0,
    flexShrink: 0,
  },
  emptyHero: {
    gap: Spacing.lg,
    alignItems: 'center',
  },
  emptyHeroTitle: {
    fontFamily: FontFamily.display,
    fontSize: 36,
    color: Colors.ink,
    textAlign: 'center',
    lineHeight: 38,
    letterSpacing: 1,
  },
  emptyHeroBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
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
  footer: {
    position: 'absolute',
    left: Spacing.screenX,
    right: Spacing.screenX,
    bottom: Spacing.xl,
    gap: Spacing.sm,
  },
});
