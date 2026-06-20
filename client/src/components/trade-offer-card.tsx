import { Feather } from '@expo/vector-icons';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { StickerMini } from '@/components/sticker-mini';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { resolveTradeOffer, type TradeOffer } from '@/lib/queries/trades';
import { errorMessage } from '@/lib/errors';

interface Props {
  offer: TradeOffer;
  // 'received' = yo soy to_user (puedo Aceptar/Rechazar)
  // 'sent' = yo soy from_user (puedo Cancelar)
  side: 'received' | 'sent';
  onResolved?: () => void;
}

const STATUS_PALETTE: Record<TradeOffer['status'], { bg: string; fg: string; label: string }> = {
  pending:   { bg: Colors.amberWarnBg, fg: Colors.amberWarn, label: 'PENDIENTE' },
  accepted:  { bg: Colors.green, fg: Colors.greenTextDark, label: 'HECHO' },
  rejected:  { bg: Colors.paper3, fg: Colors.inkSoft, label: 'RECHAZADA' },
  cancelled: { bg: Colors.paper3, fg: Colors.muted, label: 'CANCELADA' },
  expired:   { bg: Colors.paper3, fg: Colors.muted, label: 'EXPIRADA' },
};

export function TradeOfferCard({ offer, side, onResolved }: Props) {
  const [working, setWorking] = useState<'accept' | 'reject' | 'cancel' | null>(null);
  const palette = STATUS_PALETTE[offer.status];

  const otherName = side === 'received' ? offer.from_user_name : offer.to_user_name;
  const otherSource = otherName || (side === 'received' ? 'Usuario' : 'Destino');

  // Lo que YO doy / lo que YO recibo (depende del lado).
  const iGive = side === 'received' ? offer.requested_sticker : offer.offered_sticker;
  const iGet = side === 'received' ? offer.offered_sticker : offer.requested_sticker;

  const isAccepted = offer.status === 'accepted';
  const isRejected = offer.status === 'rejected' || offer.status === 'cancelled' || offer.status === 'expired';

  async function act(action: 'accept' | 'reject' | 'cancel') {
    setWorking(action);
    const { error } = await resolveTradeOffer(offer.id, action);
    setWorking(null);
    if (error) {
      Alert.alert('No se pudo', errorMessage(error));
      return;
    }
    onResolved?.();
  }

  return (
    <View style={[styles.card, isAccepted && styles.cardAccepted, isRejected && styles.cardRejected]}>
      {/* Header: avatar + texto + pill */}
      <View style={styles.head}>
        <Avatar source={otherSource} size={36} />
        <View style={styles.headText}>
          <Text style={styles.headLine} numberOfLines={1}>
            {headlineFor(side, offer.status, otherName)}
          </Text>
          <Text style={styles.albumLine} numberOfLines={1}>{offer.album_name}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: palette.bg }]}>
          <Text style={[styles.pillText, { color: palette.fg }]}>{palette.label}</Text>
        </View>
      </View>

      {/* Cartas + swap */}
      <View style={styles.tradeRow}>
        <View style={styles.tradeCol}>
          <Text style={styles.tradeLabel}>RECIBÍS</Text>
          {iGet ? (
            <StickerMini
              thumbKey={iGet.thumb_key}
              number={iGet.number}
              name={iGet.name}
              rarity={iGet.rarity}
              size="sm"
            />
          ) : <Placeholder />}
        </View>
        <View style={styles.swap}>
          <Feather name="repeat" size={16} color={Colors.paper} />
        </View>
        <View style={styles.tradeCol}>
          <Text style={styles.tradeLabel}>DAS</Text>
          {iGive ? (
            <StickerMini
              thumbKey={iGive.thumb_key}
              number={iGive.number}
              name={iGive.name}
              rarity={iGive.rarity}
              size="sm"
            />
          ) : <Placeholder />}
        </View>
      </View>

      {/* Acciones */}
      {offer.status === 'pending' && side === 'received' && (
        <View style={styles.actions}>
          <Button
            label={working === 'reject' ? '...' : 'Rechazar'}
            variant="outline"
            onPress={() => act('reject')}
            disabled={working !== null}
            style={{ flex: 1 }}
          />
          <Button
            label={working === 'accept' ? '...' : 'Aceptar'}
            onPress={() => act('accept')}
            disabled={working !== null}
            loading={working === 'accept'}
            style={{ flex: 1 }}
          />
        </View>
      )}
      {offer.status === 'pending' && side === 'sent' && (
        <View style={styles.actions}>
          <Button
            label={working === 'cancel' ? '...' : 'Cancelar oferta'}
            variant="outline"
            onPress={() => act('cancel')}
            disabled={working !== null}
            style={{ flex: 1 }}
          />
        </View>
      )}
    </View>
  );
}

function headlineFor(side: 'received' | 'sent', status: TradeOffer['status'], name: string): string {
  if (side === 'received') {
    if (status === 'pending') return `${name} te ofrece`;
    if (status === 'accepted') return `Cambio con ${name} hecho`;
    if (status === 'rejected') return `Rechazaste a ${name}`;
    if (status === 'cancelled') return `${name} canceló la oferta`;
    return `Oferta de ${name} expirada`;
  }
  if (status === 'pending') return `Le ofreciste a ${name}`;
  if (status === 'accepted') return `${name} aceptó tu oferta`;
  if (status === 'rejected') return `${name} rechazó tu oferta`;
  if (status === 'cancelled') return `Cancelaste tu oferta`;
  return `Tu oferta a ${name} expiró`;
}

function Placeholder() {
  return <View style={styles.placeholder} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  cardAccepted: {
    backgroundColor: Colors.greenLight,
    borderColor: Colors.green,
  },
  cardRejected: {
    opacity: 0.72,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headText: {
    flex: 1,
  },
  headLine: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.ink,
  },
  albumLine: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 1,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  pillText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  tradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  tradeCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  tradeLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.muted,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  swap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: 64,
    height: 80,
    borderRadius: Radius.cell,
    backgroundColor: Colors.paper3,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
});
