// Wrapper que anima "snap" al pegar una figurita:
//   1. Escala rápida: 0.85 → 1.08 → 1.0 con spring (sensación de "sello").
//   2. Flash verde por arriba: opacity 0.55 → 0 en 700ms (feedback de éxito).
//
// Uso: se envuelve la celda recién pegada; el componente se auto-limpia
// cuando el flash termina llamando a `onDone` (para que el caller resetee el
// state de "just pasted"). Si no se pasa onDone, simplemente el efecto muere.

import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Colors, Radius } from '@/constants/theme';

interface Props {
  children: React.ReactNode;
  onDone?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function PastedFlash({ children, onDone, style }: Props) {
  const scale = useSharedValue(0.85);
  const tint = useSharedValue(0.55);

  useEffect(() => {
    scale.value = withSpring(1.0, { damping: 8, stiffness: 220, overshootClamping: false });
    tint.value = withDelay(
      120,
      withTiming(
        0,
        { duration: 700, easing: Easing.out(Easing.quad) },
        (finished) => {
          if (finished && onDone) runOnJS(onDone)();
        },
      ),
    );
    // Bump inicial: pequeño overshoot antes del spring — le da el "click".
    scale.value = withSpring(1.08, { damping: 6, stiffness: 260 }, () => {
      scale.value = withSpring(1.0, { damping: 10, stiffness: 200 });
    });
  }, [scale, tint, onDone]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const tintStyle = useAnimatedStyle(() => ({
    opacity: tint.value,
  }));

  return (
    <Animated.View style={[style, wrapStyle]}>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[styles.tint, tintStyle]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.green,
    borderRadius: Radius.cell,
  },
});
