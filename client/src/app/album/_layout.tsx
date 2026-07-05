import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

// El cap desktop NO va acá: envolvería al ScrollView y la barra de scroll
// quedaría flotando en el borde del cap. Cada vista (owner/user/new) capea su
// contenido con useDesktopCap(760) dejando el scroll a todo el ancho.
export default function AlbumLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.paper },
      }}
    />
  );
}
