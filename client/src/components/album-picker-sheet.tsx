// Sheet para elegir uno de mis álbumes (los que juego). Lo usa el botón
// "Proponer cambio" del tab Cambios: ahí no hay álbum en contexto, así que
// primero se elige y después se entra a Coincidencias de ese álbum.

import Feather from '@expo/vector-icons/Feather';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { EmptyState } from '@/components/empty-state';
import { MediaThumb } from '@/components/media-thumb';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';

// Shape mínimo que renderiza la lista — le sirve un HomeAlbum o cualquier
// objeto con estos campos.
export interface AlbumForPicker {
  id: string;
  name: string;
  cover_thumb_key: string | null;
  total_stickers?: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  albums: AlbumForPicker[];
  isLoading?: boolean;
  title?: string;
  emptyTitle?: string;
  emptyBody?: string;
  onSelect: (albumId: string) => void;
}

export function AlbumPickerSheet({
  visible,
  onClose,
  albums,
  isLoading,
  title = 'Elegí un álbum',
  emptyTitle = 'No estás jugando ningún álbum.',
  emptyBody = 'Unite a un álbum con un código o QR para empezar a cambiar figuritas.',
  onSelect,
}: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} maxHeight="85%">
      {isLoading && albums.length === 0 ? (
        <View style={styles.center}><ActivityIndicator color={Colors.red} /></View>
      ) : albums.length === 0 ? (
        <EmptyState title={emptyTitle} body={emptyBody} style={styles.empty} />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
          {albums.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => {
                // Cerramos primero: el Modal tiene que desmontarse antes de
                // navegar, si no queda el backdrop sobre la pantalla nueva.
                onClose();
                onSelect(a.id);
              }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
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
                {a.total_stickers != null && a.total_stickers > 0 && (
                  <Text style={styles.rowMeta}>{a.total_stickers} FIGURITAS</Text>
                )}
              </View>
              <Feather name="chevron-right" size={18} color={Colors.muted} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: '100%' },
  list: { gap: Spacing.sm, paddingBottom: Spacing.sm },
  center: { paddingVertical: Spacing.xl, alignItems: 'center' },
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
  // Dentro de un sheet el vacío no va al tope de la pantalla: menos aire
  // arriba que el default y simétrico. Explícito arriba/abajo porque en RN
  // paddingTop le gana a paddingVertical y el orden de las claves no importa.
  empty: { paddingTop: Spacing.xl, paddingBottom: Spacing.xl },
});
