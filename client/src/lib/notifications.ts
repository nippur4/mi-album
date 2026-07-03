// Registro de push notifications + handler de taps.
//
// Flow al abrir la app:
//   1. useRegisterPushToken(): si hay sesión, pide permisos (silencioso si
//      ya los dio), obtiene ExpoPushToken y lo guarda en profiles vía RPC.
//      Se corre en cada boot: si el token cambió (device reset), actualiza.
//
//   2. useNotificationTapResponder(): registra un listener global para el
//      tap sobre una notif recibida (en background/killed). Según el
//      `data.kind` del payload, navega a la pantalla relevante.
//
// En web es no-op (expo-notifications no soporta web real; usaríamos la
// Web Push API por separado si lo agregamos más adelante).

import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/auth';

// Configuración global del handler para notifs que llegan con la app abierta.
// Sin esto, iOS silencia el banner cuando la app está en foreground.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function getPushTokenIfAllowed(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (!Device.isDevice) return null; // simulator/emulator no reciben push

  // Android necesita un canal declarado para que la notif tenga sonido/vibración.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  // El projectId es requerido para ExpoPushToken en SDK 49+.
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId;
  if (!projectId) {
    console.warn('[push] No EAS projectId in app config; skipping push token.');
    return null;
  }

  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err) {
    console.warn('[push] getExpoPushTokenAsync failed', err);
    return null;
  }
}

// Se llama una vez, al iniciar la app con sesión activa. Persiste el token
// en profiles.push_token vía la RPC del backend.
export function useRegisterPushToken() {
  const { session } = useSession();
  const uid = session?.user.id;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      const token = await getPushTokenIfAllowed();
      if (cancelled || !token) return;
      const { error } = await supabase.rpc('fn_register_push_token', { p_token: token });
      if (error) {
        console.warn('[push] fn_register_push_token failed', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);
}

// Maneja los taps sobre notifs cuando la app estaba en background/killed.
// Decodifica el `data.kind` que setea el backend en _send_push y navega.
export function useNotificationTapResponder() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    function handle(response: Notifications.NotificationResponse) {
      const data = response.notification.request.content.data as any;
      if (!data || typeof data !== 'object') return;

      switch (data.kind) {
        case 'trade_received':
        case 'trade_accepted':
        case 'trade_rejected':
          if (data.album_id) {
            router.push(`/trade/matches?albumId=${data.album_id}`);
          }
          return;
        case 'daily_ready':
          if (data.album_id) {
            router.push(`/album/${data.album_id}`);
          }
          return;
        case 'album_joined':
          if (data.album_id) {
            router.push(`/album/${data.album_id}`);
          }
          return;
      }
    }

    // Si la app se abrió DESDE una notif tapeada estando killed:
    Notifications.getLastNotificationResponseAsync().then((res) => {
      if (res) handle(res);
    });

    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, [router]);
}
