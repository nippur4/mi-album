// Carga de fuentes del proyecto. Las 3 vienen de Google Fonts y se bundlean
// con la app vía @expo-google-fonts/*.
//
// Deps requeridas:
//   npm i @expo-google-fonts/anton @expo-google-fonts/hanken-grotesque @expo-google-fonts/space-mono

import { useFonts } from 'expo-font';
import {
  Anton_400Regular,
} from '@expo-google-fonts/anton';
import {
  HankenGrotesque_400Regular,
  HankenGrotesque_500Medium,
  HankenGrotesque_600SemiBold,
  HankenGrotesque_700Bold,
  HankenGrotesque_800ExtraBold,
} from '@expo-google-fonts/hanken-grotesque';
import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
} from '@expo-google-fonts/space-mono';

// Los family names que registramos coinciden con FontFamily en constants/theme.ts
export function useAppFonts() {
  return useFonts({
    Anton: Anton_400Regular,
    HankenGrotesque: HankenGrotesque_400Regular,
    'HankenGrotesque-Medium': HankenGrotesque_500Medium,
    'HankenGrotesque-SemiBold': HankenGrotesque_600SemiBold,
    'HankenGrotesque-Bold': HankenGrotesque_700Bold,
    'HankenGrotesque-ExtraBold': HankenGrotesque_800ExtraBold,
    SpaceMono: SpaceMono_400Regular,
    'SpaceMono-Bold': SpaceMono_700Bold,
  });
}
