import { Stack } from 'expo-router';

import { DesktopCapped } from '@/components/desktop-capped';
import { Colors } from '@/constants/theme';

export default function StickerLayout() {
  return (
    <DesktopCapped maxWidth={560}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.paper },
        }}
      />
    </DesktopCapped>
  );
}
