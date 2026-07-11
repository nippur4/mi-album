// Sobre flotante animado para el welcome del usuario recién unido.
// Bob vertical suave en loop + tilt sutil hacia la izquierda para dar
// la sensación de que "el sobre está por caerse en tu regazo".
//
// Renderiza el pack_thumb del álbum (con soporte para presets/gradiente y
// R2). Fallback: sobre con icono si no hay thumb todavía.

import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PresetBackground } from '@/components/preset-background';
import { Colors, Radius } from '@/constants/theme';
import { isPreset, presetIdFromKey, r2Url } from '@/lib/storage';

interface Props {
  packThumbKey?: string | null;
  size?: number;
}

export function FloatingPack({ packThumbKey, size = 90 }: Props) {
  const bob = useSharedValue(0);

  useEffect(() => {
    // Bob suave: sube 6px, baja 6px, con easing sinusoidal para que se sienta
    // orgánico. Un ciclo cada 3s.
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      ),
      -1, // repeat infinito
      false,
    );
    return () => {
      bob.value = 0;
    };
  }, [bob]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bob.value * -6 },
      { rotate: '-8deg' },
    ],
  }));

  const url = r2Url(packThumbKey);
  const preset = packThumbKey && isPreset(packThumbKey) ? presetIdFromKey(packThumbKey) : null;

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size * 4 / 3 }, animatedStyle]}>
      <View style={styles.pack}>
        {preset ? (
          <PresetBackground id={preset} />
        ) : url ? (
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <LinearGradient
            colors={[Colors.gold, '#B8871B']}
            style={StyleSheet.absoluteFill}
          />
        )}
        {!url && !preset && (
          <View style={styles.fallbackIcon}>
            <Feather name="mail" size={size * 0.35} color={Colors.paper} />
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 8,
  },
  pack: {
    flex: 1,
    borderRadius: Radius.card,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
    backgroundColor: Colors.paper2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackIcon: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
