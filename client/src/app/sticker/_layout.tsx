import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

// El cap desktop NO va acá (dejaría la barra de scroll flotando en el borde
// del cap). Las vistas capean su contenido con useDesktopCap(560).
export default function StickerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.paper },
      }}
    />
  );
}
