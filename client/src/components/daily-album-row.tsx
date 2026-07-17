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
}

// Row del tab Sobres: muestra el daily de un álbum (ready / countdown / off).
// El status se inyecta por prop (batch fetch desde el caller, evita N+1).
export function DailyAlbumRow({ album, status, onClaimed }: Props) {
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
  const Wrapper: any = ready ? Pressable : View;

  return (
    <Wrapper
      onPress={ready ? onClaim : undefined}
      disabled={!ready || claiming}
      style={({ pressed }: any) => [styles.row, pressed && styles.pressed]}
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
      {ready && (
        <View style={styles.action}>
          <Text style={styles.actionLabel}>{claiming ? '...' : 'Reclamar'}</Text>
        </View>
      )}
    </Wrapper>
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
  action: {
    backgroundColor: Colors.green,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  actionLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '800',
    color: Colors.greenTextDark,
    letterSpacing: 0.5,
  },
});
