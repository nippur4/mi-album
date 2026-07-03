import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { DesktopHeader } from '@/components/desktop-header';
import { useAppFonts } from '@/lib/fonts';
import { useSession, useDeepLinkAuth, useJoinDeepLink } from '@/lib/auth';
import { useNotificationTapResponder, useRegisterPushToken } from '@/lib/notifications';
import { ProfileProvider } from '@/lib/queries/profile';
import { ensurePwaHead } from '@/lib/pwa-head';
import { queryClient } from '@/lib/query-client';
import { useIsDesktop } from '@/lib/use-is-desktop';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Inyecta los meta/link tags PWA al cargar la página en web. Es idempotente,
// no hace nada en mobile.
ensurePwaHead();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useAppFonts();
  useDeepLinkAuth();
  useJoinDeepLink();
  useRegisterPushToken();
  useNotificationTapResponder();
  const { session, isLoading } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const isDesktop = useIsDesktop();

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

  const inAuthGroup = segments[0] === '(auth)';
  // El header desktop solo aparece en pantallas autenticadas — en login no
  // tiene sentido mostrarlo.
  const showDesktopHeader = isDesktop && !!session && !inAuthGroup;

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
      <ProfileProvider>
        <StatusBar style="dark" />
        {showDesktopHeader && <DesktopHeader />}
        <View style={[styles.body, isDesktop && styles.bodyDesktop]}>
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
        </View>
      </ProfileProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.paper },
  body: { flex: 1 },
  // Web ≥ 768px: capamos el contenido a un ancho tipo mobile centrado. Los
  // costados dejan ver Colors.paper del root. Sombra sutil para dar la idea
  // de "app dentro del monitor".
  bodyDesktop: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
});
