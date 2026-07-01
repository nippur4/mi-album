import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useAppFonts } from '@/lib/fonts';
import { useSession, useDeepLinkAuth, useJoinDeepLink } from '@/lib/auth';
import { ProfileProvider } from '@/lib/queries/profile';
import { ensurePwaHead } from '@/lib/pwa-head';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Inyecta los meta/link tags PWA al cargar la página en web. Es idempotente,
// no hace nada en mobile.
ensurePwaHead();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  useDeepLinkAuth();
  useJoinDeepLink();
  const { session, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  const ready = (fontsLoaded || fontError) && !isLoading;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [ready, session, segments, router]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ProfileProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.paper } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="album" />
          <Stack.Screen name="sticker" />
          <Stack.Screen name="join" />
          <Stack.Screen name="pack" />
          <Stack.Screen name="trade" />
          <Stack.Screen name="admin" />
        </Stack>
      </ProfileProvider>
    </GestureHandlerRootView>
  );
}
