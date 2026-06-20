import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Countdown } from '@/components/countdown';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { claimDailyPack, useDailyPackStatus } from '@/lib/queries/daily';
import { errorMessage } from '@/lib/errors';
import { useState } from 'react';
import type { Album } from '@/lib/queries/albums';

interface Props {
  album: Album;
  onClaimed?: () => void;
}

// Row del tab Sobres: muestra el daily de un álbum (ready / countdown / off).
export function DailyAlbumRow({ album, onClaimed }: Props) {
  const { status, refetch } = useDailyPackStatus(album.id);
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
    refetch();
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
      <Avatar source={album.name} />
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
