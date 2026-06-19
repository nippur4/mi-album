import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

import { useAppFonts } from '@/lib/fonts';
import { useSession, useDeepLinkAuth, useJoinDeepLink } from '@/lib/auth';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

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
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.paper } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="album" />
        <Stack.Screen name="sticker" />
        <Stack.Screen name="join" />
      </Stack>
    </>
  );
}
