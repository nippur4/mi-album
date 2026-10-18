import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/button';
import { MediaBackground } from '@/components/media-background';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, RarityFrame, Radius, Spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import { albumNumberStart, useAlbumRow } from '@/lib/queries/albums';
import {
  fetchNextUnopenedPack,
  openPack,
  pasteSticker,
  type OpenedSticker,
} from '@/lib/queries/packs';
import { isPreset, r2Url, thumbFromLargeKey } from '@/lib/storage';
import { albumSfxTheme, initSfx, playSfx } from '@/lib/sfx';
import { padStickerNumber } from '@/lib/text';

type Phase = 'idle' | 'opening' | 'revealed';

// --- Timeline de la apertura (ms) -------------------------------------------
// La parte LOCAL (sacudida → luz por la boca + figuritas asomando) arranca con
// el tap y no espera a la red. El CLÍMAX (zoom + fogonazo + corte a la reveal)
// se dispara cuando llegan las figuritas, así el momento "wow" nunca cae en el
// vacío: si la red tarda, el sobre queda abierto esperando en vez de cortar
// antes de tiempo.
//
// Hubo una tapa que giraba hacia atrás entre la sacudida y las figuritas
// (2026-10-13): se descartó por decisión de diseño, no gustó ni el elemento ni
// el giro. Al sacarla la parte local se acortó —no tiene sentido dejar el
// hueco de 400ms— pero el tramo se sigue cubriendo con el sonido de rasgado.
const T_SHAKE = 280;   // sacudida fuerte
const T_CARDS = 380;   // las figuritas asoman por la boca
const T_PEEK_IN = 100; // aire entre el final de la sacudida y la salida
const T_LOCAL = T_SHAKE + T_PEEK_IN + T_CARDS; // ~760
// El clímax dura lo que el build-up de pack-open.wav (su impacto está a 300ms
// del inicio del archivo) para que el golpe caiga EXACTO con el fogonazo.
const T_SWELL = 300;
const T_FLASH = 180;

export default function OpenPackScreen() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  // El sobre muestra la imagen/preset de sobre del álbum y su nombre real.
  // useAlbumRow trae SOLO la fila del álbum (no los stickers) y reusa el cache
  // del detalle si ya existe — evita traer 1001 stickers para pintar un sobre.
  const { album } = useAlbumRow(albumId);
  // El sobre se muestra a ~200px: el thumb (512px) es de sobra y —clave— suele
  // estar YA cacheado (la vista del álbum y el tab Sobres renderizan el thumb),
  // así aparece instantáneo. El large (1200px) era una descarga fresca y lenta.
  const packKey = album?.pack_thumb_key ?? album?.pack_large_key;
  const hasPackMedia = !!packKey && (isPreset(packKey) || !!r2Url(packKey));
  const packSize = Number((album?.pack_config as any)?.pack_size ?? 5);
  // El álbum especial (number_start=0, 1001 figuritas) no muestra número ni
  // nombre en la reveal: son irrelevantes ahí y tapan la figurita. Sí la rareza.
  const hideCardLabels = !!album && albumNumberStart(album) === 0;
  const albumName = (album?.name ?? '').toUpperCase();
  // Anton grande solo si el nombre entra; nombres largos bajan de cuerpo.
  const nameSize = albumName.length <= 12 ? 30 : albumName.length <= 26 ? 22 : 17;

  // Sonidos temáticos por álbum (ej. rugidos en el álbum de dinosaurios).
  const sfxTheme = albumSfxTheme(albumId);

  const [packId, setPackId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [stickers, setStickers] = useState<OpenedSticker[]>([]);
  const [pastingAll, setPastingAll] = useState(false);
  const [pasted, setPasted] = useState(false);

  // Precargar los efectos de sonido al entrar (respetan el silencio del sistema).
  useEffect(() => { initSfx(); }, []);

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

  // --- Animación del sobre -------------------------------------------------
  const shake = useSharedValue(0);      // tilt: breathing en idle, sacudida al abrir
  const glow = useSharedValue(0);       // luz que se escapa por la boca
  const peek = useSharedValue(0);       // figuritas asomando desde adentro
  const zoom = useSharedValue(0);       // el sobre se viene encima en el clímax
  const flash = useSharedValue(0);      // fogonazo que tapa el corte a la reveal

  // Timers de la apertura: hay que poder cancelarlos si el open falla o si el
  // usuario se va de la pantalla a mitad de la animación.
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const resetOpenAnim = useCallback(() => {
    clearTimers();
    glow.value = 0;
    peek.value = 0;
    zoom.value = 0;
    flash.value = 0;
  }, [clearTimers, glow, peek, zoom, flash]);

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
    transform: [
      { rotate: `${shake.value}deg` },
      // Clímax: el sobre se eleva y se viene encima mientras se desvanece.
      { translateY: -26 * zoom.value },
      { scale: 1 + 0.5 * zoom.value },
    ],
    opacity: 1 - zoom.value * 0.9,
    // El aura dorada se intensifica a medida que se abre (iOS/web; en Android
    // la sombra no toma radius animado, el glow de abajo cubre el efecto).
    shadowOpacity: 0.5 + glow.value * 0.5,
    shadowRadius: 24 + glow.value * 26,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * (1 - zoom.value * 0.4),
    transform: [{ scaleY: 0.35 + glow.value * 0.75 }, { scaleX: 0.7 + glow.value * 0.45 }],
  }));

  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  async function handleOpen() {
    if (!packId || phase !== 'idle') return;

    // El primer sonido va dentro del gesto del tap: en web eso "desbloquea" el
    // audio del navegador.
    playSfx('shake', 0.6);

    // Sacudida fuerte...
    shake.value = withSequence(
      withTiming(-12, { duration: 70 }),
      withTiming(12, { duration: 70 }),
      withTiming(-9, { duration: 50 }),
      withTiming(9, { duration: 50 }),
      withTiming(0, { duration: 40 }),
    );
    // ...y arranca la apertura: luz por la boca + figuritas asomando.
    glow.value = withDelay(
      T_SHAKE,
      withTiming(1, { duration: T_CARDS + 120, easing: Easing.out(Easing.quad) }),
    );
    peek.value = withDelay(
      T_SHAKE + T_PEEK_IN,
      withTiming(1, { duration: T_CARDS, easing: Easing.out(Easing.cubic) }),
    );
    later(() => playSfx('tear', 0.85), T_SHAKE);

    setPhase('opening');
    const t0 = Date.now();
    try {
      const result = await openPack(packId);
      // Precargar los thumbs de las figuritas mientras corre la animación de
      // apertura (~1s), para que la reveal no tenga que esperar la descarga.
      // Muchas ya estarán en cache (grilla del álbum), esto cubre las nuevas.
      const urls = result
        .map((s) => r2Url(thumbFromLargeKey(s.large_key)))
        .filter((u): u is string => !!u);
      if (urls.length) Image.prefetch(urls).catch(() => {});
      // El contador de pendientes cambió (badge de la tab Sobres + listados)
      // y la colección del jugador recibió figuritas nuevas. También el
      // estado de sobres-por-ad, para que la card aparezca fresca al volver
      // al álbum (ej. tras abrir el último sobre del día).
      qc.invalidateQueries({ queryKey: ['packs-tab'] });
      qc.invalidateQueries({ queryKey: ['player-album', 'sidedata', albumId] });
      qc.invalidateQueries({ queryKey: ['ad-packs'] });
      // Logro "abriste N sobres": el conteo cambió.
      qc.invalidateQueries({ queryKey: ['achievements'] });

      // Clímax: espera a que termine la parte local (si la red fue más lenta,
      // arranca ya) y recién ahí el golpe de sonido + zoom + fogonazo.
      later(() => {
        // El "wow": build-up + impacto + shimmer. En el álbum de dinos, un
        // rugido encima le pone el tema.
        playSfx('open', sfxTheme === 'dino' ? 0.7 : 0.95);
        if (sfxTheme === 'dino') playSfx('dinoRoar', 0.95);
        zoom.value = withTiming(1, { duration: T_SWELL + T_FLASH, easing: Easing.in(Easing.quad) });
        flash.value = withDelay(T_SWELL, withTiming(1, { duration: T_FLASH }));
        later(() => {
          setStickers(result);
          setPhase('revealed');
        }, T_SWELL + T_FLASH);
      }, Math.max(0, T_LOCAL - (Date.now() - t0)));
    } catch (err: any) {
      resetOpenAnim();
      Alert.alert('No se pudo abrir', errorMessage(err));
      setPhase('idle');
    }
  }

  // Sonido escalonado al revelar: un pop por figurita (mismo timing que la
  // animación de entrada, index * 110ms), un chime para las nuevas rara+, y
  // una fanfarria única si salió una épica/legendaria nueva.
  useEffect(() => {
    if (phase !== 'revealed' || stickers.length === 0) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    stickers.forEach((s, i) => {
      timers.push(
        setTimeout(() => {
          playSfx('card', 0.5);
          if (s.was_new && s.rarity !== 'common') playSfx('sparkle', 0.55);
        }, i * 110),
      );
    });
    const hasBig = stickers.some(
      (s) => s.was_new && (s.rarity === 'epic' || s.rarity === 'legendary'),
    );
    if (hasBig) {
      // En el álbum de dinos la fanfarria es un chillido de pterosaurio.
      timers.push(
        setTimeout(
          () => playSfx(sfxTheme === 'dino' ? 'dinoScreech' : 'legendary', 0.9),
          stickers.length * 110 + 180,
        ),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [phase, stickers, sfxTheme]);

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
      playSfx('paste', 0.85);
      // Mismas invalidaciones que usePasteSticker: colección, progreso del
      // Home y avatares desbloqueables.
      qc.invalidateQueries({ queryKey: ['player-album', 'sidedata', albumId] });
      qc.invalidateQueries({ queryKey: ['albums', 'progress'] });
      qc.invalidateQueries({ queryKey: ['avatars', 'unlocks'] });
      // Pegar puede completar el álbum → logro de completado.
      qc.invalidateQueries({ queryKey: ['achievements'] });
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
    // Los shared values sobreviven al cambio de fase (es el mismo componente):
    // sin reset el sobre nuevo aparecería ya abierto y desvanecido.
    resetOpenAnim();
    setPackId(nextId);
    setPhase('idle');
    setStickers([]);
    setPasted(false);
  }

  if (phase === 'revealed') {
    const newCount = stickers.filter((s) => s.was_new).length;
    const repeCount = stickers.length - newCount;
    // Rareza máxima entre las NUEVAS: define el festejo extra (banner + burst
    // más denso). Las repes no cuentan: ya las tenías.
    const bigRarity = stickers.some((s) => s.was_new && s.rarity === 'legendary')
      ? 'legendary'
      : stickers.some((s) => s.was_new && s.rarity === 'epic')
        ? 'epic'
        : null;
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title=" " close tint="light" />
        <ScrollView
          contentContainerStyle={[styles.revealScroll, { paddingBottom: 200 + insets.bottom }]}
        >
          <RevealHeader
            count={stickers.length}
            newCount={newCount}
            repeCount={repeCount}
            big={bigRarity}
            bannerDelay={stickers.length * 110 + 220}
          />

          <View style={styles.cardsGrid}>
            {stickers.map((s, i) => (
              <RevealedCard
                key={`${s.sticker_id}-${i}`}
                sticker={s}
                index={i}
                hideLabels={hideCardLabels}
                // Vista grande de la figurita (misma que el álbum). push, no
                // replace: al volver la reveal sigue montada con su estado.
                onPress={() => router.push(`/sticker/${s.sticker_id}`)}
              />
            ))}
          </View>
        </ScrollView>

        <View
          // box-none: la caja del footer es transparente y en web se estira por
          // encima de las cartas de abajo; sin esto tragaba sus taps y no se
          // podía abrir la vista grande. Solo los botones capturan.
          pointerEvents="box-none"
          style={[
            styles.footer,
            // Arriba de la barra del sistema (gesture pill o 3 botones Android).
            { bottom: Math.max(insets.bottom + Spacing.sm, Spacing.xl) },
          ]}
        >
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

        {/* Festejo: esquirlas doradas saliendo del centro + el fogonazo que
            viene de la pantalla anterior desvaneciéndose (tapa el corte). */}
        <Burst big={!!bigRarity} />
        <RevealFlash />
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
          {/* Wrapper SIN overflow hidden: la luz y las figuritas asoman por
              arriba del borde del sobre. El sobre en sí sigue clipeando su
              media. */}
          <View style={styles.envelopeWrap}>
            {/* Luz que se escapa por la boca. Va primero (debajo de todo): lo
                que queda sobre el sobre lo tapa el sobre, lo que sale por
                arriba del borde se ve. */}
            <Animated.View style={[styles.mouthGlow, glowStyle]} pointerEvents="none">
              <LinearGradient
                colors={['rgba(255,245,214,0)', 'rgba(255,238,190,0.75)', 'rgba(232,178,74,0.95)']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />
            </Animated.View>
            {/* Las figuritas asomando: la parte de abajo queda detrás del sobre
                (va antes en el árbol y el sobre tiene elevation mayor). */}
            {PEEK_CARDS.map((p, i) => (
              <PeekCard key={i} progress={peek} zoom={zoom} spec={p} />
            ))}
            <Animated.View style={[styles.envelope, envelopeStyle]}>
              <MediaBackground
                mediaKey={packKey}
                fallback={
                  <LinearGradient
                    colors={[Colors.red, Colors.redDark]}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                  />
                }
              />
              {/* Scrim para que los textos se lean sobre foto/preset */}
              {hasPackMedia && (
                <LinearGradient
                  colors={['rgba(0,0,0,0.40)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.60)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0.5, y: 0 }}
                  end={{ x: 0.5, y: 1 }}
                />
              )}
              <View style={styles.envelopeStripe} />
              <Text style={styles.envelopeBrand}>SOBRE</Text>
              <Text style={styles.envelopeSubBrand}>OFICIAL</Text>
              <Text
                style={[styles.envelopeBig, { fontSize: nameSize, lineHeight: nameSize + 3 }]}
                numberOfLines={3}
              >
                {albumName}
              </Text>
              <Text style={styles.envelopeFigs}>
                {packSize} FIGURITA{packSize === 1 ? '' : 'S'}
              </Text>
            </Animated.View>
          </View>
        </Pressable>
        <View style={styles.idleHint}>
          <View style={styles.hintDot} />
          <Text style={styles.idleHintText}>
            {phase === 'opening' ? 'Abriendo...' : 'Tocá para abrir'}
          </Text>
        </View>
      </View>
      {/* Fogonazo que tapa el corte a la reveal (la reveal monta su propio
          fogonazo desvaneciéndose, así el cambio de pantalla no se ve). */}
      <Animated.View
        style={[styles.flash, flashStyle]}
        pointerEvents="none"
      />
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Figuritas asomando por la boca del sobre durante la apertura
// ---------------------------------------------------------------------------

// Abanico fijo (no random: así no cambia entre renders). dx/rot = posición
// final del abanico; delay escalona la salida.
const PEEK_CARDS = [
  { dx: -34, rot: -13, rise: 104, delay: 0.00 },
  { dx: 0, rot: 2, rise: 128, delay: 0.14 },
  { dx: 34, rot: 14, rise: 100, delay: 0.26 },
] as const;

function PeekCard({
  progress,
  zoom,
  spec,
}: {
  progress: { value: number };
  // El clímax: las figuritas se van con el sobre (mismo zoom + fade), si no
  // asomarían enteras al transparentarse el sobre.
  zoom: { value: number };
  spec: (typeof PEEK_CARDS)[number];
}) {
  const style = useAnimatedStyle(() => {
    // Reescalado del progreso para el delay propio de cada carta.
    const p = Math.max(0, Math.min(1, (progress.value - spec.delay) / (1 - spec.delay)));
    return {
      opacity: p > 0 ? 1 - zoom.value * 0.9 : 0,
      transform: [
        { translateY: -spec.rise * p - 26 * zoom.value },
        { translateX: spec.dx * p },
        { rotate: `${spec.rot * p}deg` },
        { scale: 1 + 0.5 * zoom.value },
      ],
    };
  });
  return (
    <Animated.View style={[styles.peekCard, style]} pointerEvents="none">
      <LinearGradient
        colors={[Colors.paper, Colors.paper3]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Festejo de la reveal: fogonazo, encabezado con rebote y esquirlas doradas
// ---------------------------------------------------------------------------

// Arranca en 1 (continúa el fogonazo de la pantalla de apertura) y se va.
function RevealFlash() {
  const v = useSharedValue(1);
  useEffect(() => {
    v.value = withTiming(0, { duration: 460, easing: Easing.out(Easing.quad) });
  }, [v]);
  const style = useAnimatedStyle(() => ({ opacity: v.value }));
  return <Animated.View style={[styles.flash, style]} pointerEvents="none" />;
}

function RevealHeader({
  count,
  newCount,
  repeCount,
  big,
  bannerDelay,
}: {
  count: number;
  newCount: number;
  repeCount: number;
  big: 'epic' | 'legendary' | null;
  bannerDelay: number;
}) {
  const pop = useSharedValue(0);
  const banner = useSharedValue(0);
  useEffect(() => {
    pop.value = withTiming(1, { duration: 480, easing: Easing.bezier(0.2, 1.6, 0.4, 1) });
    if (big) {
      banner.value = withDelay(
        bannerDelay,
        withTiming(1, { duration: 420, easing: Easing.bezier(0.2, 1.7, 0.4, 1) }),
      );
    }
  }, [pop, banner, big, bannerDelay]);

  const popStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.value * 2),
    transform: [{ scale: 0.72 + 0.28 * pop.value }],
  }));
  // Los bezier con rebote pasan de 1 a mitad de camino: clampeamos la opacidad.
  const bannerStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, banner.value),
    transform: [{ scale: 0.8 + 0.2 * banner.value }],
  }));

  return (
    <Animated.View style={[styles.revealHead, popStyle]}>
      <Text style={styles.revealKicker}>¡{count} FIGURITAS!</Text>
      <Text style={styles.revealSub}>
        {newCount} nueva{newCount !== 1 ? 's' : ''} · {repeCount} repetida{repeCount !== 1 ? 's' : ''}
      </Text>
      {big && (
        <Animated.View style={[styles.bigBanner, bannerStyle]}>
          <Text style={styles.bigBannerText}>
            ✦ ¡SALIÓ UNA {big === 'legendary' ? 'LEGENDARIA' : 'ÉPICA'}! ✦
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// Esquirlas doradas que salen disparadas del centro al revelar. Abanico fijo
// (sin random: estable entre renders) con largos alternados para que no quede
// una corona pareja.
const SHARDS = Array.from({ length: 18 }, (_, i) => ({
  deg: (360 / 18) * i + (i % 2 ? 8 : 0),
  dist: i % 3 === 0 ? 210 : i % 3 === 1 ? 155 : 112,
  w: i % 2 ? 4 : 6,
  h: i % 3 === 0 ? 20 : 13,
  gold: i % 4 !== 0,
}));

function Burst({ big }: { big: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: big ? 1100 : 850, easing: Easing.out(Easing.cubic) });
  }, [p, big]);
  // Con épica/legendaria nueva salen todas; si no, la mitad (festejo más sobrio).
  const shards = big ? SHARDS : SHARDS.filter((_, i) => i % 2 === 0);
  return (
    <View style={styles.burst} pointerEvents="none">
      {shards.map((s, i) => (
        <Shard key={i} spec={s} progress={p} big={big} />
      ))}
    </View>
  );
}

function Shard({
  spec,
  progress,
  big,
}: {
  spec: (typeof SHARDS)[number];
  progress: { value: number };
  big: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const v = progress.value;
    // Entra de golpe y se apaga en el último 70% del recorrido.
    const opacity = v < 0.12 ? v / 0.12 : Math.max(0, 1 - (v - 0.12) / 0.88);
    return {
      opacity,
      transform: [
        { rotate: `${spec.deg}deg` },
        { translateY: -spec.dist * (big ? 1.15 : 1) * v },
        { scale: 0.6 + 0.6 * (1 - v) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        styles.shard,
        {
          width: spec.w,
          height: spec.h,
          marginLeft: -spec.w / 2,
          backgroundColor: spec.gold ? Colors.gold : Colors.paper,
        },
        style,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Card revelada (con animación de entrada staggered)
// ---------------------------------------------------------------------------

function RevealedCard({
  sticker,
  index,
  hideLabels,
  onPress,
}: {
  sticker: OpenedSticker;
  index: number;
  hideLabels?: boolean;
  onPress?: () => void;
}) {
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

  // La card se ve a 140px: el thumb (512px) alcanza y suele estar cacheado por
  // la grilla del álbum. El large (1600px) por card era pesado y lento (×N).
  const url = r2Url(thumbFromLargeKey(sticker.large_key));
  const borderColor = sticker.was_new ? Colors.gold : RarityFrame[sticker.rarity];

  return (
    <Animated.View style={[styles.revealedCardWrap, animStyle]}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => pressed && { opacity: 0.85 }}
      >
      {/* Sparkles DENTRO del Pressable: en web son hermanos absolutos con
          pointerEvents que no siempre aplica; adentro, cualquier tap encima
          burbujea al onPress igual. */}
      {sticker.was_new && <NewCardSparkles />}
      <Animated.View
        style={[
          styles.revealedCard,
          { borderColor },
          sticker.was_new && styles.revealedCardNew,
          // Sin labels (álbum especial): la imagen llega hasta abajo, sin la
          // franja de fondo que dejaba el paddingBottom.
          hideLabels && styles.revealedCardFull,
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
        {!hideLabels && (
          <View style={styles.revealedFooter}>
            <Text style={styles.revealedNumber}>#{padStickerNumber(sticker.number)}</Text>
            <Text style={styles.revealedName} numberOfLines={2}>{sticker.name}</Text>
          </View>
        )}
        <View style={[styles.ribbon, !sticker.was_new && styles.ribbonRepe]}>
          <Text style={[styles.ribbonText, !sticker.was_new && styles.ribbonTextRepe]}>
            {sticker.was_new ? 'NUEVA' : 'REPE'}
          </Text>
        </View>
      </Animated.View>
      </Pressable>
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
  // Contenedor sin clipping: aloja la luz y las figuritas asomando, que salen
  // por arriba del borde del sobre. Mide exactamente lo que el sobre.
  envelopeWrap: {
    width: 200,
    height: 270,
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
  // Pluma de luz anclada en la boca del sobre: la mitad de abajo queda tapada
  // por el sobre, lo que sale por arriba del borde es lo que se ve.
  mouthGlow: {
    position: 'absolute',
    top: -70,
    left: -20,
    right: -20,
    height: 150,
    borderRadius: 75,
    overflow: 'hidden',
    transformOrigin: 'center bottom',
  },
  // Figurita asomando (dorso genérico: la de verdad se ve en la reveal).
  peekCard: {
    position: 'absolute',
    top: 46,
    left: 64,
    width: 72,
    height: 96,
    borderRadius: Radius.cell,
    borderWidth: 2,
    borderColor: Colors.gold,
    overflow: 'hidden',
  },
  flash: {
    position: 'absolute',
    top: -80,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFF6E0',
    zIndex: 20,
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
  revealHead: {
    gap: Spacing.sm,
    alignItems: 'center',
  },
  revealKicker: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    color: Colors.paper,
    textAlign: 'center',
    letterSpacing: 1,
  },
  bigBanner: {
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.gold,
    backgroundColor: 'rgba(232,178,74,0.16)',
  },
  bigBannerText: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    fontWeight: '800',
    color: Colors.gold,
    letterSpacing: 1.6,
  },
  // Capa del festejo: las esquirlas salen del centro del área de cartas.
  burst: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
  },
  shard: {
    position: 'absolute',
    top: 190,
    left: '50%',
    borderRadius: 3,
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
  // Álbum especial: sin footer de número/nombre, la imagen ocupa toda la card.
  revealedCardFull: {
    paddingBottom: 0,
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
