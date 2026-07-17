import Feather from '@expo/vector-icons/Feather';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlbumPager } from '@/components/album-pager';
import { BulkStickerUploadModal } from '@/components/bulk-sticker-upload-modal';
import { DeleteAlbumModal } from '@/components/delete-album-modal';
import { EditAlbumNameModal } from '@/components/edit-album-name-modal';
import { EditPagesModal } from '@/components/edit-pages-modal';
import { Button } from '@/components/button';
import { Checklist, type ChecklistItem } from '@/components/checklist';
import { EditEconomyModal } from '@/components/edit-economy-modal';
import { EditTotalModal } from '@/components/edit-total-modal';
import { ImageUploadCard } from '@/components/image-upload-card';
import { PackProbabilityCard } from '@/components/pack-probability-card';
import { PresetPickerModal } from '@/components/preset-picker-modal';
import { ProgressCard } from '@/components/progress-card';
import { QrPosterModal } from '@/components/qr-poster-modal';
import { ScreenHeader } from '@/components/screen-header';
import { StatusBadge } from '@/components/status-badge';
import { StickerCell, StickerCellEmpty } from '@/components/sticker-cell';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import {
  albumNumberStart,
  albumPlayerCount,
  archiveAlbumByOwner,
  joinAlbumByCode,
  joinLinkFor,
  PROTECTED_ALBUM_IDS,
  publishAlbum,
  unarchiveAlbumByOwner,
  updateAlbumContent,
  type Album,
  type Sticker,
} from '@/lib/queries/albums';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';
import { DEFAULT_PACK_CONFIG, DEFAULT_TRADE_CONFIG, modeFromConfig, type PackConfig, type TradeConfig } from '@/lib/queries/economy';
import { proFeatureHint } from '@/lib/upsell-copy';
import {
  DEFAULT_CELL_ASPECT,
  DEFAULT_PAGE_COLOR,
  DEFAULT_PAGE_TEXTURE,
  type PageOverride,
} from '@/lib/page-config';
import { useIsPro } from '@/lib/queries/subscriptions';
import { swapStickerPositions } from '@/lib/queries/stickers';
import { useDesktopCap } from '@/lib/use-is-desktop';
import { uploadImage } from '@/lib/queries/uploads';
import { enableQrForAlbum } from '@/lib/queries/qr';
import { errorMessage } from '@/lib/errors';

interface Props {
  album: Album;
  stickers: Sticker[];
  // Re-fetch del detalle, llamado tras cualquier mutación.
  // Retorna Promise<any> para ser compatible con el shape de react-query.
  refetch: () => Promise<any> | void;
}

// Vista del owner sobre su propio álbum.
// Draft: checklist + uploads (imágenes + plantillas) + grilla editable + publicar.
// Published: code card + botón Compartir. read_only: aviso de pausa.
export function OwnerAlbumView({ album, stickers, refetch }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  // Cap desktop en header + contenido del scroll (el ScrollView queda
  // full-bleed para que la barra viva en el borde de la ventana).
  const desktopCap = useDesktopCap(760);
  const { isPro } = useIsPro();
  const { session } = useSession();
  const [coverBusy, setCoverBusy] = useState(false);
  const [packBusy, setPackBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Error de publicar inline: Alert.alert es no-op en web, así que el fallo se
  // tragaba y "no pasaba nada". Ahora se muestra debajo del botón.
  const [publishError, setPublishError] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const [enablingQr, setEnablingQr] = useState(false);
  const [presetFor, setPresetFor] = useState<'cover' | 'pack' | null>(null);
  const [editingTotal, setEditingTotal] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingEconomy, setEditingEconomy] = useState(false);
  const [editingPages, setEditingPages] = useState(false);
  // Hoja con la que abre el modal de hojas: null = lista, número = editor
  // directo de esa hoja (botón de editar sobre la hoja del pager).
  const [editPagesInitial, setEditPagesInitial] = useState<number | null>(null);
  const [bulkUpload, setBulkUpload] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  // Modo reordenar: primer tap elige la figurita, segundo tap el destino
  // (ocupado = swap, vacío = move). Solo draft.
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderFrom, setReorderFrom] = useState<number | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [swapping, setSwapping] = useState(false);
  // Estado "yo me joineé como jugador a mi propio álbum" (Fase 10).
  const [isJoinedAsPlayer, setIsJoinedAsPlayer] = useState<boolean | null>(null);
  const [joiningToPlay, setJoiningToPlay] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deletingAlbum, setDeletingAlbum] = useState(false);
  // Otros jugadores del álbum: define el copy del modal (retirar vs borrar).
  // Se refresca al abrir el modal de eliminar.
  const [playerCount, setPlayerCount] = useState(0);
  const isProtected = PROTECTED_ALBUM_IDS.has(album.id);

  // Chequeamos membership: null = cargando; true/false = respuesta del backend.
  useEffect(() => {
    if (!session?.user.id) return;
    supabase
      .from('user_album_membership')
      .select('user_id', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('album_id', album.id)
      .then(({ count }) => setIsJoinedAsPlayer((count ?? 0) > 0));
  }, [session?.user.id, album.id]);

  async function onPlayAlbum() {
    setJoiningToPlay(true);
    // Si nunca se joineó, primero llamamos fn_join_album para obtener welcome pack.
    // Si ya estaba joineado, fn_join_album es idempotente (devuelve joined=false).
    const { error } = await joinAlbumByCode(album.share_code);
    setJoiningToPlay(false);
    if (error) {
      Alert.alert('No se pudo empezar a jugar', errorMessage(error));
      return;
    }
    setIsJoinedAsPlayer(true);
    router.push(`/album/${album.id}?as=player`);
  }

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

  const packConfig: PackConfig = {
    ...DEFAULT_PACK_CONFIG,
    ...((album.pack_config as Partial<PackConfig>) ?? {}),
  };
  const tradeConfig: TradeConfig = {
    ...DEFAULT_TRADE_CONFIG,
    ...((album.trade_config as Partial<TradeConfig>) ?? {}),
  };
  const economyMode = modeFromConfig(packConfig);

  const items: ChecklistItem[] = [
    { label: 'Nombre y cantidad', done: true },
    { label: 'Carátula del álbum', done: !!album.cover_thumb_key },
    { label: 'Imagen del sobre', done: !!album.pack_thumb_key },
    {
      label: 'Cargar figuritas',
      done: stickers.length >= album.total_stickers,
      hint: `${stickers.length} / ${album.total_stickers}`,
    },
    {
      label: 'Cómo se consiguen las figuritas',
      done: economyMode !== 'none',
      hint: economyDescription(packConfig, tradeConfig),
    },
  ];
  const allReady = items.every((i) => i.done);
  const isDraft = album.status === 'draft';

  async function onShare() {
    // Link https (clickeable en WhatsApp etc.); el deep link mialbum:// no se
    // linkifica en apps de mensajería, así que ya no lo mandamos.
    const link = joinLinkFor(album.share_code);
    try {
      await Share.share({
        message:
          `Unite a mi álbum "${album.name}" en Mi Álbum de Figuritas:\n\n` +
          `${link}\n\n` +
          `Código: ${album.share_code}`,
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
    setPublishError(null);
    setPublishing(true);
    try {
      const { error: publishErr } = await publishAlbum(album.id);
      if (publishErr) {
        setPublishError(errorMessage(publishErr));
        return;
      }
      await refetch();
    } catch (err: any) {
      setPublishError(errorMessage(err));
    } finally {
      setPublishing(false);
    }
  }

  const isArchived = (album as any).owner_hidden === true;

  function onArchivePress() {
    if (isArchived) {
      // Des-archivar es directo, sin confirm.
      doArchive(false);
      return;
    }
    Alert.alert(
      'Archivar álbum',
      album.status === 'published'
        ? 'Se va a ocultar de tus listas. Los jugadores que ya se unieron lo siguen viendo y pueden seguir abriendo sobres. Podés desarchivarlo cuando quieras.'
        : 'Se va a ocultar de tus listas. Podés desarchivarlo cuando quieras.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Archivar', style: 'destructive', onPress: () => doArchive(true) },
      ],
    );
  }

  async function doArchive(hide: boolean) {
    setArchiving(true);
    const { error: archErr } = hide
      ? await archiveAlbumByOwner(album.id)
      : await unarchiveAlbumByOwner(album.id);
    setArchiving(false);
    if (archErr) {
      Alert.alert('No se pudo', errorMessage(archErr));
      return;
    }
    if (hide) {
      // Al archivar, volvemos a Gestionar (ya no aparece en esta vista).
      router.back();
    } else {
      await refetch();
    }
  }

  const stickerByNumber = new Map<number, Sticker>(stickers.map((s) => [s.number, s]));
  // Primer número del álbum (1 salvo el especial 0..1000 — migración 0041).
  const numberStart = albumNumberStart(album);

  function toggleReorder() {
    setReorderMode((v) => !v);
    setReorderFrom(null);
    setReorderError(null);
  }

  async function onReorderTap(n: number, occupied: boolean) {
    if (swapping) return;
    setReorderError(null);
    if (reorderFrom === null) {
      // El primer tap tiene que ser una figurita cargada (algo para mover).
      if (occupied) setReorderFrom(n);
      return;
    }
    if (reorderFrom === n) {
      setReorderFrom(null);
      return;
    }
    setSwapping(true);
    const { error } = await swapStickerPositions(album.id, reorderFrom, n);
    setSwapping(false);
    setReorderFrom(null);
    if (error) {
      // Inline y no Alert: en web Alert.alert es no-op.
      setReorderError(errorMessage(error));
      return;
    }
    await refetch();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={desktopCap}>
        <ScreenHeader
          title={album.name}
          back
          multiline
          right={<StatusBadge variant={album.status as any} />}
        />
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, desktopCap]}>
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

        {album.status === 'published' && (
          <Pressable
            onPress={onPlayAlbum}
            disabled={joiningToPlay}
            style={({ pressed }) => [
              styles.playCard,
              pressed && styles.playCardPressed,
              joiningToPlay && styles.playCardDisabled,
            ]}
          >
            <View style={styles.playIcon}>
              <Feather name="play" size={22} color={Colors.paper} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.playTitle}>
                {joiningToPlay
                  ? 'Preparando...'
                  : isJoinedAsPlayer
                    ? 'Seguir jugando este álbum'
                    : 'Jugar este álbum'}
              </Text>
              <Text style={styles.playSub}>
                {isJoinedAsPlayer
                  ? 'Volvé a la vista de jugador para abrir sobres y pegar figuritas.'
                  : 'Uníte como jugador para abrir sobres, pegar figuritas y completar tu propio álbum.'}
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color={Colors.muted} />
          </Pressable>
        )}

        {/* Economía: visible siempre, editable en draft y published */}
        <Pressable
          onPress={() => setEditingEconomy(true)}
          style={({ pressed }) => [
            styles.economyCard,
            economyMode === 'none' && styles.economyCardWarn,
            pressed && styles.economyCardPressed,
          ]}
        >
          <View
            style={[
              styles.economyIcon,
              economyMode === 'none' && styles.economyIconWarn,
            ]}
          >
            <Feather
              name={economyMode === 'none' ? 'alert-circle' : 'package'}
              size={26}
              color={economyMode === 'none' ? Colors.paper : Colors.paper}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.economyLabel}>CÓMO SE CONSIGUEN LAS FIGURITAS</Text>
            <Text
              style={[
                styles.economyValue,
                economyMode === 'none' && styles.economyValueWarn,
              ]}
              numberOfLines={2}
            >
              {economyDescription(packConfig, tradeConfig)}
            </Text>
            <Text style={styles.economyAction}>
              {economyMode === 'none' ? 'Tocá para configurar →' : 'Tocá para editar →'}
            </Text>
          </View>
        </Pressable>

        {/* Desglose de probabilidades por rareza. Se muestra solo si hay
            figuritas cargadas y la economía tiene sobres (daily o qr) —
            sino no tiene sentido calcular nada. */}
        {stickers.length > 0 && economyMode !== 'none' && (
          <PackProbabilityCard
            stickers={stickers}
            packSize={packConfig.pack_size ?? 5}
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
                    largeKey={album.cover_large_key}
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
                    largeKey={album.pack_large_key}
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
          <Text style={styles.sectionLabel}>
            FIGURITAS · {stickers.length} / {album.total_stickers}
          </Text>

          {/* Herramientas de edición, todas juntas debajo del contador. */}
          <View style={styles.toolsRow}>
            {isDraft && (
              <>
                <Pressable
                  onPress={() => setEditingName(true)}
                  style={({ pressed }) => [styles.editPill, pressed && styles.editPillPressed]}
                  hitSlop={6}
                >
                  <Feather name="edit-2" size={12} color={Colors.ink} />
                  <Text style={styles.editPillText}>Editar nombre</Text>
                </Pressable>
                <Pressable
                  onPress={() => setEditingTotal(true)}
                  style={({ pressed }) => [styles.editPill, pressed && styles.editPillPressed]}
                  hitSlop={6}
                >
                  <Feather name="hash" size={12} color={Colors.ink} />
                  <Text style={styles.editPillText}>Editar cantidad</Text>
                </Pressable>
              </>
            )}
            <Pressable
              onPress={() => {
                setEditPagesInitial(null);
                setEditingPages(true);
              }}
              style={({ pressed }) => [styles.editPill, pressed && styles.editPillPressed]}
              hitSlop={6}
            >
              <Feather name="layers" size={12} color={Colors.ink} />
              <Text style={styles.editPillText}>Editar hojas</Text>
            </Pressable>
            {isDraft && stickers.length >= 1 && (
              <Pressable
                onPress={toggleReorder}
                hitSlop={6}
                style={({ pressed }) => [
                  styles.editPill,
                  reorderMode && styles.editPillActive,
                  pressed && styles.editPillPressed,
                ]}
              >
                <Feather
                  name="shuffle"
                  size={12}
                  color={reorderMode ? Colors.paper : Colors.ink}
                />
                <Text style={[styles.editPillText, reorderMode && styles.editPillTextActive]}>
                  {reorderMode ? 'Listo, terminé' : 'Reordenar figuritas'}
                </Text>
              </Pressable>
            )}
          </View>

          {reorderMode && (
            <Text style={[styles.reorderHint, reorderError && { color: Colors.red }]}>
              {reorderError ??
                (swapping
                  ? 'Moviendo…'
                  : reorderFrom === null
                    ? 'Tocá la figurita que querés mover.'
                    : `#${String(reorderFrom).padStart(3, '0')} → tocá el casillero destino.`)}
            </Text>
          )}

          {stickers.length === 0 && isDraft ? (
            <View style={styles.emptyHero}>
              {/* Grilla fantasma 3×4 detrás — MUY sutil, sin interceptar taps.
                  Da la sensación de "hoja del álbum vacía esperando figus". */}
              <View pointerEvents="none" style={styles.emptyGhostGrid}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.emptyGhostCell,
                      { opacity: 0.18 - (Math.floor(i / 3) * 0.03) },
                    ]}
                  />
                ))}
              </View>

              {/* Contenido centrado por encima */}
              <View style={styles.emptyCenter}>
                {/* La burbuja es el CTA principal: antes era decorativa y el
                    "+" grande parecía tappable pero no hacía nada (confuso).
                    Ahora carga la primera figurita, igual que el botón de abajo. */}
                <Pressable
                  onPress={() => router.push(`/sticker/new?albumId=${album.id}`)}
                  style={({ pressed }) => [styles.emptyIconBubble, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Cargar la primera figurita"
                >
                  <Feather name="plus" size={44} color={Colors.paper} />
                </Pressable>
                <Text style={styles.emptyHeroTitle}>AÚN NO HAY{'\n'}FIGURITAS</Text>
                <Text style={styles.emptyHeroBody}>
                  Subí las imágenes y ponele número y nombre a cada una.
                  Sin figus, tus jugadores no pueden empezar.
                </Text>
                <View style={styles.emptyCtas}>
                  <Button
                    label="Cargar la primera"
                    onPress={() => router.push(`/sticker/new?albumId=${album.id}`)}
                  />
                  <Button
                    label="Carga masiva"
                    variant="outline"
                    onPress={() => setBulkUpload(true)}
                  />
                </View>
              </View>
            </View>
          ) : (
            <>
              <AlbumPager
                totalStickers={album.total_stickers}
                numberStart={numberStart}
                pageBgColor={(album as any).page_bg_color ?? DEFAULT_PAGE_COLOR}
                pageTexture={(album as any).page_texture ?? DEFAULT_PAGE_TEXTURE}
                pageCellAspect={(album as any).page_cell_aspect ?? DEFAULT_CELL_ASPECT}
                pageLayout={(album as any).page_layout ?? undefined}
                pageOverrides={((album as any).page_overrides ?? []) as PageOverride[]}
                onEditPage={(i) => {
                  setEditPagesInitial(i);
                  setEditingPages(true);
                }}
                renderCell={(n, cellStyle) => {
                  const s = stickerByNumber.get(n);
                  const selected = reorderMode && reorderFrom === n;
                  if (s) {
                    // El thin router en [id].tsx bifurca: owner+draft → editor,
                    // sino → vista grande. En modo reordenar el tap elige/mueve.
                    return (
                      <StickerCell
                        sticker={s}
                        style={[cellStyle, selected && styles.reorderSelected]}
                        onPress={
                          reorderMode
                            ? () => onReorderTap(n, true)
                            : () => router.push(`/sticker/${s.id}`)
                        }
                      />
                    );
                  }
                  return (
                    <StickerCellEmpty
                      number={n}
                      showPlus={isDraft && !reorderMode}
                      style={cellStyle}
                      onPress={
                        reorderMode
                          ? () => onReorderTap(n, false)
                          : isDraft
                            ? () => router.push(`/sticker/new?albumId=${album.id}&number=${n}`)
                            : undefined
                      }
                    />
                  );
                }}
              />
              {isDraft && stickers.length < album.total_stickers && (
                <View style={{ gap: Spacing.sm }}>
                  <Button
                    label={`Cargar otra (${stickers.length}/${album.total_stickers})`}
                    variant="outline"
                    onPress={() => router.push(`/sticker/new?albumId=${album.id}`)}
                  />
                  <Button
                    label="Carga masiva"
                    variant="outline"
                    onPress={() => setBulkUpload(true)}
                  />
                </View>
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
        // El total mínimo viene del número más alto ya cargado, mapeado a
        // cantidad según numberStart (número N ocupa el slot N - start + 1).
        minTotal={stickers.reduce((m, s) => Math.max(m, s.number - numberStart + 1), 1)}
        maxTotal={numberStart === 0 ? 1001 : isPro ? 1000 : 75}
        onClose={() => setEditingTotal(false)}
        onSave={onSaveTotal}
      />

      <EditAlbumNameModal
        visible={editingName}
        albumId={album.id}
        currentName={album.name}
        onClose={() => setEditingName(false)}
        onSaved={() => refetch()}
      />

      <DeleteAlbumModal
        visible={deletingAlbum}
        albumId={album.id}
        albumName={album.name}
        playerCount={playerCount}
        sessionEmail={session?.user.email ?? ''}
        onClose={() => setDeletingAlbum(false)}
        onDeleted={() => {
          setDeletingAlbum(false);
          // El álbum ya no existe: limpiar todo cache que lo liste y salir.
          qc.invalidateQueries({ queryKey: ['albums'] });
          qc.invalidateQueries({ queryKey: ['home-bundle'] });
          qc.invalidateQueries({ queryKey: ['packs-tab'] });
          router.replace('/(tabs)/album');
        }}
      />

      <QrPosterModal
        visible={showQr}
        albumId={album.id}
        albumName={album.name}
        onClose={() => setShowQr(false)}
      />

      <EditEconomyModal
        visible={editingEconomy}
        albumId={album.id}
        currentConfig={packConfig}
        currentTradeConfig={tradeConfig}
        isPro={isPro}
        onClose={() => setEditingEconomy(false)}
        onSaved={refetch}
      />

      <BulkStickerUploadModal
        visible={bulkUpload}
        albumId={album.id}
        totalStickers={album.total_stickers}
        numberStart={numberStart}
        occupiedNumbers={new Set(stickers.map((s) => s.number))}
        onClose={() => setBulkUpload(false)}
        onFinished={refetch}
      />

      <EditPagesModal
        visible={editingPages}
        initialPage={editPagesInitial}
        albumId={album.id}
        totalStickers={album.total_stickers}
        numberStart={numberStart}
        currentBgColor={(album as any).page_bg_color ?? DEFAULT_PAGE_COLOR}
        currentTexture={(album as any).page_texture ?? DEFAULT_PAGE_TEXTURE}
        currentCellAspect={(album as any).page_cell_aspect ?? DEFAULT_CELL_ASPECT}
        currentLayout={(album as any).page_layout ?? undefined}
        currentOverrides={((album as any).page_overrides ?? []) as PageOverride[]}
        onClose={() => setEditingPages(false)}
        onSaved={refetch}
      />

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        {/* Archivar/Desarchivar va ARRIBA del CTA principal, como link discreto.
            Si el device chrome corta algo, sacrificamos este antes que el CTA. */}
        <Pressable
          onPress={onArchivePress}
          disabled={archiving}
          hitSlop={8}
          style={({ pressed }) => [styles.archiveBtn, pressed && { opacity: 0.6 }]}
        >
          <Feather
            name={isArchived ? 'rotate-ccw' : 'archive'}
            size={13}
            color={Colors.muted}
          />
          <Text style={styles.archiveBtnText}>
            {archiving
              ? '...'
              : isArchived
                ? 'Desarchivar álbum'
                : 'Archivar álbum'}
          </Text>
        </Pressable>
        {/* Los álbumes especiales curados no se pueden eliminar (el server igual
            lo bloquea con P0201). */}
        {!isProtected && (
          <Pressable
            onPress={() => {
              // Refrescamos el conteo de jugadores para que el modal muestre el
              // copy correcto (retirar vs borrar).
              albumPlayerCount(album.id).then(({ data }) =>
                setPlayerCount(typeof data === 'number' ? data : 0),
              );
              setDeletingAlbum(true);
            }}
            hitSlop={8}
            style={({ pressed }) => [styles.archiveBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="trash-2" size={13} color={Colors.red} />
            <Text style={[styles.archiveBtnText, { color: Colors.red }]}>
              Eliminar álbum
            </Text>
          </Pressable>
        )}
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
            {publishError && <Text style={styles.publishError}>{publishError}</Text>}
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

// Descripción corta del config de economía actual, para el checklist y la
// sección de owner. Ej: "Sobre diario · 1 sobre · 5 figus" / "Solo QR · 3 sobres · 5 figus".
function economyDescription(cfg: PackConfig, trade?: TradeConfig): string {
  const mode = modeFromConfig(cfg);
  if (mode === 'none') return 'No configurado';
  const size = cfg.pack_size ?? 5;
  const weekly = cfg.daily.cooldown_hours >= 168;
  const dailyTxt = `${cfg.daily.count} sobre${cfg.daily.count > 1 ? 's' : ''} ${weekly ? 'sem.' : 'diario'}`;
  const qrTxt = `QR ${cfg.qr.count} sobre${cfg.qr.count > 1 ? 's' : ''}`;
  const head =
    mode === 'daily' ? dailyTxt :
    mode === 'qr' ? qrTxt :
    `${dailyTxt} + ${qrTxt}`;
  const welcomeCount = cfg.welcome?.enabled ? (cfg.welcome.count ?? 1) : 0;
  const welcomeTxt = welcomeCount > 0
    ? `Welcome ${welcomeCount}`
    : 'Sin welcome';
  const tradeTxt = trade
    ? !trade.enabled
      ? 'Cambios OFF'
      : trade.limit
        ? `${trade.limit.count}/${trade.limit.period === 'week' ? 'sem' : 'día'}`
        : 'Cambios libres'
    : '';
  const parts = [head, `${size} figus/sobre`, welcomeTxt];
  if (tradeTxt) parts.push(tradeTxt);
  return parts.join(' · ');
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
          {proFeatureHint(
            'Generá un QR para que jugadores escaneen y reciban sobres en eventos o espacios físicos.',
          )}
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
  // Fila de herramientas de edición debajo del contador de figuritas.
  toolsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  reorderHint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
  },
  reorderSelected: {
    borderColor: Colors.gold,
    borderWidth: 3,
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 4,
  },
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
  // Card "Jugar este álbum" — CTA para que el owner se joinee como jugador.
  playCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.cardLg,
    borderWidth: 2,
    borderColor: Colors.gold,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  playCardPressed: { opacity: 0.85 },
  playCardDisabled: { opacity: 0.6 },
  playIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  playSub: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    marginTop: 2,
  },
  economyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.cardLg,
    borderWidth: 2,
    borderColor: Colors.gold,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  economyCardWarn: {
    borderColor: Colors.red,
    backgroundColor: '#FFF6F4',
  },
  economyCardPressed: {
    opacity: 0.85,
  },
  economyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  economyIconWarn: {
    backgroundColor: Colors.red,
  },
  economyLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  economyValue: {
    fontFamily: FontFamily.display,
    fontSize: 20,
    color: Colors.ink,
    letterSpacing: 0.3,
    lineHeight: 24,
  },
  economyValueWarn: {
    color: Colors.red,
  },
  economyAction: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1,
    fontWeight: '700',
    marginTop: 6,
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
  linkText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.red,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    textDecorationLine: 'underline',
  },
  // Pill compacto pero notorio: chip blanco con borde + icono + label.
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  editPillPressed: {
    opacity: 0.7,
  },
  // Variante activa (modo reordenar encendido).
  editPillActive: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  editPillTextActive: {
    color: Colors.paper,
  },
  editPillText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.ink,
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
    position: 'relative',
    paddingVertical: Spacing.xl,
    minHeight: 420,
  },
  emptyGhostGrid: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.gridGap,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  emptyGhostCell: {
    width: '31.5%',
    aspectRatio: 0.82,
    backgroundColor: Colors.ink,
    borderRadius: Radius.cell,
  },
  emptyCenter: {
    alignItems: 'center',
    gap: Spacing.md,
    // Fondo con blur/tint que asegura la lectura del texto sobre la grilla.
    backgroundColor: 'rgba(251, 243, 226, 0.88)',
    borderRadius: Radius.cardLg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    marginHorizontal: Spacing.xs,
  },
  emptyIconBubble: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.redShadow,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 5,
    marginBottom: Spacing.xs,
  },
  emptyHeroTitle: {
    fontFamily: FontFamily.display,
    fontSize: 40,
    color: Colors.ink,
    textAlign: 'center',
    lineHeight: 42,
    letterSpacing: 1.5,
  },
  emptyHeroBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    textAlign: 'center',
    paddingHorizontal: Spacing.sm,
    lineHeight: 20,
  },
  emptyCtas: {
    width: '100%',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  gateHint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  publishError: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.red,
    textAlign: 'center',
    marginTop: Spacing.xs,
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
    bottom: 0,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
    backgroundColor: Colors.paper,
  },
  archiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.xs,
  },
  archiveBtnText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
});
