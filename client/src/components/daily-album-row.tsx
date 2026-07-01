import { Image } from 'expo-image';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Countdown } from '@/components/countdown';
import { PresetBackground } from '@/components/preset-background';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { claimDailyPack, type DailyPackStatus } from '@/lib/queries/daily';
import { errorMessage } from '@/lib/errors';
import { useMemo, useState } from 'react';
import type { Album } from '@/lib/queries/albums';
import { isPreset, presetIdFromKey, r2Url } from '@/lib/storage';

interface Props {
  album: Album;
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
      <PackThumb album={album} />
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

// Miniatura del sobre en 3:4 (mismo aspect que se le pide al owner cargar).
// Puede ser preset (gradient) o imagen R2. Si no hay pack_thumb_key, cae en
// un bloque de color hasheado con la inicial — así el jugador identifica el
// álbum aunque el owner todavía no haya subido el sobre.
const PACK_FALLBACK_PALETTE = [
  Colors.red, '#5B8DEF', '#7FB83E', Colors.gold,
  '#3FB6A8', '#B36BD4', '#EE6FA0', '#F2A03D',
];
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function PackThumb({ album }: { album: Album }) {
  const key = album.pack_thumb_key;
  const bg = useMemo(
    () => PACK_FALLBACK_PALETTE[hashStr(album.name) % PACK_FALLBACK_PALETTE.length],
    [album.name],
  );
  const initial = (album.name.trim()[0] ?? '?').toUpperCase();
  if (key && isPreset(key)) {
    return (
      <View style={styles.packThumb}>
        <PresetBackground id={presetIdFromKey(key)} />
      </View>
    );
  }
  const url = r2Url(key);
  if (url) {
    return (
      <View style={styles.packThumb}>
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      </View>
    );
  }
  return (
    <View style={[styles.packThumb, { backgroundColor: bg }]}>
      <Text style={styles.packThumbFallbackText}>{initial}</Text>
    </View>
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
  packThumb: {
    width: 42,
    height: 56, // 3:4
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.paper3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  packThumbFallbackText: {
    fontFamily: FontFamily.display,
    fontSize: 24,
    color: Colors.paper,
    letterSpacing: 1,
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
