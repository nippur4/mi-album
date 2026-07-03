// Carga de fuentes del proyecto. Las 3 vienen de Google Fonts y se bundlean
// con la app vía @expo-google-fonts/*.
//
// Nota: el handoff pide Hanken Grotesque pero ese paquete no existe en
// @expo-google-fonts. Sustituimos por Manrope (grotesque similar con mismos
// pesos). Si querés match exacto, hay que cargar los TTFs manualmente desde
// fonts.google.com.
//
// Solo cargamos los weights realmente usados: cada familia como Regular (400)
// + Bold (700) para asegurar que `fontWeight: '700'` renderee bold en Android
// (donde el synthetic bold no siempre funciona con Google Fonts). En iOS/web
// el synthetic bold ya cubre el resto de weights intermedios.

import { useFonts } from 'expo-font';
import { Anton_400Regular } from '@expo-google-fonts/anton';
import { Manrope_400Regular, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';

// Los family names que registramos coinciden con FontFamily en constants/theme.ts
export function useAppFonts() {
  return useFonts({
    Anton: Anton_400Regular,
    Manrope: Manrope_400Regular,
    'Manrope-Bold': Manrope_700Bold,
    SpaceMono: SpaceMono_400Regular,
    'SpaceMono-Bold': SpaceMono_700Bold,
  });
}
