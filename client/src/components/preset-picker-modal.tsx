import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { PRESETS } from '@/lib/presets';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (presetId: string) => void;
}

export function PresetPickerModal({ visible, onClose, onSelect }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView edges={['bottom']} style={{ width: '100%' }}>
            <View style={styles.handle} />
            <Text style={styles.title}>Elegí una plantilla</Text>
            <View style={styles.grid}>
              {PRESETS.map((p) => (
                <Pressable
                  key={p.id}
                  style={styles.tile}
                  onPress={() => { onSelect(p.id); onClose(); }}
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
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radius.cardLg,
    borderTopRightRadius: Radius.cardLg,
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.screenTitle,
    color: Colors.ink,
    marginBottom: Spacing.lg,
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
});
