// Sheet para que un owner FREE elija cuál de sus álbumes queda activo.
//
// Contexto: al vencer el Pro, los gates del server conservan el álbum publicado
// más viejo y pausan el resto (free = 1 álbum activo). Esa elección la hace el
// sistema solo, por un webhook, sin el owner presente — acá se la devolvemos.
// Ver migración 0084.
//
// Solo lista álbumes pausados POR LA BAJA (`read_only` sin `retired_at`) más el
// que está activo. Los que el owner cerró a mano se reactivan desarchivando,
// que es otro flujo: confundir los dos casos fue el bug de la 0080.

import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { MediaThumb } from '@/components/media-thumb';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import { setFreeActiveAlbum } from '@/lib/queries/albums';

export interface ActiveAlbumCandidate {
  id: string;
  name: string;
  cover_thumb_key: string | null;
  status: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  albums: ActiveAlbumCandidate[];
  // Se llama tras un cambio exitoso, para invalidar los listados.
  onChanged: () => void;
}

export function ActiveAlbumSheet({ visible, onClose, albums, onChanged }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onPick(albumId: string, isActive: boolean) {
    // Tocar el que ya está activo no hace nada: el server también lo trata como
    // no-op, pero ahorramos el round trip.
    if (isActive) {
      onClose();
      return;
    }
    setErr(null);
    setBusyId(albumId);
    const { error } = await setFreeActiveAlbum(albumId);
    setBusyId(null);
    if (error) {
      setErr(errorMessage(error));
      return;
    }
    onChanged();
    onClose();
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Elegí tu álbum activo" maxHeight="85%">
      <Text style={styles.intro}>
        Con el plan free podés tener un álbum activo a la vez. El que elijas vuelve a estar
        disponible para tus jugadores; el otro queda en pausa, sin perder nada.
      </Text>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
        {albums.map((a) => {
          const isActive = a.status === 'published';
          const busy = busyId === a.id;
          return (
            <Pressable
              key={a.id}
              disabled={!!busyId}
              onPress={() => onPick(a.id, isActive)}
              style={({ pressed }) => [
                styles.row,
                isActive && styles.rowActive,
                pressed && styles.pressed,
              ]}
            >
              <MediaThumb
                mediaKey={a.cover_thumb_key}
                seed={a.name}
                width={42}
                aspect={4 / 5}
                borderRadius={8}
              />
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>{a.name}</Text>
                <Text style={[styles.rowMeta, isActive && styles.rowMetaActive]}>
                  {isActive ? 'ACTIVO' : 'EN PAUSA'}
                </Text>
              </View>
              {busy ? (
                <ActivityIndicator color={Colors.red} />
              ) : (
                <Feather
                  name={isActive ? 'check-circle' : 'circle'}
                  size={20}
                  color={isActive ? Colors.green : Colors.muted}
                />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {err && <Text style={styles.error}>{err}</Text>}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    marginBottom: Spacing.md,
  },
  scroll: { maxHeight: '100%' },
  list: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  rowActive: { borderColor: Colors.green, borderWidth: 2 },
  pressed: { opacity: 0.85 },
  rowText: { flex: 1, gap: 2 },
  rowName: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  rowMeta: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  rowMetaActive: { color: Colors.green },
  error: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.red,
    marginTop: Spacing.sm,
  },
});
