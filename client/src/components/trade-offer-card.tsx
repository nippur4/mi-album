import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
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

  // ¿La que recibo ya la tengo? Solo viene en las pending (fn_my_offer_flags);
  // null/undefined = desconocido (flags caídos, o cache viejo rehidratado) →
  // no mostramos nada en vez de mentir.
  const incomingQty = offer.status === 'pending' ? offer.incoming_qty : null;
  const showIncoming = typeof incomingQty === 'number';

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
          {showIncoming && <OwnedChip qty={incomingQty} />}
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
          {/* Hueco espejo del chip: la fila está centrada verticalmente, así
              que sin esto las dos minis quedan desalineadas. */}
          {showIncoming && <View style={styles.chipSlot} />}
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
        <>
          {/* El emisor (yo) agotó su tope de cambios: la contraparte no ve
              esta oferta hasta que la ventana ruede. Se puede cancelar igual. */}
          {offer.sender_blocked && (
            <View style={styles.blockedNote}>
              <Feather name="clock" size={13} color={Colors.amberWarn} />
              <Text style={styles.blockedNoteText}>
                Alcanzaste el máximo de cambios del período en este álbum.{' '}
                {otherName || 'La otra persona'} no va a ver esta oferta hasta que
                puedas hacer cambios de nuevo.
              </Text>
            </View>
          )}
          <View style={styles.actions}>
            <Button
              label={working === 'cancel' ? '...' : 'Cancelar oferta'}
              variant="outline"
              onPress={() => act('cancel')}
              disabled={working !== null}
              style={{ flex: 1 }}
            />
          </View>
        </>
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

// Chip bajo la figurita que RECIBÍS: te falta (verde, el cambio te suma) o ya
// la tenés (ámbar — es legal, pasa con "aceptar figuritas que ya tengo" o
// porque la conseguiste después de que te la ofrecieran, pero querés verlo).
function OwnedChip({ qty }: { qty: number }) {
  const owned = qty > 0;
  return (
    <View style={[styles.chipSlot, owned ? styles.chipOwned : styles.chipMissing]}>
      <Feather
        name={owned ? 'copy' : 'plus-circle'}
        size={10}
        color={owned ? Colors.amberWarn : Colors.greenTextSoft}
      />
      <Text style={[styles.chipText, { color: owned ? Colors.amberWarn : Colors.greenTextSoft }]}>
        {owned ? 'YA LA TENÉS' : 'TE FALTA'}
      </Text>
    </View>
  );
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
  // Alto fijo: la columna DAS renderiza este mismo slot vacío para que las dos
  // minis queden a la misma altura.
  chipSlot: {
    height: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 6,
    borderRadius: Radius.pill,
  },
  chipMissing: { backgroundColor: Colors.greenLight },
  chipOwned: { backgroundColor: Colors.amberWarnBg },
  chipText: {
    fontFamily: FontFamily.mono,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  blockedNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.amberWarnBg,
    borderRadius: Radius.card,
    padding: Spacing.sm,
  },
  blockedNoteText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
    lineHeight: 16,
  },
});
