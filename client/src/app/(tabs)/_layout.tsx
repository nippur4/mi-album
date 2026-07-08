import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QrTabModal } from '@/components/qr-tab-modal';
import { useMyPacksTabData } from '@/lib/queries/packs-tab';
import { useMyOffers } from '@/lib/queries/trades';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { Colors, FontFamily } from '@/constants/theme';

// Tabs custom para tener control total del look (iconos lucide-style + labels
// en Space Mono coherentes con el handoff). La tab "QR" no navega: intercepta
// tabPress y abre un modal manejado acá arriba para mantener estado en el layout.
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const isDesktop = useIsDesktop();
  const [qrModalVisible, setQrModalVisible] = useState(false);

  // Badge de la tab Sobres: sobres sin abrir + dailies reclamables ahora.
  // Comparte cache (misma query key) con la pantalla del tab.
  const { pending, playable } = useMyPacksTabData();
  const packsBadge =
    pending.reduce((acc, r) => acc + r.count, 0) +
    playable.filter((r) => r.daily.canClaim).length;

  // Badge de la tab Cambios: ofertas recibidas pendientes de responder.
  // Comparte cache con la pantalla del tab (misma query key en useMyOffers).
  const { received } = useMyOffers();
  const tradesBadge = received.filter((o) => o.status === 'pending').length;

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
            tabBarBadge: packsBadge > 0 ? packsBadge : undefined,
            tabBarBadgeStyle: {
              backgroundColor: Colors.red,
              color: Colors.paper,
              fontFamily: FontFamily.mono,
              fontSize: 10,
              fontWeight: '700',
            },
          }}
        />
        <Tabs.Screen
          name="trades"
          options={{
            title: 'CAMBIOS',
            tabBarIcon: ({ color }) => <Feather name="repeat" size={22} color={color} />,
            tabBarBadge: tradesBadge > 0 ? tradesBadge : undefined,
            tabBarBadgeStyle: {
              backgroundColor: Colors.red,
              color: Colors.paper,
              fontFamily: FontFamily.mono,
              fontSize: 10,
              fontWeight: '700',
            },
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
