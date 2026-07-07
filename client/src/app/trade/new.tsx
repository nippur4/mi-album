import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { StickerMini } from '@/components/sticker-mini';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { createTradeOffer } from '@/lib/queries/trades';
import { useDesktopCap } from '@/lib/use-is-desktop';
import { errorMessage } from '@/lib/errors';
import type { Sticker } from '@/lib/queries/albums';

export default function NewTradeOfferScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const desktopCap = useDesktopCap(720);
  const { albumId, toUser, offered, requested } = useLocalSearchParams<{
    albumId: string;
    toUser: string;
    offered: string;
    requested: string;
  }>();

  const [offeredSticker, setOfferedSticker] = useState<Sticker | null>(null);
  const [requestedSticker, setRequestedSticker] = useState<Sticker | null>(null);
  const [toUserName, setToUserName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [o, r, u] = await Promise.all([
        supabase.from('stickers').select('*').eq('id', offered).maybeSingle(),
        supabase.from('stickers').select('*').eq('id', requested).maybeSingle(),
        supabase.from('profiles').select('display_name').eq('id', toUser).maybeSingle(),
      ]);
      setOfferedSticker((o.data ?? null) as Sticker | null);
      setRequestedSticker((r.data ?? null) as Sticker | null);
      setToUserName((u.data?.display_name as string) ?? '');
    })();
  }, [offered, requested, toUser]);

  const loading = !offeredSticker || !requestedSticker;

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
                  <Text style={styles.cardStickerNumber}>#{String(offeredSticker!.number).padStart(3, '0')}</Text>
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
                  <Text style={styles.cardStickerNumber}>#{String(requestedSticker!.number).padStart(3, '0')}</Text>
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
          label={submitting ? 'Enviando...' : 'Enviar oferta'}
          onPress={onSubmit}
          disabled={loading || submitting}
          loading={submitting}
        />
        <Text style={styles.fineprint}>
          La oferta queda pendiente hasta que la otra persona acepte o rechace.
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
