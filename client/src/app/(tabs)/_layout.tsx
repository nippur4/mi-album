import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QrTabModal } from '@/components/qr-tab-modal';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { Colors, FontFamily } from '@/constants/theme';

// Tabs custom para tener control total del look (iconos lucide-style + labels
// en Space Mono coherentes con el handoff). La tab "QR" no navega: intercepta
// tabPress y abre un modal manejado acá arriba para mantener estado en el layout.
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const [qrModalVisible, setQrModalVisible] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: Colors.red,
          tabBarInactiveTintColor: Colors.muted,
          // En desktop web la nav vive arriba en el DesktopHeader del root
          // layout — acá escondemos la tab bar mobile.
          tabBarStyle: isDesktop
            ? { display: 'none' }
            : {
                backgroundColor: Colors.paper,
                borderTopColor: Colors.border,
                borderTopWidth: 1,
                paddingTop: 6,
                paddingBottom: insets.bottom,
                height: 64 + insets.bottom,
              },
          tabBarLabelStyle: {
            fontFamily: FontFamily.mono,
            fontSize: 9,
            fontWeight: '700',
            letterSpacing: 1,
            marginTop: 2,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'INICIO',
            tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="album"
          options={{
            title: 'GESTIONAR',
            tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="qr"
          options={{
            title: 'QR',
            tabBarIcon: ({ color }) => <Feather name="maximize" size={22} color={color} />,
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setQrModalVisible(true);
            },
          }}
        />
        <Tabs.Screen
          name="packs"
          options={{
            title: 'SOBRES',
            tabBarIcon: ({ color }) => <Feather name="mail" size={22} color={color} />,
          }}
        />
        <Tabs.Screen
          name="trades"
          options={{
            title: 'CAMBIOS',
            tabBarIcon: ({ color }) => <Feather name="repeat" size={22} color={color} />,
          }}
        />
        {/* Profile sigue accesible via /profile (HeaderAvatar lo abre) pero
            no aparece en la tab bar. */}
        <Tabs.Screen
          name="profile"
          options={{
            href: null,
          }}
        />
      </Tabs>

      <QrTabModal
        visible={qrModalVisible}
        onClose={() => setQrModalVisible(false)}
      />
    </>
  );
}
