import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BottomSheet } from '@/components/bottom-sheet';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useActivePresets } from '@/lib/queries/presets';
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
export function AvatarPickerModal({ visible, currentName, currentThumbKey, onClose, onSelect }: Props) {
  const { items, isLoading } = useActivePresets('avatar');

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Elegí tu avatar" maxHeight="85%">
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
              return (
                <Pressable
                  key={p.id}
                  style={styles.tile}
                  onPress={() => { onSelect(p.thumb_key); onClose(); }}
                >
                  {url && (
                    <Image
                      source={{ uri: url }}
                      style={styles.tileImage}
                      contentFit="cover"
                    />
                  )}
                  <Text style={styles.tileLabel} numberOfLines={1}>{p.name}</Text>
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
  scroll: { maxHeight: '100%' },
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
  tileLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.inkSoft,
    textAlign: 'center',
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
