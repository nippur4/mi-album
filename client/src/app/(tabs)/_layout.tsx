import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { Colors, FontFamily } from '@/constants/theme';

// Tabs custom para tener control total del look (iconos lucide-style + labels
// en Space Mono coherentes con el handoff).
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.red,
        tabBarInactiveTintColor: Colors.muted,
        tabBarStyle: {
          backgroundColor: Colors.paper,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingTop: 6,
          height: 64,
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
          title: 'ÁLBUM',
          tabBarIcon: ({ color }) => <Feather name="grid" size={22} color={color} />,
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
      <Tabs.Screen
        name="profile"
        options={{
          title: 'PERFIL',
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
