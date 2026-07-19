import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';

import { Countdown } from '@/components/countdown';
import { MediaThumb } from '@/components/media-thumb';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { claimDailyPack, type DailyPackStatus } from '@/lib/queries/daily';
import { errorMessage } from '@/lib/errors';
import { useState } from 'react';

// Shape mínimo de álbum que renderiza esta row. Aceptamos cualquier objeto
// con estos campos — el caller le pasa lo que tenga (un Album completo o
// el sub-shape del bundle del tab Sobres).
interface AlbumForRow {
  id: string;
  name: string;
  pack_thumb_key: string | null;
}

interface Props {
  album: AlbumForRow;
  // Status del daily para este álbum. Si no se pasa, no se renderiza nada
  // (el caller usa el hook batch y filtra antes de renderizar).
  status: DailyPackStatus;
  onClaimed?: () => void;
  // Sobre extra por publicidad (álbumes especiales, solo Android): pill gold
  // al lado del estado del daily. El caller resuelve elegibilidad con el
  // summary batch y maneja el flujo del rewarded ad.
  adAvailable?: boolean;
  adBusy?: boolean;
  onWatchAd?: () => void;
}

// Row del tab Sobres: muestra el daily de un álbum (ready / countdown / off).
// El status se inyecta por prop (batch fetch desde el caller, evita N+1).
export function DailyAlbumRow({ album, status, onClaimed, adAvailable, adBusy, onWatchAd }: Props) {
  const [claiming, setClaiming] = useState(false);

  if (!status.enabled) return null;

  async function onClaim() {
    setClaiming(true);
    const { error } = await claimDailyPack(album.id);
    setClaiming(false);
    if (error) {
      Alert.alert('No se pudo reclamar', errorMessage(error));
      return;
    }
    onClaimed?.();
  }

  const ready = status.canClaim;

  // Siempre Pressable (deshabilitado si no hay claim): un View con estilo-
  // función lo IGNORA y la fila perdía el flexDirection row — la foto, el
  // nombre y el botón quedaban apilados en columna.
  return (
    <Pressable
      onPress={ready ? onClaim : undefined}
      disabled={!ready || claiming}
      style={({ pressed }) => [styles.row, pressed && ready && styles.pressed]}
    >
      <MediaThumb
        mediaKey={album.pack_thumb_key}
        seed={album.name}
        width={42}
        aspect={3 / 4}
        borderRadius={8}
      />
      <View style={styles.center}>
        <Text style={styles.name} numberOfLines={1}>{album.name}</Text>
        {ready ? (
          <Text style={styles.subReady}>SOBRE DIARIO LISTO</Text>
        ) : status.nextAvailableAt ? (
          <View style={styles.cdRow}>
            <Text style={styles.cdLabel}>PRÓXIMO EN</Text>
            <Countdown target={status.nextAvailableAt} style={styles.cdValue} />
          </View>
        ) : (
          <Text style={styles.subDisabled}>—</Text>
        )}
      </View>
      <View style={styles.actionsCol}>
        {ready && (
          <View style={styles.action}>
            <Text style={styles.actionLabel}>{claiming ? '...' : 'Reclamar'}</Text>
          </View>
        )}
        {adAvailable && (
          // Pressable anidado: captura su propio tap, no dispara el claim
          // del row cuando el daily está listo.
          <Pressable
            onPress={onWatchAd}
            disabled={adBusy}
            hitSlop={6}
            style={({ pressed }) => [styles.adAction, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.adActionLabel}>{adBusy ? '...' : '▶ Publicidad'}</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  pressed: { opacity: 0.85 },
  center: { flex: 1, gap: 2 },
  name: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  subReady: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.green,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  subDisabled: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.muted,
  },
  cdRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  cdLabel: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.muted,
    letterSpacing: 1.5,
  },
  cdValue: {
    fontSize: 14,
  },
  actionsCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  action: {
    backgroundColor: Colors.green,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  // Más chica que la de Reclamar: convive con el countdown en la misma fila
  // y con el tamaño anterior lo tapaba.
  adAction: {
    backgroundColor: Colors.gold,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  adActionLabel: {
    fontFamily: FontFamily.body,
    fontSize: 11,
    fontWeight: '800',
    color: Colors.ink,
    letterSpacing: 0.3,
  },
  actionLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '800',
    color: Colors.greenTextDark,
    letterSpacing: 0.5,
  },
});
