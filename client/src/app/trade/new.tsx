import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ScreenHeader } from '@/components/screen-header';
import { StickerMini } from '@/components/sticker-mini';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { createTradeOffer, useTradeLimitStatus } from '@/lib/queries/trades';
import { useDesktopCap } from '@/lib/use-is-desktop';
import { errorMessage } from '@/lib/errors';
import { useAlbumDetail } from '@/lib/queries/albums';
import { padStickerNumber } from '@/lib/text';

export default function NewTradeOfferScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const desktopCap = useDesktopCap(720);
  // toName lo manda Coincidencias, que ya tiene el nombre de la contraparte:
  // así no hace falta consultar el perfil de nuevo.
  const { albumId, toUser, offered, requested, toName } = useLocalSearchParams<{
    albumId: string;
    toUser: string;
    offered: string;
    requested: string;
    toName?: string;
  }>();

  const [submitting, setSubmitting] = useState(false);

  // Las dos figuritas salen del detalle del álbum, que SIEMPRE está cacheado
  // acá (a esta pantalla se llega desde Coincidencias, que usa el mismo hook,
  // y el detalle de un álbum publicado tiene staleTime Infinity). Antes esto
  // eran 3 queries sueltas sin cache (2 × select('*') de sticker + el perfil)
  // que salían cada vez que abrías "Ofrecer".
  const { stickers, isLoading } = useAlbumDetail(albumId);
  const offeredSticker = useMemo(
    () => stickers.find((s) => s.id === offered) ?? null,
    [stickers, offered],
  );
  const requestedSticker = useMemo(
    () => stickers.find((s) => s.id === requested) ?? null,
    [stickers, requested],
  );
  const toUserName = toName ?? '';

  const loading = isLoading && stickers.length === 0;
  // Ya cargó el álbum pero alguna figurita no está (link viejo / figurita
  // borrada): antes quedaba un spinner eterno.
  const notFound = !loading && (!offeredSticker || !requestedSticker);

  // Con el cupo de la ventana agotado no se pueden crear ofertas (el server
  // también lo rechaza con P0113 desde 0060; esto evita el viaje).
  const { status: tradeLimit } = useTradeLimitStatus(albumId);
  const limitReached =
    tradeLimit != null &&
    tradeLimit.enabled !== false &&
    !tradeLimit.unlimited &&
    (tradeLimit.remaining ?? 1) <= 0;

  async function onSubmit() {
    if (!albumId || !toUser || !offered || !requested) return;
    setSubmitting(true);
    const { error } = await createTradeOffer({
      album_id: albumId,
      to_user: toUser,
      offered_sticker_id: offered,
      requested_sticker_id: requested,
    });
    setSubmitting(false);
    if (error) {
      Alert.alert('No se pudo enviar', errorMessage(error));
      return;
    }
    Alert.alert('Oferta enviada', 'Te avisamos cuando responda.', [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={desktopCap}>
        <ScreenHeader
          title={`Proponer a ${toUserName || '...'}`}
          back
          right={<Avatar source={toUserName || 'Usuario'} size={28} />}
        />
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, desktopCap]}>
        {loading ? (
          <View style={styles.center}><ActivityIndicator color={Colors.red} /></View>
        ) : notFound ? (
          <EmptyState
            title="No encontramos las figuritas del cambio."
            body="Puede que la oferta ya no esté disponible. Volvé a Coincidencias y probá de nuevo."
          />
        ) : (
          <>
            {/* Vos das */}
            <View style={styles.card}>
              <Text style={[styles.label, { color: Colors.red }]}>VOS DAS</Text>
              <View style={styles.cardBody}>
                <StickerMini
                  thumbKey={offeredSticker!.thumb_key}
                  number={offeredSticker!.number}
                  name={offeredSticker!.name}
                  rarity={offeredSticker!.rarity}
                />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardStickerName}>{offeredSticker!.name.toUpperCase()}</Text>
                  <Text style={styles.cardStickerNumber}>#{padStickerNumber(offeredSticker!.number)}</Text>
                </View>
              </View>
            </View>

            {/* Swap icon */}
            <View style={styles.swapWrap}>
              <View style={styles.swapBig}>
                <Feather name="repeat" size={22} color={Colors.paper} />
              </View>
            </View>

            {/* Recibís */}
            <View style={[styles.card, styles.cardReceive]}>
              <Text style={[styles.label, { color: Colors.green }]}>RECIBÍS</Text>
              <View style={styles.cardBody}>
                <StickerMini
                  thumbKey={requestedSticker!.thumb_key}
                  number={requestedSticker!.number}
                  name={requestedSticker!.name}
                  rarity={requestedSticker!.rarity}
                />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardStickerName}>{requestedSticker!.name.toUpperCase()}</Text>
                  <Text style={styles.cardStickerNumber}>#{padStickerNumber(requestedSticker!.number)}</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          // Arriba de la barra del sistema (3 botones Android / pill de gestos).
          { paddingBottom: Math.max(insets.bottom + Spacing.sm, Spacing.xl) },
        ]}
      >
        <Button
          label={
            submitting
              ? 'Enviando...'
              : limitReached
                ? 'Límite de cambios alcanzado'
                : 'Enviar oferta'
          }
          onPress={onSubmit}
          disabled={loading || notFound || submitting || limitReached}
          loading={submitting}
        />
        <Text style={styles.fineprint}>
          {limitReached
            ? 'Ya usaste el máximo de cambios del período en este álbum. Vas a poder ofertar de nuevo cuando pase la ventana.'
            : 'La oferta queda pendiente hasta que la otra persona acepte o rechace.'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  center: { paddingTop: Spacing.xxl, alignItems: 'center' },
  scroll: {
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.md,
    paddingBottom: 220,
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cardReceive: {
    backgroundColor: Colors.greenLight,
    borderColor: Colors.green,
  },
  label: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardStickerName: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    color: Colors.ink,
    lineHeight: 22,
  },
  cardStickerNumber: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    color: Colors.muted,
    letterSpacing: 1.2,
    fontWeight: '700',
  },
  swapWrap: {
    alignItems: 'center',
    marginVertical: -8,
    zIndex: 1,
  },
  swapBig: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.paper,
  },
  footer: {
    paddingHorizontal: Spacing.screenX,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  fineprint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.muted,
    textAlign: 'center',
  },
});
