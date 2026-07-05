import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

// El cap desktop NO va acá (dejaría la barra de scroll flotando en el borde
// del cap). Las pantallas capean su contenido con useDesktopCap(960).
export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.paper },
      }}
    />
  );
}
