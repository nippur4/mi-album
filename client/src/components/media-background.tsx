// Cascada de fondo compartida por carátulas, sobres y cards: preset (gradiente
// local) → imagen R2 → fallback del caller. Rellena su contenedor (absoluteFill);
// el caller pone overlays/scrims/texto encima y el borde/overflow del contenedor.

import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { PresetBackground } from '@/components/preset-background';
import { isPreset, presetIdFromKey, r2Url } from '@/lib/storage';

interface Props {
  mediaKey?: string | null;
  fallback?: ReactNode;
}

export function MediaBackground({ mediaKey, fallback = null }: Props) {
  if (mediaKey && isPreset(mediaKey)) {
    return <PresetBackground id={presetIdFromKey(mediaKey)} />;
  }
  const url = r2Url(mediaKey);
  if (url) {
    return <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />;
  }
  return <>{fallback}</>;
}
