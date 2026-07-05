import { Stack } from 'expo-router';

import { DesktopCapped } from '@/components/desktop-capped';
import { Colors } from '@/constants/theme';

export default function PackLayout() {
  return (
    // backgroundColor ink: el grupo pack es oscuro (apertura de sobre, scan) —
    // sin esto los costados del cap mostrarían el cream del root.
    <DesktopCapped maxWidth={560} backgroundColor={Colors.ink}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.ink },
        }}
      />
    </DesktopCapped>
  );
}
