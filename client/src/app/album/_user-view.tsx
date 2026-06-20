import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Countdown } from '@/components/countdown';
import { ProgressCard } from '@/components/progress-card';
import { ScreenHeader } from '@/components/screen-header';
import { StickerCell, StickerCellMissing } from '@/components/sticker-cell';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import type { Album, Sticker } from '@/lib/queries/albums';
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
  const { collection, refetch: refetchCollection } = useUserCollection(album.id);
  const { count: packsCount, refetch: refetchPacks } = useAvailablePacksCount(album.id);
  const { status: daily, refetch: refetchDaily } = useDailyPackStatus(album.id);
  const [claiming, setClaiming] = useState(false);

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
    if (entry.pasted) myPastedCount += 1;
    else toPasteCount += 1;
    const extras = entry.quantity - 1;
    if (extras > 0) repesCount += extras;
  }
  const missingCount = album.total_stickers - myPastedCount - toPasteCount;
  const isWelcome = myPastedCount === 0 && toPasteCount === 0 && collection.size === 0;

  const gridCells = Array.from({ length: album.total_stickers }, (_, i) => i + 1);
  const stickerByNumber = new Map<number, Sticker>(stickers.map((s) => [s.number, s]));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title={album.name} back multiline />
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
                return <View key={n} style={styles.gridCell}><StickerCellMissing number={n} /></View>;
              }
              const entry = collection.get(s.id);
              if (!entry) {
                return <View key={n} style={styles.gridCell}><StickerCellMissing number={n} /></View>;
              }
              if (entry.pasted) {
                return (
                  <View key={n} style={styles.gridCell}>
                    <StickerCell
                      sticker={s}
                      extraCount={Math.max(0, entry.quantity - 1)}
                      onPress={() => router.push(`/sticker/${s.id}`)}
                    />
                  </View>
                );
              }
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

      {/* CTA inferior con 3 estados: sobres listos / daily disponible / countdown */}
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
          <Text style={styles.packsCtaLabel}>SOBRE DIARIO{'\n'}DISPONIBLE</Text>
          <View style={styles.packsCtaAction}>
            <Text style={styles.packsCtaActionText}>{claiming ? '...' : 'Reclamar'}</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
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
});
