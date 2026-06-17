import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';

// Tab bar: 5 ítems del handoff — Inicio / Álbum / Sobres / Cambios / Perfil.
// Iconos vía SF Symbols (iOS) y drawables nativos (Android). En Android sin
// drawables matcheados se cae al default; aceptable para arrancar.
export default function TabsLayout() {
  return (
    <NativeTabs
      backgroundColor={Colors.paper}
      labelStyle={{ selected: { color: Colors.red }, unselected: { color: Colors.muted } }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Inicio</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house.fill" drawable="ic_home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="album">
        <NativeTabs.Trigger.Label>Álbum</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="square.grid.3x3.fill" drawable="ic_grid" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="packs">
        <NativeTabs.Trigger.Label>Sobres</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="envelope.fill" drawable="ic_envelope" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="trades">
        <NativeTabs.Trigger.Label>Cambios</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="arrow.left.arrow.right" drawable="ic_swap" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.fill" drawable="ic_person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
