import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Feather } from '@expo/vector-icons';

import { AlbumPager } from '@/components/album-pager';
import { Button } from '@/components/button';
import { Countdown } from '@/components/countdown';
import { ProgressCard } from '@/components/progress-card';
import { ScreenHeader } from '@/components/screen-header';
import { StickerCell, StickerCellMissing } from '@/components/sticker-cell';
import { ToPasteCard } from '@/components/to-paste-card';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { useSession } from '@/lib/auth';
import { hideAlbumByPlayer, type Album, type Sticker } from '@/lib/queries/albums';
import { useAvailablePacksCount, useUserCollection } from '@/lib/queries/collection';
import { claimDailyPack, useDailyPackStatus } from '@/lib/queries/daily';
import { pasteSticker } from '@/lib/queries/packs';
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
  const { session } = useSession();
  const { collection, refetch: refetchCollection } = useUserCollection(album.id);
  const { count: packsCount, refetch: refetchPacks } = useAvailablePacksCount(album.id);
  const { status: daily, refetch: refetchDaily } = useDailyPackStatus(album.id);
  const [claiming, setClaiming] = useState(false);
  // Si el session pertenece al owner del álbum, mostramos link para volver
  // a la vista de gestión (Fase 10).
  const isOwnerViewing = session?.user.id === album.owner_id;

  // FIX: cuando volvemos de /pack/open o /trade/*, los hooks de esta pantalla
  // no se re-disparan solos (Expo Router conserva el componente en el stack).
  // Refetchamos todo al recuperar foco para reflejar las figuritas nuevas.
  useFocusEffect(
    useCallback(() => {
      refetchCollection();
      refetchPacks();
      refetchDaily();
    }, [refetchCollection, refetchPacks, refetchDaily]),
  );

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

  const [pastingId, setPastingId] = useState<string | null>(null);
  const [hiding, setHiding] = useState(false);

  function onHidePress() {
    Alert.alert(
      'Ocultar álbum',
      'Se va a esconder de tu Inicio y del tab Sobres. Tu progreso, figuritas y repes se conservan. Podés volver a mostrarlo desde el Inicio.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ocultar',
          style: 'destructive',
          onPress: async () => {
            setHiding(true);
            const { error } = await hideAlbumByPlayer(album.id);
            setHiding(false);
            if (error) {
              Alert.alert('No se pudo ocultar', errorMessage(error));
              return;
            }
            router.back();
          },
        },
      ],
    );
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
    refetchCollection();
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
  const isWelcome = myPastedCount === 0 && toPasteCount === 0 && collection.size === 0;

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
      <ScreenHeader
        title={album.name}
        back
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
      <ScrollView contentContainerStyle={styles.scroll}>
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

        {/* El álbum: solo pegadas + huecos. Las "por pegar" viven en la sección
            de abajo, no encima de la grilla. */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            EL ÁLBUM · {myPastedCount} / {album.total_stickers}
          </Text>
          <AlbumPager
            totalStickers={album.total_stickers}
            pageBgColor={(album as any).page_bg_color}
            pageTexture={(album as any).page_texture}
            pageOverrides={(album as any).page_overrides ?? []}
            renderCell={(n, cellStyle) => {
              const s = stickerByNumber.get(n);
              if (!s) return <StickerCellMissing number={n} style={cellStyle} />;
              const entry = collection.get(s.id);
              if (entry?.pasted) {
                return (
                  <StickerCell
                    sticker={s}
                    style={cellStyle}
                    extraCount={Math.max(0, entry.quantity - 1)}
                    onPress={() => router.push(`/sticker/${s.id}`)}
                  />
                );
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

        {(repesCount > 0 || missingCount > 0) && (
          <Button
            label="Ver cambios posibles"
            variant="outline"
            onPress={() => router.push(`/trade/matches?albumId=${album.id}`)}
          />
        )}

        {/* No mostramos "Ocultar" cuando el owner está en modo player: para él
            "ocultar" no aplica (siempre lo ve porque también es owner). */}
        {!isOwnerViewing && (
          <Pressable
            onPress={onHidePress}
            disabled={hiding}
            hitSlop={8}
            style={({ pressed }) => [styles.hideBtn, pressed && { opacity: 0.6 }]}
          >
            <Feather name="eye-off" size={13} color={Colors.muted} />
            <Text style={styles.hideBtnText}>
              {hiding ? '...' : 'Ocultar de mi álbum'}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* CTA inferior con 3 estados: sobres listos / daily disponible / countdown */}
      {packsCount > 0 ? (
        <Pressable
          onPress={() => router.push(`/pack/open?albumId=${album.id}`)}
          style={({ pressed }) => [
            styles.packsCta,
            { bottom: Math.max(insets.bottom, Spacing.md) },
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
      ) : daily.canClaim ? (
        <Pressable
          onPress={onClaimDaily}
          disabled={claiming}
          style={({ pressed }) => [
            styles.packsCta,
            { bottom: Math.max(insets.bottom, Spacing.md) },
            pressed && styles.packsCtaPressed,
          ]}
        >
          <Text style={styles.packsCtaLabel}>SOBRE DIARIO{'\n'}DISPONIBLE</Text>
          <View style={styles.packsCtaAction}>
            <Text style={styles.packsCtaActionText}>{claiming ? '...' : 'Reclamar'}</Text>
          </View>
        </Pressable>
      ) : daily.enabled && daily.nextAvailableAt ? (
        <View style={[styles.dailyCard, { bottom: Math.max(insets.bottom, Spacing.md) }]}>
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
    paddingBottom: 140,
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
