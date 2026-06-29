import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, RarityFrame, Radius, Spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import {
  fetchNextUnopenedPack,
  openPack,
  pasteSticker,
  type OpenedSticker,
} from '@/lib/queries/packs';
import { r2Url } from '@/lib/storage';

type Phase = 'idle' | 'opening' | 'revealed';

export default function OpenPackScreen() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const router = useRouter();

  const [packId, setPackId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [stickers, setStickers] = useState<OpenedSticker[]>([]);
  const [pastingAll, setPastingAll] = useState(false);
  const [pasted, setPasted] = useState(false);

  // Cargar el próximo pack al entrar
  useEffect(() => {
    if (!albumId) return;
    fetchNextUnopenedPack(albumId).then((id) => {
      if (!id) {
        Alert.alert('No hay sobres', 'No tenés sobres sin abrir en este álbum.');
        router.back();
      } else {
        setPackId(id);
      }
    });
  }, [albumId, router]);

  // Animación del sobre temblando en idle
  const shake = useSharedValue(0);
  useEffect(() => {
    if (phase !== 'idle') return;
    // Tap → shake. Cuando entramos en idle inicia un breathing sutil
    shake.value = withRepeat(
      withSequence(
        withTiming(-2, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        withTiming(2, { duration: 600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [phase, shake]);

  const envelopeStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shake.value}deg` }],
  }));

  async function handleOpen() {
    if (!packId || phase !== 'idle') return;

    // Sacudida fuerte y luego open
    shake.value = withSequence(
      withTiming(-12, { duration: 80 }),
      withTiming(12, { duration: 80 }),
      withTiming(-10, { duration: 80 }),
      withTiming(10, { duration: 80 }),
      withTiming(0, { duration: 80 }),
    );

    setPhase('opening');
    try {
      const result = await openPack(packId);
      setStickers(result);
      setTimeout(() => setPhase('revealed'), 500);
    } catch (err: any) {
      Alert.alert('No se pudo abrir', errorMessage(err));
      setPhase('idle');
    }
  }

  async function handlePasteAll() {
    setPastingAll(true);
    const newOnes = stickers.filter((s) => s.was_new);
    const seen = new Set<string>();
    try {
      for (const s of newOnes) {
        if (seen.has(s.sticker_id)) continue;
        seen.add(s.sticker_id);
        await pasteSticker(s.sticker_id);
      }
      setPasted(true);
    } catch (err: any) {
      Alert.alert('Error', errorMessage(err));
    } finally {
      setPastingAll(false);
    }
  }

  async function handleOpenAnother() {
    if (!albumId) return;
    const nextId = await fetchNextUnopenedPack(albumId);
    if (!nextId) {
      router.back();
      return;
    }
    setPackId(nextId);
    setPhase('idle');
    setStickers([]);
    setPasted(false);
  }

  if (phase === 'revealed') {
    const newCount = stickers.filter((s) => s.was_new).length;
    const repeCount = stickers.length - newCount;
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title=" " back />
        <ScrollView contentContainerStyle={styles.revealScroll}>
          <Text style={styles.revealKicker}>¡{stickers.length} FIGURITAS!</Text>
          <Text style={styles.revealSub}>
            {newCount} nueva{newCount !== 1 ? 's' : ''} · {repeCount} repetida{repeCount !== 1 ? 's' : ''}
          </Text>

          <View style={styles.cardsGrid}>
            {stickers.map((s, i) => (
              <RevealedCard key={`${s.sticker_id}-${i}`} sticker={s} index={i} />
            ))}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {newCount > 0 && !pasted && (
            <Button
              label={pastingAll ? 'Pegando...' : `Pegar ${newCount} ${newCount === 1 ? 'nueva' : 'nuevas'}`}
              variant="gold"
              onPress={handlePasteAll}
              loading={pastingAll}
              disabled={pastingAll}
            />
          )}
          {pasted && <Text style={styles.pastedDone}>¡Listo, pegadas!</Text>}
          <Button label="Abrir otro sobre" onPress={handleOpenAnother} />
        </View>
      </SafeAreaView>
    );
  }

  // Estados idle + opening
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#3D2A1E', Colors.ink]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <ScreenHeader title=" " back />
      <View style={styles.idleBody}>
        <Text style={styles.idleKicker}>SOBRE DISPONIBLE</Text>
        <Pressable onPress={handleOpen} disabled={phase !== 'idle' || !packId}>
          <Animated.View style={[styles.envelope, envelopeStyle]}>
            <LinearGradient
              colors={[Colors.red, Colors.redDark]}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />
            <View style={styles.envelopeStripe} />
            <Text style={styles.envelopeBrand}>SOBRE</Text>
            <Text style={styles.envelopeSubBrand}>OFICIAL</Text>
            <Text style={styles.envelopeBig}>BESTIARIO</Text>
            <Text style={styles.envelopeFigs}>5 FIGURITAS</Text>
          </Animated.View>
        </Pressable>
        <View style={styles.idleHint}>
          <View style={styles.hintDot} />
          <Text style={styles.idleHintText}>
            {phase === 'opening' ? 'Abriendo...' : 'Tocá para abrir'}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Card revelada (con animación de entrada staggered)
// ---------------------------------------------------------------------------

function RevealedCard({ sticker, index }: { sticker: OpenedSticker; index: number }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(34);
  const scale = useSharedValue(0.6);
  // Pulso del halo dorado, solo activo si la figurita es nueva.
  const glow = useSharedValue(0);

  useEffect(() => {
    const delay = index * 110;
    opacity.value = withDelay(delay, withTiming(1, { duration: 350 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 550, easing: Easing.bezier(0.2, 1.3, 0.4, 1) }));
    scale.value = withDelay(delay, withTiming(1, { duration: 550, easing: Easing.bezier(0.2, 1.3, 0.4, 1) }));
    if (sticker.was_new) {
      glow.value = withDelay(
        delay + 200,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
            withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          true,
        ),
      );
    }
  }, [index, opacity, translateY, scale, glow, sticker.was_new]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  // Sombra dorada animada que respira alrededor de la card cuando es nueva.
  const haloStyle = useAnimatedStyle(() => {
    if (!sticker.was_new) return {};
    return {
      shadowOpacity: 0.4 + glow.value * 0.5,
      shadowRadius: 12 + glow.value * 18,
    };
  });

  const url = r2Url(sticker.large_key);
  const borderColor = sticker.was_new ? Colors.gold : RarityFrame[sticker.rarity];

  return (
    <Animated.View style={[styles.revealedCardWrap, animStyle]}>
      {sticker.was_new && <NewCardSparkles />}
      <Animated.View
        style={[
          styles.revealedCard,
          { borderColor },
          sticker.was_new && styles.revealedCardNew,
          haloStyle,
        ]}
      >
        <View style={[styles.rarityStrip, { backgroundColor: borderColor }]}>
          <Text style={styles.rarityStripText}>
            {sticker.rarity.toUpperCase()}
          </Text>
        </View>
        {url && (
          <Image source={{ uri: url }} style={styles.revealedImage} contentFit="cover" />
        )}
        <View style={styles.revealedFooter}>
          <Text style={styles.revealedNumber}>#{String(sticker.number).padStart(3, '0')}</Text>
          <Text style={styles.revealedName} numberOfLines={2}>{sticker.name}</Text>
        </View>
        <View style={[styles.ribbon, !sticker.was_new && styles.ribbonRepe]}>
          <Text style={[styles.ribbonText, !sticker.was_new && styles.ribbonTextRepe]}>
            {sticker.was_new ? 'NUEVA' : 'REPE'}
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// Sparkles flotando alrededor del card de figurita nueva. Cuatro estrellas
// con scale/opacity animados, delays distintos para que no parezcan sincronizadas.
const SPARKLE_POSITIONS = [
  { top: 6, left: -6 },
  { top: 30, right: -8 },
  { bottom: 50, left: -4 },
  { bottom: 18, right: -2 },
];

function NewCardSparkles() {
  return (
    <>
      {SPARKLE_POSITIONS.map((pos, i) => (
        <Sparkle key={i} delay={i * 280} position={pos} />
      ))}
    </>
  );
}

function Sparkle({ delay, position }: { delay: number; position: any }) {
  const s = useSharedValue(0);
  useEffect(() => {
    s.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 600, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false,
      ),
    );
  }, [delay, s]);
  const style = useAnimatedStyle(() => ({
    opacity: s.value,
    transform: [{ scale: 0.5 + s.value * 0.6 }],
  }));
  return (
    <Animated.View style={[styles.sparkle, position, style]} pointerEvents="none">
      <Text style={styles.sparkleText}>✦</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.ink },
  // --- Idle / opening ---
  idleBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    padding: Spacing.screenX,
  },
  idleKicker: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    color: Colors.gold,
    letterSpacing: 2.5,
    fontWeight: '700',
  },
  envelope: {
    width: 200,
    height: 270,
    borderRadius: Radius.cardLg,
    overflow: 'hidden',
    padding: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  envelopeStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 12,
    backgroundColor: Colors.gold,
  },
  envelopeBrand: {
    marginTop: Spacing.md,
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.gold,
    letterSpacing: 2,
    fontWeight: '700',
  },
  envelopeSubBrand: {
    fontFamily: FontFamily.mono,
    fontSize: 8,
    color: Colors.gold,
    letterSpacing: 2,
    opacity: 0.8,
  },
  envelopeBig: {
    fontFamily: FontFamily.display,
    fontSize: 30,
    color: Colors.gold,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
  envelopeFigs: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: '#FFFFFF',
    letterSpacing: 2,
    fontWeight: '700',
  },
  idleHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  hintDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.gold,
  },
  idleHintText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.paper,
  },
  // --- Reveal ---
  revealScroll: {
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.lg,
    paddingBottom: 200,
    gap: Spacing.lg,
  },
  revealKicker: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    color: Colors.paper,
    textAlign: 'center',
    letterSpacing: 1,
  },
  revealSub: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.bodySmall,
    color: Colors.gold,
    textAlign: 'center',
    letterSpacing: 1,
    fontWeight: '700',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  // Wrapper alrededor del card para alojar los sparkles fuera del borde
  // sin que queden clipeados por el overflow:hidden del card.
  revealedCardWrap: {
    width: 140,
    position: 'relative',
  },
  revealedCard: {
    width: 140,
    aspectRatio: 0.7,
    borderRadius: Radius.card,
    backgroundColor: Colors.paper,
    borderWidth: 3,
    overflow: 'hidden',
    paddingBottom: Spacing.sm,
  },
  revealedCardNew: {
    // Halo dorado pulsando (shadowOpacity/Radius animados desde JS).
    shadowColor: Colors.gold,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
  sparkle: {
    position: 'absolute',
    zIndex: 10,
  },
  sparkleText: {
    fontSize: 20,
    color: Colors.gold,
    textShadowColor: 'rgba(232,178,74,0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  rarityStrip: {
    paddingVertical: 3,
    alignItems: 'center',
  },
  rarityStripText: {
    fontFamily: FontFamily.mono,
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  revealedImage: {
    flex: 1,
    width: '100%',
  },
  revealedFooter: {
    paddingHorizontal: Spacing.sm,
    paddingTop: 4,
  },
  revealedNumber: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1,
    fontWeight: '700',
  },
  revealedName: {
    fontFamily: FontFamily.display,
    fontSize: 13,
    color: Colors.ink,
    lineHeight: 14,
  },
  ribbon: {
    position: 'absolute',
    top: 22,
    right: -8,
    paddingHorizontal: 10,
    paddingVertical: 2,
    backgroundColor: Colors.green,
    transform: [{ rotate: '12deg' }],
  },
  ribbonRepe: {
    backgroundColor: Colors.mutedWarm,
  },
  ribbonText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.greenTextDark,
    fontWeight: '800',
    letterSpacing: 1,
  },
  ribbonTextRepe: {
    color: '#FFFFFF',
  },
  footer: {
    position: 'absolute',
    left: Spacing.screenX,
    right: Spacing.screenX,
    bottom: Spacing.xl,
    gap: Spacing.sm,
  },
  pastedDone: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.green,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
});
