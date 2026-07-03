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
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, RarityFrame, Radius, Spacing } from '@/constants/theme';
import type { Sticker } from '@/lib/queries/albums';
import { useUserCollection } from '@/lib/queries/collection';
import { r2Url } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

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
  const { collection } = useUserCollection(sticker.album_id);
  const entry = collection.get(sticker.id);
  const pasted = !!entry?.pasted;
  const quantity = entry?.quantity ?? 0;
  const repesCount = Math.max(0, quantity - 1);

  const isLegendary = sticker.rarity === 'legendary';
  const borderColor = RarityFrame[sticker.rarity];
  const url = r2Url(sticker.large_key);

  // Paginador: cargamos id + number de TODAS las figuritas del álbum para
  // saber cuál es la previa y la siguiente. La consulta es liviana (solo 2
  // campos) y se cachea a nivel de componente porque la vista se recrea al
  // navegar entre figuritas (el `id` del route cambia y expo-router monta
  // un componente nuevo — ver useEffect abajo).
  const [siblings, setSiblings] = useState<Array<{ id: string; number: number }>>([]);
  useEffect(() => {
    supabase
      .from('stickers')
      .select('id, number')
      .eq('album_id', sticker.album_id)
      .order('number', { ascending: true })
      .then(({ data }) => setSiblings((data ?? []) as Array<{ id: string; number: number }>));
  }, [sticker.album_id]);

  const currentIdx = siblings.findIndex((s) => s.id === sticker.id);
  const prev = currentIdx > 0 ? siblings[currentIdx - 1] : null;
  const next = currentIdx >= 0 && currentIdx < siblings.length - 1 ? siblings[currentIdx + 1] : null;
  // Position para mostrar "X / N", en base al orden por número.
  const positionText =
    currentIdx >= 0 ? `${currentIdx + 1} / ${siblings.length}` : `${sticker.number} / ${albumTotal}`;

  // Animaciones: bob vertical sutil + sheen lineal (solo legendarias)
  const bob = useSharedValue(0);
  const sheen = useSharedValue(-180);

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
    transform: [{ translateY: bob.value }],
  }));
  const sheenStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sheen.value }, { rotate: '18deg' }],
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScreenHeader
        title={`FIGURITA ${sticker.number} / ${albumTotal}`}
        back
      />

      <View style={styles.body}>
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
              {url && (
                <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="contain" />
              )}
            </View>

            <Text style={styles.name} numberOfLines={2}>{sticker.name.toUpperCase()}</Text>
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

        <Button
          label="Proponer cambio"
          onPress={() => router.push(`/trade/matches?albumId=${sticker.album_id}`)}
        />
      </View>
    </SafeAreaView>
  );
}

const CARD_W = 240;
const CARD_H = CARD_W / 0.7;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.ink },
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
  sheenClip: {
    ...StyleSheet.absoluteFillObject,
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
