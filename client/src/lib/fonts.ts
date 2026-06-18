// Carga de fuentes del proyecto. Las 3 vienen de Google Fonts y se bundlean
// con la app vía @expo-google-fonts/*.
//
// Nota: el handoff pide Hanken Grotesque pero ese paquete no existe en
// @expo-google-fonts. Sustituimos por Manrope (grotesque similar con mismos
// pesos). Si querés match exacto, hay que cargar los TTFs manualmente desde
// fonts.google.com.

import { useFonts } from 'expo-font';
import {
  Anton_400Regular,
} from '@expo-google-fonts/anton';
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono';

// Los family names que registramos coinciden con FontFamily en constants/theme.ts
export function useAppFonts() {
  return useFonts({
    Anton: Anton_400Regular,
    Manrope: Manrope_400Regular,
    'Manrope-Medium': Manrope_500Medium,
    'Manrope-SemiBold': Manrope_600SemiBold,
    'Manrope-Bold': Manrope_700Bold,
    'Manrope-ExtraBold': Manrope_800ExtraBold,
    SpaceMono: SpaceMono_400Regular,
    'SpaceMono-Bold': SpaceMono_700Bold,
  });
}
