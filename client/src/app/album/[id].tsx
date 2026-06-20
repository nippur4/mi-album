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
import { ProgressCard } from '@/components/progress-card';
import { ScreenHeader } from '@/components/screen-header';
import { StatusBadge } from '@/components/status-badge';
import { StickerCell, StickerCellEmpty, StickerCellMissing } from '@/components/sticker-cell';
import { Colors, FontFamily, FontSize, Layout, Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/auth';
import {
  publishAlbum,
  updateAlbumContent,
  useAlbumDetail,
  type Album,
  type Sticker,
} from '@/lib/queries/albums';
import { useAvailablePacksCount, useUserCollection } from '@/lib/queries/collection';
import { claimDailyPack, useDailyPackStatus } from '@/lib/queries/daily';
import { pasteSticker } from '@/lib/queries/packs';
import { useIsPro } from '@/lib/queries/subscriptions';
import { uploadImage } from '@/lib/queries/uploads';
import { makePresetKey } from '@/lib/storage';
import { errorMessage } from '@/lib/errors';
import { Countdown } from '@/components/countdown';

export default function AlbumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useSession();
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

  const isOwner = session?.user.id === album.owner_id;
  if (!isOwner) return <UserAlbumView album={album} stickers={stickers} />;

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
    const { error: updErr } = await updateAlbumContent(album.id, { total_stickers: newTotal });
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

  // Grilla del owner: cargadas + placeholders dashed para los huecos
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
          rightStat={
            isDraft
              ? `${album.total_stickers - stickers.length} para terminar`
              : undefined
          }
        />

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

          {stickers.length === 0 && isDraft ? (
            <View style={styles.emptyHero}>
              <View style={styles.grid}>
                {gridCells.slice(0, 6).map((n) => (
                  <View key={n} style={styles.gridCell}>
                    <StickerCellEmpty number={n} showPlus={n === 1} />
                  </View>
                ))}
              </View>
              <Text style={styles.emptyHeroTitle}>
                AÚN NO HAY{'\n'}FIGURITAS
              </Text>
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
                    return (
                      <View key={n} style={styles.gridCell}>
                        <StickerCell
                          sticker={s}
                          onPress={isDraft ? () => router.push(`/sticker/${s.id}`) : undefined}
                        />
                      </View>
                    );
                  }
                  return (
                    <View key={n} style={styles.gridCell}>
                      <StickerCellEmpty
                        number={n}
                        onPress={isDraft ? () => router.push(`/sticker/new?albumId=${album.id}`) : undefined}
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

// ---------------------------------------------------------------------------
// Vista del usuario (no-owner): banner de bienvenida + grilla con silhouettes.
// ---------------------------------------------------------------------------

function UserAlbumView({ album, stickers }: { album: Album; stickers: Sticker[] }) {
  const router = useRouter();
  const { collection, refetch: refetchCollection } = useUserCollection(album.id);
  const { count: packsCount, refetch: refetchPacks } = useAvailablePacksCount(album.id);
  const { status: daily, refetch: refetchDaily } = useDailyPackStatus(album.id);
  const [claiming, setClaiming] = useState(false);

  async function onClaimDaily() {
    setClaiming(true);
    const { error } = await claimDailyPack(album.id);
    setClaiming(false);
    if (error) {
      Alert.alert('No se pudo reclamar', errorMessage(error));
      return;
    }
    refetchPacks();
    refetchDaily();
  }

  async function onPaste(stickerId: string) {
    const { error } = await pasteSticker(stickerId);
    if (error) {
      Alert.alert('No se pudo pegar', errorMessage(error));
      return;
    }
    refetchCollection();
  }

  let myPastedCount = 0;
  let repesCount = 0;
  let toPasteCount = 0;
  for (const entry of collection.values()) {
    if (entry.pasted) {
      myPastedCount += 1;
      const extras = entry.quantity - 1;
      if (extras > 0) repesCount += extras;
    } else {
      // Tengo la figurita pero falta pegarla. Si quantity > 1 hay repes adicionales.
      toPasteCount += 1;
      const extras = entry.quantity - 1;
      if (extras > 0) repesCount += extras;
    }
  }
  const missingCount = album.total_stickers - myPastedCount - toPasteCount;
  const isWelcome = myPastedCount === 0 && toPasteCount === 0 && collection.size === 0;

  const gridCells = Array.from({ length: album.total_stickers }, (_, i) => i + 1);
  const stickerByNumber = new Map<number, Sticker>(stickers.map((s) => [s.number, s]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={album.name} back multiline />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 140 }]}>
        {isWelcome && (
          <View style={styles.welcomeBanner}>
            <Text style={styles.welcomeKicker}>¡TE UNISTE!</Text>
            <Text style={styles.welcomeTitle}>EMPEZÁ TU{'\n'}COLECCIÓN</Text>
          </View>
        )}

        <ProgressCard
          current={myPastedCount}
          total={album.total_stickers}
          caption="PEGADAS"
          rightStat={`${repesCount} repetidas · ${missingCount} faltan`}
        />

        {toPasteCount > 0 && (
          <View style={styles.toPasteBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toPasteBannerTitle}>
                Tenés {toPasteCount} figurita{toPasteCount > 1 ? 's' : ''} sin pegar
              </Text>
              <Text style={styles.toPasteBannerSub}>
                Tocá cada una en la grilla para pegarla.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            FIGURITAS · {myPastedCount} / {album.total_stickers}
          </Text>
          <View style={styles.grid}>
            {gridCells.map((n) => {
              const s = stickerByNumber.get(n);
              if (!s) {
                return (
                  <View key={n} style={styles.gridCell}>
                    <StickerCellMissing number={n} />
                  </View>
                );
              }
              const entry = collection.get(s.id);
              if (!entry) {
                return (
                  <View key={n} style={styles.gridCell}>
                    <StickerCellMissing number={n} />
                  </View>
                );
              }
              if (entry.pasted) {
                const extras = entry.quantity - 1;
                return (
                  <View key={n} style={styles.gridCell}>
                    <StickerCell sticker={s} extraCount={Math.max(0, extras)} />
                  </View>
                );
              }
              // Sin pegar: borde gold + tap → pega
              return (
                <View key={n} style={styles.gridCell}>
                  <StickerCell
                    sticker={s}
                    state="to_paste"
                    extraCount={Math.max(0, entry.quantity - 1)}
                    onPress={() => onPaste(s.id)}
                  />
                </View>
              );
            })}
          </View>
        </View>

        {(repesCount > 0 || missingCount > 0) && (
          <Button
            label="Ver cambios posibles"
            variant="outline"
            onPress={() => router.push(`/trade/matches?albumId=${album.id}`)}
          />
        )}
      </ScrollView>

      {/* CTA inferior con 3 estados: sobres listos, reclamar daily, countdown */}
      {packsCount > 0 ? (
        <Pressable
          onPress={() => router.push(`/pack/open?albumId=${album.id}`)}
          style={({ pressed }) => [styles.packsCta, pressed && styles.packsCtaPressed]}
        >
          <Text style={styles.packsCtaLabel}>
            TENÉS {packsCount}{'\n'}SOBRE{packsCount > 1 ? 'S' : ''}
          </Text>
          <View style={styles.packsCtaAction}>
            <Text style={styles.packsCtaActionText}>Abrir</Text>
          </View>
        </Pressable>
      ) : daily.canClaim ? (
        <Pressable
          onPress={onClaimDaily}
          disabled={claiming}
          style={({ pressed }) => [styles.packsCta, pressed && styles.packsCtaPressed]}
        >
          <Text style={styles.packsCtaLabel}>
            SOBRE DIARIO{'\n'}DISPONIBLE
          </Text>
          <View style={styles.packsCtaAction}>
            <Text style={styles.packsCtaActionText}>
              {claiming ? '...' : 'Reclamar'}
            </Text>
          </View>
        </Pressable>
      ) : daily.enabled && daily.nextAvailableAt ? (
        <View style={styles.dailyCard}>
          <View style={styles.dailyCardLeft}>
            <Text style={styles.dailyCardKicker}>SOBRE DIARIO GRATIS</Text>
            <Text style={styles.dailyCardSub}>PRÓXIMO EN</Text>
          </View>
          <Countdown target={daily.nextAvailableAt} style={styles.dailyCountdown} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------

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
  // Empty hero (draft sin figuritas)
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
  // Welcome banner (user recién unido)
  welcomeBanner: {
    backgroundColor: Colors.red,
    borderRadius: Radius.cardLg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  welcomeKicker: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    color: Colors.paper,
    letterSpacing: 2,
    fontWeight: '700',
    opacity: 0.9,
  },
  welcomeTitle: {
    fontFamily: FontFamily.display,
    fontSize: 30,
    color: Colors.paper,
    lineHeight: 32,
    letterSpacing: 1,
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
  packsCta: {
    position: 'absolute',
    left: Spacing.screenX,
    right: Spacing.screenX,
    bottom: Spacing.xl,
    backgroundColor: Colors.red,
    borderRadius: Radius.cardLg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: Colors.redShadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
  },
  packsCtaPressed: {
    transform: [{ translateY: 5 }],
    shadowOpacity: 0,
    elevation: 0,
  },
  packsCtaLabel: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    color: Colors.paper,
    lineHeight: 22,
    letterSpacing: 0.5,
  },
  packsCtaAction: {
    backgroundColor: Colors.gold,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  packsCtaActionText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '800',
    color: Colors.ink,
    letterSpacing: 0.5,
  },
  dailyCard: {
    position: 'absolute',
    left: Spacing.screenX,
    right: Spacing.screenX,
    bottom: Spacing.xl,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dailyCardLeft: {
    gap: 2,
  },
  dailyCardKicker: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.ink,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  dailyCardSub: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.5,
  },
  dailyCountdown: {
    fontSize: 20,
  },
  toPasteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.amberWarnBg,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.gold,
    gap: Spacing.sm,
  },
  toPasteBannerTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  toPasteBannerSub: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
  },
});
