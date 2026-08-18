import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { StickerZoomModal } from '@/components/sticker-zoom-modal';
import { Colors, FontFamily, FontSize, RarityFrame, Radius, Spacing } from '@/constants/theme';
import { Alert } from '@/lib/alert';
import { errorMessage } from '@/lib/errors';
import type { Sticker } from '@/lib/queries/albums';
import { usePlayerAlbumSideData } from '@/lib/queries/player-album';
import { usePasteSticker } from '@/lib/queries/packs';
import { useAlbumStickerIndex } from '@/lib/queries/stickers';
import { useTradeLimitStatus } from '@/lib/queries/trades';
import { playSfx } from '@/lib/sfx';
import { r2Url } from '@/lib/storage';
import { useDesktopCap } from '@/lib/use-is-desktop';

interface Props {
  sticker: Sticker;
  albumName: string;
  albumTotal: number;
}

const RARITY_LABEL: Record<Sticker['rarity'], string> = {
  common: 'COMÚN',
  rare: 'RARA',
  epic: 'ÉPICA',
  legendary: 'LEGENDARIA',
};

// Vista grande de figurita (handoff pantalla 03). Carta foil centrada con
// gradient dorado para legendarias, sheen animado + bob vertical sutil.
// Botón "Proponer cambio" lleva a las coincidencias del álbum.
export function ViewStickerView({ sticker, albumName, albumTotal }: Props) {
  const router = useRouter();
  const desktopCap = useDesktopCap(560);
  // El bundle player devuelve collection + packs + daily. Acá solo usamos
  // collection, pero comparte cache con album-user-view — si el user viene
  // desde ahí, no hay round trip extra.
  const { collection } = usePlayerAlbumSideData(sticker.album_id);
  const { status: tradeLimit } = useTradeLimitStatus(sticker.album_id);
  const tradesDisabled = tradeLimit?.enabled === false;
  const entry = collection.get(sticker.id);
  const pasted = !!entry?.pasted;
  const quantity = entry?.quantity ?? 0;
  const owned = quantity > 0;
  const repesCount = Math.max(0, quantity - 1);

  // Pegar directo desde la vista grande cuando la tenés sin pegar. El hook
  // invalida el side data del álbum → al refetchar, `pasted` pasa a true y el
  // botón se reemplaza por el badge "✓ Pegada".
  const paste = usePasteSticker(sticker.album_id);
  async function handlePaste() {
    const { error } = await paste.mutateAsync(sticker.id);
    if (error) {
      Alert.alert('No se pudo pegar', errorMessage(error));
      return;
    }
    playPasteAnimation();
    playSfx('paste', 0.85);
  }

  const isLegendary = sticker.rarity === 'legendary';
  const borderColor = RarityFrame[sticker.rarity];
  const url = r2Url(sticker.large_key);

  const [zoomOpen, setZoomOpen] = useState(false);

  // Paginador prev/next: índice (id + number) del álbum, cacheado por react-query
  // → navegar entre figuritas ya no re-consulta la lista.
  const { index: siblings } = useAlbumStickerIndex(sticker.album_id);

  const currentIdx = siblings.findIndex((s) => s.id === sticker.id);
  const prev = currentIdx > 0 ? siblings[currentIdx - 1] : null;
  const next = currentIdx >= 0 && currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;
  // Position para mostrar "X / N", en base al orden por número.
  const positionText =
    currentIdx >= 0 ? `${currentIdx + 1} / ${siblings.length}` : `${sticker.number} / ${albumTotal}`;

  // Animaciones: bob vertical sutil + sheen lineal (solo legendarias)
  const bob = useSharedValue(0);
  const sheen = useSharedValue(-180);

  // Animación de "pegar": la carta hace un thunk (baja y rebota como si la
  // estamparas), un flash verde la recorre y un sello "¡PEGADA!" aparece y se
  // desvanece. Se dispara al confirmar el pegado (independiente del refetch).
  const stampScale = useSharedValue(1);
  const flash = useSharedValue(0);
  const sealOpacity = useSharedValue(0);
  const sealScale = useSharedValue(0.5);

  function playPasteAnimation() {
    stampScale.value = withSequence(
      withTiming(0.9, { duration: 90, easing: Easing.out(Easing.quad) }),
      withSpring(1, { damping: 6, stiffness: 180, mass: 0.7 }),
    );
    flash.value = withSequence(
      withTiming(1, { duration: 90 }),
      withTiming(0, { duration: 480, easing: Easing.out(Easing.quad) }),
    );
    sealScale.value = withSequence(
      withTiming(1.12, { duration: 180, easing: Easing.out(Easing.back(2)) }),
      withSpring(1, { damping: 7, stiffness: 150 }),
    );
    sealOpacity.value = withSequence(
      withTiming(1, { duration: 120 }),
      withDelay(900, withTiming(0, { duration: 350 })),
    );
  }

  useEffect(() => {
    bob.value = withRepeat(
      withSequence(
        withTiming(-9, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(9, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
    if (isLegendary) {
      sheen.value = withRepeat(
        withTiming(220, { duration: 3400, easing: Easing.linear }),
        -1,
        false,
      );
    }
  }, [isLegendary, bob, sheen]);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value }, { scale: stampScale.value }],
  }));
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sheen.value }, { rotate: '18deg' }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value * 0.55 }));
  const sealStyle = useAnimatedStyle(() => ({
    opacity: sealOpacity.value,
    transform: [{ scale: sealScale.value }, { rotate: '-12deg' }],
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* La carta tiene elevation 12 (sombra): en Android eso la dibuja sobre
          el header y tapa la X. El header tiene que ganar el stacking. */}
      <View style={[desktopCap, styles.headerWrap]}>
        <ScreenHeader
          title={`FIGURITA ${sticker.number} / ${albumTotal}`}
          close
          tint="light"
        />
      </View>

      <View style={[styles.body, desktopCap]}>
        {/* Carta foil */}
        <Animated.View style={[styles.card, { borderColor }, cardStyle]}>
          {/* Fondo: gradiente dorado para legendarias, sólido para el resto */}
          {isLegendary ? (
            <LinearGradient
              colors={[Colors.gold, Colors.goldDark, Colors.goldDarker]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: borderColor }]} />
          )}

          {/* Interior crema */}
          <View style={styles.inner}>
            <View style={styles.innerHeader}>
              <Text style={styles.innerNumber}>#{String(sticker.number).padStart(3, '0')}</Text>
              <View style={[styles.rarityBadge, { backgroundColor: borderColor }]}>
                <Text style={styles.rarityText}>{RARITY_LABEL[sticker.rarity]}</Text>
              </View>
            </View>

            <View style={styles.imageBox}>
              {/* Anti-spoiler: si no la tenés, no se ve la figurita — slot vacío. */}
              {owned && url ? (
                <Pressable style={StyleSheet.absoluteFill} onPress={() => setZoomOpen(true)}>
                  <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="contain" />
                  <View pointerEvents="none" style={styles.zoomHint}>
                    <Feather name="zoom-in" size={16} color={Colors.paper} />
                  </View>
                </Pressable>
              ) : (
                <View style={styles.lockedBox}>
                  <Feather name="lock" size={CARD_W * 0.16} color={Colors.muted} />
                  <Text style={styles.lockedText}>TE FALTA</Text>
                </View>
              )}
            </View>

            <Text style={styles.name} numberOfLines={2}>{owned ? sticker.name.toUpperCase() : '???'}</Text>
            <Text style={styles.albumName} numberOfLines={1}>{albumName}</Text>
          </View>

          {/* Sheen overlay (solo legendarias) */}
          {isLegendary && (
            <View pointerEvents="none" style={styles.sheenClip}>
              <Animated.View style={[styles.sheenBar, sheenStyle]}>
                <LinearGradient
                  colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ width: 50, height: '100%' }}
                />
              </Animated.View>
            </View>
          )}

          {/* Flash verde + sello "¡PEGADA!" (animación de pegar) */}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.pasteFlash, flashStyle]}
          />
          <View pointerEvents="none" style={styles.sealWrap}>
            <Animated.View style={[styles.seal, sealStyle]}>
              <Feather name="check" size={18} color={Colors.greenTextDark} />
              <Text style={styles.sealText}>¡PEGADA!</Text>
            </Animated.View>
          </View>
        </Animated.View>

        {/* Badges debajo */}
        <View style={styles.badgesRow}>
          {pasted ? (
            <View style={[styles.statusBadge, { backgroundColor: Colors.green }]}>
              <Text style={[styles.statusBadgeText, { color: Colors.greenTextDark }]}>✓ Pegada</Text>
            </View>
          ) : quantity > 0 ? (
            <View style={[styles.statusBadge, { backgroundColor: Colors.gold }]}>
              <Text style={[styles.statusBadgeText, { color: Colors.ink }]}>Sin pegar</Text>
            </View>
          ) : (
            <View style={[styles.statusBadge, { backgroundColor: Colors.paper3 }]}>
              <Text style={[styles.statusBadgeText, { color: Colors.inkSoft }]}>Te falta</Text>
            </View>
          )}
          {quantity > 0 && (
            <View style={[styles.statusBadge, { backgroundColor: Colors.paper2, borderWidth: 1, borderColor: Colors.border }]}>
              <Text style={[styles.statusBadgeText, { color: Colors.ink }]}>
                Tenés {quantity}{repesCount > 0 ? ` · ${repesCount} repe${repesCount > 1 ? 's' : ''}` : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.footer}>
        {/* Paginador: prev + posición + next. Muestra solo si sabemos la lista. */}
        {siblings.length > 1 && (
          <View style={styles.pager}>
            <Pressable
              onPress={() => prev && router.replace(`/sticker/${prev.id}`)}
              disabled={!prev}
              hitSlop={8}
              style={({ pressed }) => [
                styles.pagerBtn,
                pressed && styles.pagerBtnPressed,
                !prev && styles.pagerBtnDisabled,
              ]}
            >
              <Feather name="chevron-left" size={20} color={prev ? Colors.paper : Colors.muted} />
            </Pressable>
            <Text style={styles.pagerText}>{positionText}</Text>
            <Pressable
              onPress={() => next && router.replace(`/sticker/${next.id}`)}
              disabled={!next}
              hitSlop={8}
              style={({ pressed }) => [
                styles.pagerBtn,
                pressed && styles.pagerBtnPressed,
                !next && styles.pagerBtnDisabled,
              ]}
            >
              <Feather name="chevron-right" size={20} color={next ? Colors.paper : Colors.muted} />
            </Pressable>
          </View>
        )}

        {owned && !pasted && (
          <Button
            label="Pegar figurita"
            variant="gold"
            onPress={handlePaste}
            loading={paste.isPending}
          />
        )}
        <Button
          label={tradesDisabled ? 'Cambios desactivados' : 'Proponer cambio'}
          // give=<id>: Cambios abre en Coincidencias filtrando por esta figurita.
          onPress={() => router.push(`/trade/matches?albumId=${sticker.album_id}&give=${sticker.id}`)}
          disabled={tradesDisabled}
        />
        {tradesDisabled && (
          <Text style={styles.tradesOffHint}>
            El creador de este álbum tiene los cambios desactivados.
          </Text>
        )}
      </View>

      {owned && url && (
        <StickerZoomModal visible={zoomOpen} url={url} onClose={() => setZoomOpen(false)} />
      )}
    </SafeAreaView>
  );
}

const CARD_W = 378;
const CARD_H = CARD_W / 0.7;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.ink },
  headerWrap: {
    zIndex: 10,
    elevation: 24,
  },
  zoomHint: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tradesOffHint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.muted,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.screenX,
    gap: Spacing.xl,
  },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: Radius.cardLg,
    borderWidth: 3,
    overflow: 'hidden',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 12,
  },
  inner: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    bottom: 8,
    backgroundColor: Colors.paper,
    borderRadius: Radius.card,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  innerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  innerNumber: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  rarityText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  imageBox: {
    flex: 1,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.card,
    overflow: 'hidden',
  },
  lockedBox: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  lockedText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabel,
    color: Colors.muted,
    letterSpacing: 2,
    fontWeight: '700',
  },
  name: {
    fontFamily: FontFamily.display,
    fontSize: 24,
    color: Colors.ink,
    lineHeight: 26,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  albumName: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  pasteFlash: {
    backgroundColor: Colors.green,
    borderRadius: Radius.cardLg,
  },
  sealWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.green,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: Colors.greenTextDark,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  sealText: {
    fontFamily: FontFamily.display,
    fontSize: 20,
    color: Colors.greenTextDark,
    letterSpacing: 1,
  },
  sheenClip: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
    borderRadius: Radius.cardLg,
  },
  sheenBar: {
    position: 'absolute',
    top: -40,
    left: 0,
    bottom: -40,
    width: 50,
  },
  badgesRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  statusBadgeText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: Spacing.screenX,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  pagerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagerBtnPressed: { opacity: 0.6 },
  pagerBtnDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pagerText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.body,
    color: Colors.paper,
    fontWeight: '700',
    letterSpacing: 1.5,
    minWidth: 72,
    textAlign: 'center',
  },
});
