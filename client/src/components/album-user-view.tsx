import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import Feather from '@expo/vector-icons/Feather';

import { AlbumPager } from '@/components/album-pager';
import { BottomSheet, sheetStyles } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Countdown } from '@/components/countdown';
import { FloatingPack } from '@/components/floating-pack';
import { PastedFlash } from '@/components/pasted-flash';
import { ProgressCard } from '@/components/progress-card';
import { ScreenHeader } from '@/components/screen-header';
import { StickerCell, StickerCellMissing } from '@/components/sticker-cell';
import { ToPasteCard } from '@/components/to-paste-card';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/auth';
import {
  albumNumberStart,
  hideAlbumByPlayer,
  joinAlbumByCode,
  useIsMember,
  type Album,
  type Sticker,
} from '@/lib/queries/albums';
import { claimDailyPack, setDailyMuted } from '@/lib/queries/daily';
import { claimAdPack, pasteSticker, useAdPackStatus } from '@/lib/queries/packs';
import { ADS_SUPPORTED, showRewardedAd } from '@/lib/rewarded-ad';
import { usePlayerAlbumSideData } from '@/lib/queries/player-album';
import { useDesktopCap, useIsDesktop } from '@/lib/use-is-desktop';
import { useFocusRefetchStale } from '@/lib/use-focus-refetch';
import { errorMessage } from '@/lib/errors';

interface Props {
  album: Album;
  stickers: Sticker[];
}

// Vista del usuario (no-owner) sobre un álbum donde se unió.
// Banner welcome + ProgressCard + grilla mixta (pegada / por pegar / missing)
// + CTA inferior con 3 estados (sobres listos / daily disponible / countdown).
export function UserAlbumView({ album, stickers }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  // Cap desktop en header + contenido (scroll full-bleed → barra en el borde
  // de la ventana). Los CTA flotantes se centran con floatDesktop.
  const desktopCap = useDesktopCap(760);
  const { session } = useSession();
  // Bundle: colección + sobres disponibles + estado del daily en 1 sola RPC.
  // Antes eran 3 hooks separados (3 round trips).
  const {
    collection,
    packsAvailable: packsCount,
    daily,
    dailyMuted,
    refetch: refetchSideData,
  } = usePlayerAlbumSideData(album.id);
  const [claiming, setClaiming] = useState(false);
  const [muting, setMuting] = useState(false);
  const qc = useQueryClient();

  // Sobre extra por publicidad: solo Android (rewarded ads = SDK nativo) y
  // solo en los álbumes especiales (el server decide con fn_ad_pack_status;
  // el tope de 2/día también lo valida el server al reclamar).
  const { adStatus, refetchAdStatus } = useAdPackStatus(album.id, ADS_SUPPORTED);
  const [adBusy, setAdBusy] = useState(false);

  async function onWatchAd() {
    if (adBusy) return;
    setAdBusy(true);
    try {
      const rewarded = await showRewardedAd();
      // Cerró el ad antes de terminar o no cargó: sin premio, sin error.
      if (!rewarded) return;
      const { error } = await claimAdPack(album.id);
      if (error) {
        Alert.alert('No se pudo', errorMessage(error));
        return;
      }
      // El sobre nuevo entra al bundle del álbum y al badge del tab Sobres;
      // el cupo del día baja también para el summary del tab.
      refetchSideData();
      refetchAdStatus();
      qc.invalidateQueries({ queryKey: ['ad-packs'] });
      qc.invalidateQueries({ queryKey: ['packs-tab'] });
    } finally {
      setAdBusy(false);
    }
  }

  async function onToggleMuted() {
    if (muting) return;
    setMuting(true);
    const { error } = await setDailyMuted(album.id, !dailyMuted);
    setMuting(false);
    if (error) {
      Alert.alert('No se pudo cambiar', errorMessage(error));
      return;
    }
    refetchSideData();
    // El tab Sobres (fila + badge) también cambia con el mute.
    qc.invalidateQueries({ queryKey: ['packs-tab'] });
  }
  // Si el session pertenece al owner del álbum, mostramos link para volver
  // a la vista de gestión (Fase 10).
  const isOwnerViewing = session?.user.id === album.owner_id;

  // Un no-miembro puede llegar acá navegando un álbum público desde el Home.
  // Ve el álbum como preview + CTA "Unirme" (fn_join_album via share_code,
  // legible por RLS en álbumes públicos). Hasta unirse no hay daily/pegar.
  const { isMember, isLoading: memberLoading, refetch: refetchMember } = useIsMember(album.id);
  const showJoinCta = !memberLoading && !isMember;
  const [joining, setJoining] = useState(false);
  const [joinFailed, setJoinFailed] = useState(false);

  async function onJoin() {
    if (joining) return;
    setJoining(true);
    setJoinFailed(false);
    const { error } = await joinAlbumByCode(album.share_code);
    setJoining(false);
    if (error) {
      // Inline (Alert es no-op en web): el CTA pasa a "Reintentar".
      setJoinFailed(true);
      return;
    }
    await Promise.all([refetchMember(), refetchSideData()]);
  }

  // Cuando volvemos de /pack/open o /trade/*, el hook no se re-dispara solo
  // (Expo Router conserva el componente en el stack). Refetch al recuperar
  // foco SOLO si está stale — abrir sobre / pegar / aceptar trade ya
  // invalidan el sidedata, así que esto es red de seguridad, no el mecanismo.
  useFocusRefetchStale(['player-album', 'sidedata', album.id]);
  // Ídem para el estado de sobres-por-ad: al volver de /pack/open (ej. tras
  // abrir el último sobre del día) la card de publicidad debe estar fresca
  // sin salir y volver a entrar.
  useFocusRefetchStale(['ad-packs']);

  async function onClaimDaily() {
    setClaiming(true);
    const { error } = await claimDailyPack(album.id);
    setClaiming(false);
    if (error) {
      Alert.alert('No se pudo reclamar', errorMessage(error));
      return;
    }
    refetchSideData();
  }

  const [pastingId, setPastingId] = useState<string | null>(null);
  // ID de la última figurita pegada — se limpia solo cuando PastedFlash
  // termina la animación (~800ms). Sirve para envolver la celda de la grilla
  // con el efecto snap sin acoplar el AlbumPager a la timeline.
  const [justPastedId, setJustPastedId] = useState<string | null>(null);
  const [hiding, setHiding] = useState(false);
  // Confirm de "salir del álbum" in-app (Alert.alert es no-op en web). Reusa
  // fn_hide_album_by_player: sale de las listas pero conserva el progreso y se
  // retoma al volver.
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  async function doLeave() {
    if (hiding) return;
    setLeaveError(null);
    setHiding(true);
    const { error } = await hideAlbumByPlayer(album.id);
    setHiding(false);
    if (error) {
      setLeaveError(errorMessage(error));
      return;
    }
    setConfirmingLeave(false);
    router.back();
  }

  async function onPaste(stickerId: string) {
    if (pastingId) return;
    setPastingId(stickerId);
    const { error } = await pasteSticker(stickerId);
    setPastingId(null);
    if (error) {
      Alert.alert('No se pudo pegar', errorMessage(error));
      return;
    }
    await refetchSideData();
    // Pegar cambia el progreso del Home y puede desbloquear un avatar
    // (mismas invalidaciones que usePasteSticker).
    qc.invalidateQueries({ queryKey: ['albums', 'progress'] });
    qc.invalidateQueries({ queryKey: ['avatars', 'unlocks'] });
    setJustPastedId(stickerId);
  }

  let myPastedCount = 0;
  let repesCount = 0;
  let toPasteCount = 0;
  for (const entry of collection.values()) {
    if (entry.pasted) myPastedCount += 1;
    else toPasteCount += 1;
    const extras = entry.quantity - 1;
    if (extras > 0) repesCount += extras;
  }
  const missingCount = album.total_stickers - myPastedCount - toPasteCount;
  // Solo miembros: un visitante con colección vacía NO es "recién unido".
  const isWelcome = isMember && myPastedCount === 0 && toPasteCount === 0 && collection.size === 0;
  // Completado = todas pegadas → no más daily (el server también lo gatea).
  const isCompleted = album.total_stickers > 0 && myPastedCount >= album.total_stickers;
  // El daily solo se ofrece si el jugador no lo silenció y no completó.
  const dailyActive = !dailyMuted && !isCompleted;
  // Sobre extra por publicidad (solo Android + álbumes especiales, con cupo).
  const showAdCta =
    isMember && ADS_SUPPORTED && !!adStatus?.enabled && (adStatus?.remaining ?? 0) > 0 && !isCompleted;

  const stickerByNumber = new Map<number, Sticker>(stickers.map((s) => [s.number, s]));

  // Listado de figuritas en el "bolsillo": cualquiera con stock disponible.
  // Incluye:
  //   - las que tiene sin pegar (pasted=false): la primera podría ir al álbum
  //   - las repes de las pegadas (pasted=true, quantity>1): solo para cambiar
  // El stock disponible es quantity - (pasted ? 1 : 0).
  const toPasteList = stickers
    .filter((s) => {
      const e = collection.get(s.id);
      if (!e) return false;
      const stock = e.quantity - (e.pasted ? 1 : 0);
      return stock > 0;
    })
    .sort((a, b) => a.number - b.number);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={desktopCap}>
        <ScreenHeader
          title={album.name}
          back
          home
          multiline
          right={
            isOwnerViewing ? (
              <Pressable
                onPress={() => router.replace(`/album/${album.id}`)}
                hitSlop={8}
                style={styles.configLink}
              >
                <Text style={styles.configLinkText}>Config</Text>
              </Pressable>
            ) : undefined
          }
        />
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, desktopCap]}>
        {isWelcome && (
          <View style={styles.welcomeBanner}>
            <View style={styles.welcomeText}>
              <Text style={styles.welcomeKicker}>¡TE UNISTE!</Text>
              <Text style={styles.welcomeTitle}>EMPEZÁ TU{'\n'}COLECCIÓN</Text>
            </View>
            <View style={styles.welcomePackWrap}>
              <FloatingPack packThumbKey={album.pack_thumb_key} size={92} />
            </View>
          </View>
        )}

        <ProgressCard
          current={myPastedCount}
          total={album.total_stickers}
          caption="PEGADAS"
          rightStat={`${repesCount} repetidas · ${missingCount} faltan`}
        />

        {/* El álbum: solo pegadas + huecos. Las "por pegar" viven en la sección
            de abajo, no encima de la grilla. */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            EL ÁLBUM · {myPastedCount} / {album.total_stickers}
          </Text>
          <AlbumPager
            totalStickers={album.total_stickers}
            numberStart={albumNumberStart(album)}
            pageBgColor={(album as any).page_bg_color}
            pageTexture={(album as any).page_texture}
            pageCellAspect={(album as any).page_cell_aspect ?? undefined}
            pageLayout={(album as any).page_layout ?? undefined}
            pageOverrides={(album as any).page_overrides ?? []}
            renderCell={(n, cellStyle) => {
              const s = stickerByNumber.get(n);
              if (!s) return <StickerCellMissing number={n} style={cellStyle} />;
              const entry = collection.get(s.id);
              if (entry?.pasted) {
                const cell = (
                  <StickerCell
                    sticker={s}
                    style={cellStyle}
                    onPress={() => router.push(`/sticker/${s.id}`)}
                  />
                );
                // Snap flash cuando esta figurita fue la última pegada.
                if (justPastedId === s.id) {
                  return (
                    <PastedFlash onDone={() => setJustPastedId(null)}>
                      {cell}
                    </PastedFlash>
                  );
                }
                return cell;
              }
              // No pegada todavía (sea que la tenga sin pegar o no la tenga):
              // se ve como silueta gris. La acción de pegar/cambiar vive en
              // la lista de abajo.
              return <StickerCellMissing number={n} style={cellStyle} />;
            }}
          />
        </View>

        {toPasteList.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              EN TU BOLSILLO · {toPasteList.length}
            </Text>
            <Text style={styles.sectionHint}>
              Pegá las que te faltan en el álbum o cambialas con otros jugadores.
            </Text>
            <View style={{ gap: Spacing.sm }}>
              {toPasteList.map((s) => {
                const entry = collection.get(s.id)!;
                const stock = entry.quantity - (entry.pasted ? 1 : 0);
                return (
                  <ToPasteCard
                    key={s.id}
                    sticker={s}
                    stock={stock}
                    canPaste={!entry.pasted}
                    busy={pastingId === s.id}
                    onPaste={() => onPaste(s.id)}
                    onTrade={() =>
                      router.push(`/trade/matches?albumId=${album.id}&stickerId=${s.id}`)
                    }
                    onPress={() => router.push(`/sticker/${s.id}`)}
                  />
                );
              })}
            </View>
          </View>
        )}

        {isMember && (repesCount > 0 || missingCount > 0) && (
          <Button
            label="Ver cambios posibles"
            variant="outline"
            onPress={() => router.push(`/trade/matches?albumId=${album.id}`)}
          />
        )}

        {/* Silenciar el sobre diario de este álbum. Solo tiene sentido si el
            álbum lo ofrece y el jugador no lo completó (completado ya corta
            solo). El estado real vive en membership.daily_muted. */}
        {isMember && daily.enabled && !isCompleted && (
          <Pressable
            onPress={onToggleMuted}
            disabled={muting}
            hitSlop={8}
            style={({ pressed }) => [styles.hideBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name={dailyMuted ? 'bell' : 'bell-off'} size={13} color={Colors.muted} />
            <Text style={styles.hideBtnText}>
              {muting ? '...' : dailyMuted ? 'Volver a recibir sobres' : 'Dejar de recibir sobres'}
            </Text>
          </Pressable>
        )}

        {/* No mostramos "Ocultar" cuando el owner está en modo player: para él
            "ocultar" no aplica (siempre lo ve porque también es owner). Los
            no-miembros tampoco lo ven (no hay membership que ocultar). */}
        {!isOwnerViewing && isMember && (
          <Pressable
            onPress={() => {
              setLeaveError(null);
              setConfirmingLeave(true);
            }}
            disabled={hiding}
            hitSlop={8}
            style={({ pressed }) => [styles.hideBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="log-out" size={13} color={Colors.muted} />
            <Text style={styles.hideBtnText}>
              {hiding ? '...' : 'Salir del álbum'}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <BottomSheet
        visible={confirmingLeave}
        onClose={() => setConfirmingLeave(false)}
        dismissable={!hiding}
        title="Salir del álbum"
      >
        <Text style={sheetStyles.hint}>
          Se saca de tu Inicio y del tab Sobres. Tu progreso, figuritas y repes se
          conservan: si volvés a entrar, retomás donde estabas.
        </Text>
        {leaveError && <Text style={sheetStyles.error}>{leaveError}</Text>}
        <View style={sheetStyles.actions}>
          <Button
            label="Cancelar"
            variant="outline"
            onPress={() => setConfirmingLeave(false)}
            disabled={hiding}
          />
          <Button
            label={hiding ? 'Saliendo...' : 'Salir del álbum'}
            onPress={doLeave}
            loading={hiding}
            disabled={hiding}
          />
        </View>
      </BottomSheet>

      {/* CTA inferior: unirse (no-miembro) / sobres listos / daily / countdown */}
      {/* Stack inferior: CTA principal según estado + (si aplica) la opción
          de sobre extra por publicidad, en la misma sección que el contador
          del diario. El stack es el que se posiciona absoluto; los CTAs
          adentro van en flujo (styles.inStack anula su position absolute). */}
      {(showJoinCta ||
        packsCount > 0 ||
        (dailyActive && daily.enabled) ||
        showAdCta) && (
        <View
          style={[
            styles.ctaStack,
            isDesktop && styles.floatDesktop,
            { bottom: Math.max(insets.bottom, Spacing.md) },
          ]}
        >
          {showJoinCta ? (
            <Pressable
              onPress={onJoin}
              disabled={joining}
              style={({ pressed }) => [
                styles.packsCta,
                styles.inStack,
                pressed && styles.packsCtaPressed,
              ]}
            >
              <Text style={styles.packsCtaLabel}>
                {joinFailed ? 'NO SE PUDO\nUNIRTE' : 'EMPEZÁ TU\nCOLECCIÓN'}
              </Text>
              <View style={styles.packsCtaAction}>
                <Text style={styles.packsCtaActionText}>
                  {joining ? '...' : joinFailed ? 'Reintentar' : 'Unirme'}
                </Text>
              </View>
            </Pressable>
          ) : packsCount > 0 ? (
            <Pressable
              onPress={() => router.push(`/pack/open?albumId=${album.id}`)}
              style={({ pressed }) => [
                styles.packsCta,
                styles.inStack,
                pressed && styles.packsCtaPressed,
              ]}
            >
              <Text style={styles.packsCtaLabel}>
                TENÉS {packsCount}{'\n'}SOBRE{packsCount > 1 ? 'S' : ''}
              </Text>
              <View style={styles.packsCtaAction}>
                <Text style={styles.packsCtaActionText}>Abrir</Text>
              </View>
            </Pressable>
          ) : dailyActive && daily.canClaim ? (
            <Pressable
              onPress={onClaimDaily}
              disabled={claiming}
              style={({ pressed }) => [
                styles.packsCta,
                styles.inStack,
                pressed && styles.packsCtaPressed,
              ]}
            >
              <Text style={styles.packsCtaLabel}>SOBRE DIARIO{'\n'}DISPONIBLE</Text>
              <View style={styles.packsCtaAction}>
                <Text style={styles.packsCtaActionText}>{claiming ? '...' : 'Reclamar'}</Text>
              </View>
            </Pressable>
          ) : dailyActive && daily.enabled && daily.nextAvailableAt ? (
            <View style={[styles.dailyCard, styles.inStack]}>
              <View style={styles.dailyCardLeft}>
                <Text style={styles.dailyCardKicker}>SOBRE DIARIO GRATIS</Text>
                <Text style={styles.dailyCardSub}>PRÓXIMO EN</Text>
              </View>
              <Countdown target={daily.nextAvailableAt} style={styles.dailyCountdown} />
            </View>
          ) : null}

          {/* Sobre extra por rewarded ad: solo Android + álbumes especiales,
              con cupo disponible (el server valida el tope de 2/día). */}
          {showAdCta && !showJoinCta && (
            <Pressable
              onPress={onWatchAd}
              disabled={adBusy}
              style={({ pressed }) => [styles.adCta, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.dailyCardLeft}>
                <Text style={styles.adCtaKicker}>SOBRE EXTRA</Text>
                <Text style={styles.dailyCardSub}>
                  {adBusy
                    ? 'CARGANDO PUBLICIDAD…'
                    : `VER PUBLICIDAD · ${adStatus?.remaining ?? 0} HOY`}
                </Text>
              </View>
              <Feather name="play-circle" size={24} color={Colors.gold} />
            </Pressable>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  configLink: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  configLinkText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.ink,
    fontWeight: '700',
    letterSpacing: 1,
  },
  scroll: {
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.md,
    // Aire para el stack inferior, que ahora puede apilar CTA + card de
    // publicidad (dos filas).
    paddingBottom: 210,
    gap: Spacing.xl,
  },
  section: { gap: Spacing.sm },
  sectionLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
  },
  sectionHint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
    marginBottom: Spacing.xs,
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
  welcomeBanner: {
    backgroundColor: Colors.red,
    borderRadius: Radius.cardLg,
    paddingVertical: Spacing.lg,
    paddingLeft: Spacing.lg,
    paddingRight: 0,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  welcomeText: {
    flex: 1,
    gap: Spacing.xs,
  },
  welcomePackWrap: {
    // El sobre se "asoma" del banner: levanta hacia arriba y sale por la derecha
    // para dar drama visual sin ocupar espacio adicional en el layout.
    width: 92,
    marginRight: -12,
    marginTop: -20,
    marginBottom: -20,
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
  // Desktop: los flotantes absolutos se centran y se capean al mismo ancho
  // que el contenido (760 menos el padding lateral). marginHorizontal 'auto'
  // funciona porque isDesktop implica web.
  floatDesktop: {
    left: 0,
    right: 0,
    width: '100%',
    maxWidth: 760 - Spacing.screenX * 2,
    marginHorizontal: 'auto',
  },
  // Contenedor absoluto del CTA inferior; los hijos van en flujo con gap.
  ctaStack: {
    position: 'absolute',
    left: Spacing.screenX,
    right: Spacing.screenX,
    gap: Spacing.sm,
  },
  // Anula el position absolute de packsCta/dailyCard cuando viven en el stack.
  inStack: {
    position: 'relative',
    left: 0,
    right: 0,
  },
  // Card de "sobre extra por publicidad": misma familia visual que dailyCard,
  // con acento gold para diferenciarla del diario gratis.
  adCta: {
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.gold,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adCtaKicker: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    color: Colors.goldDark,
    letterSpacing: 2,
    fontWeight: '800',
  },
  packsCta: {
    position: 'absolute',
    left: Spacing.screenX,
    right: Spacing.screenX,
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
  dailyCardLeft: { gap: 2 },
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
  dailyCountdown: { fontSize: 20 },
  hideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.md,
  },
  hideBtnText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
});
