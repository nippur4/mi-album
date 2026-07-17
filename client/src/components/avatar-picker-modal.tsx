import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BottomSheet } from '@/components/bottom-sheet';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useActivePresets, useAvatarUnlocks } from '@/lib/queries/presets';
import { r2Url } from '@/lib/storage';

interface Props {
  visible: boolean;
  currentName: string;          // para previewear el avatar default con iniciales
  currentThumbKey: string | null;
  onClose: () => void;
  onSelect: (thumbKey: string | null) => void;  // null = volver al default
}

// Picker de avatar para el perfil. Solo lista plantillas admin de kind='avatar';
// los users NO pueden subir imágenes propias. La primera opción es "Por defecto"
// (iniciales + color hash, mismo render que el avatar sin imagen).
//
// Desbloqueo (migración 0035): sort_order del preset = número de avatar.
// Los libres (free) los tiene todo el mundo; el resto se desbloquea pegando
// la figurita de ese número en el álbum de avatares. Los bloqueados se ven
// atenuados con candado; el gate real está server-side en fn_update_avatar.
export function AvatarPickerModal({ visible, currentName, currentThumbKey, onClose, onSelect }: Props) {
  const { items, isLoading: presetsLoading } = useActivePresets('avatar');
  const { unlocks, isLoading: unlocksLoading, isError: unlocksError } = useAvatarUnlocks(visible);
  const [lockHint, setLockHint] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setLockHint(null);
  }, [visible]);

  // Los unlocks NO bloquean el render de la grilla: si fallan o tardan,
  // mostramos los avatares numerados como bloqueados y una nota de error.
  const isLoading = presetsLoading;

  // Sin data de unlocks tratamos los numerados como bloqueados (no al revés):
  // el server rechazaría igual, mejor no invitar al tap.
  function isLocked(sortOrder: number): boolean {
    if (sortOrder < 1) return false;
    if (!unlocks) return true;
    return !unlocks.free.includes(sortOrder) && !unlocks.unlocked.includes(sortOrder);
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Elegí tu avatar" maxHeight="85%">
      {lockHint ? (
        <View style={styles.hintRow}>
          <Feather name="lock" size={13} color={Colors.inkSoft} />
          <Text style={styles.hintText}>{lockHint}</Text>
        </View>
      ) : unlocksError ? (
        <View style={styles.hintRow}>
          <Feather name="alert-circle" size={13} color={Colors.red} />
          <Text style={styles.hintText}>
            No pudimos cargar tus desbloqueos — los avatares numerados aparecen
            bloqueados por ahora.
          </Text>
        </View>
      ) : unlocks?.albumName ? (
        <Text style={styles.unlockNote}>
          Desbloqueá más avatares pegando figuritas en {unlocks.albumName}.
        </Text>
      ) : null}

      <ScrollView style={styles.scroll}>
        <View style={styles.grid}>
          {/* Default = iniciales+color hash */}
          <Pressable
            style={styles.tile}
            onPress={() => { onSelect(null); onClose(); }}
          >
            <Avatar source={currentName || 'Vos'} size={80} />
            <Text style={styles.tileLabel}>Por defecto</Text>
            {currentThumbKey === null && (
              <View style={styles.check}><Feather name="check" size={14} color={Colors.paper} /></View>
            )}
          </Pressable>

          {isLoading ? (
            <View style={styles.loadingTile}><ActivityIndicator color={Colors.red} /></View>
          ) : (
            items.map((p) => {
              const url = r2Url(p.thumb_key);
              const selected = p.thumb_key === currentThumbKey;
              const locked = isLocked(p.sort_order);
              return (
                <Pressable
                  key={p.id}
                  style={styles.tile}
                  onPress={() => {
                    if (locked) {
                      setLockHint(
                        `Pegá la figurita #${String(p.sort_order).padStart(2, '0')}` +
                          (unlocks?.albumName ? ` de ${unlocks.albumName}` : '') +
                          ' para desbloquear este avatar.',
                      );
                      return;
                    }
                    onSelect(p.thumb_key);
                    onClose();
                  }}
                >
                  {locked ? (
                    // Sin spoiler: ni la imagen ni el nombre del avatar
                    // bloqueado — solo el candado y el número a conseguir.
                    <View style={styles.lockedTile}>
                      <Feather name="lock" size={22} color={Colors.muted} />
                    </View>
                  ) : (
                    url && (
                      <Image
                        source={{ uri: url }}
                        style={styles.tileImage}
                        contentFit="cover"
                      />
                    )
                  )}
                  <Text
                    style={[styles.tileLabel, locked && styles.tileLabelLocked]}
                    numberOfLines={1}
                  >
                    {locked ? `#${String(p.sort_order).padStart(2, '0')}` : p.name}
                  </Text>
                  {selected && (
                    <View style={styles.check}><Feather name="check" size={14} color={Colors.paper} /></View>
                  )}
                </Pressable>
              );
            })
          )}
        </View>

        {!isLoading && items.length === 0 && (
          <Text style={styles.emptyText}>
            Todavía no hay avatares para elegir. Volvé más adelante.
          </Text>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const TILE = 92;

const styles = StyleSheet.create({
  // flexShrink (no maxHeight '100%'): con maxHeight el ScrollView tomaba el
  // alto de su CONTENIDO (el % no resolvía contra el sheet) y en web mobile
  // quedaba clipeado sin poder scrollear. Mismo patrón que los otros modales.
  scroll: { flexShrink: 1 },
  unlockNote: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.muted,
    marginBottom: Spacing.md,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  hintText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    justifyContent: 'flex-start',
  },
  tile: {
    width: TILE,
    alignItems: 'center',
    gap: Spacing.xs,
    position: 'relative',
  },
  tileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.paper3,
  },
  // Placeholder de avatar bloqueado: círculo neutro con candado, sin imagen.
  lockedTile: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.paper3,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
    textAlign: 'center',
  },
  tileLabelLocked: {
    color: Colors.muted,
  },
  check: {
    position: 'absolute',
    top: 0,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTile: {
    width: TILE,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.muted,
    fontStyle: 'italic',
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    textAlign: 'center',
  },
});
