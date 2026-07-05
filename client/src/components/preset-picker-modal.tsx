import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { PRESETS } from '@/lib/presets';
import { useActivePresets, type PresetKind } from '@/lib/queries/presets';
import { makePresetKey, r2Url } from '@/lib/storage';

interface SelectedKeys {
  thumb_key: string;
  large_key: string;
}

interface Props {
  visible: boolean;
  kind: PresetKind | null;
  onClose: () => void;
  onSelect: (keys: SelectedKeys) => void;
}

export function PresetPickerModal({ visible, kind, onClose, onSelect }: Props) {
  const { items: adminPresets, isLoading } = useActivePresets(kind ?? 'cover');

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Elegí una plantilla" maxHeight="85%">
      <ScrollView style={styles.scroll}>
        <Text style={styles.sectionLabel}>COLORES</Text>
        <View style={styles.grid}>
          {PRESETS.map((p) => (
            <Pressable
              key={p.id}
              style={styles.tile}
              onPress={() => {
                const key = makePresetKey(p.id);
                onSelect({ thumb_key: key, large_key: key });
                onClose();
              }}
            >
              <LinearGradient
                colors={p.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={[styles.tileLabel, { color: p.textColor }]}>{p.name}</Text>
            </Pressable>
          ))}
        </View>

        {kind && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>
              IMÁGENES {kind === 'cover' ? 'CARÁTULA' : 'SOBRE'}
            </Text>
            {isLoading ? (
              <View style={styles.empty}><ActivityIndicator color={Colors.red} /></View>
            ) : adminPresets.length === 0 ? (
              <Text style={styles.emptyText}>
                No hay imágenes disponibles todavía.
              </Text>
            ) : (
              <View style={styles.grid}>
                {adminPresets.map((p) => {
                  const url = r2Url(p.thumb_key);
                  return (
                    <Pressable
                      key={p.id}
                      style={styles.tile}
                      onPress={() => {
                        onSelect({ thumb_key: p.thumb_key, large_key: p.large_key });
                        onClose();
                      }}
                    >
                      {url && (
                        <Image
                          source={{ uri: url }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                        />
                      )}
                      <View style={styles.adminLabelBg}>
                        <Text style={styles.adminLabel}>{p.name}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: '100%' },
  sectionLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  tile: {
    width: '47%',
    aspectRatio: 1,
    borderRadius: Radius.card,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontFamily: FontFamily.display,
    fontSize: 24,
    letterSpacing: 1,
  },
  adminLabelBg: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(42,30,22,0.7)',
    borderRadius: 4,
  },
  adminLabel: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.paper,
    fontWeight: '700',
    textAlign: 'center',
  },
  empty: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.muted,
    fontStyle: 'italic',
    paddingVertical: Spacing.md,
  },
});
