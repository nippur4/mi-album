import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { getPreset } from '@/lib/presets';

interface Props {
  id: string;
  style?: StyleProp<ViewStyle>;
}

// Render local de una plantilla (gradiente) en lugar de imagen R2.
export function PresetBackground({ id, style }: Props) {
  const preset = getPreset(id);
  if (!preset) return null;
  return (
    <LinearGradient
      colors={preset.colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[StyleSheet.absoluteFill, style]}
    />
  );
}
