// Versión web del scanner de QR. expo-camera no funciona en browser; usamos
// getUserMedia + un <canvas> oculto + jsQR. Misma UX que la mobile: viewfinder
// con esquinas gold, hint debajo, mismo flow de redeemQrToken al detectar.
//
// Expo Router carga este archivo solo en web (resolution por extensión .web.tsx).
// La versión nativa sigue en scan.tsx, sin tocar.

import jsQR from 'jsqr';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { redeemQrToken } from '@/lib/queries/qr';
import { errorMessage } from '@/lib/errors';

type Permission = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

const SCAN_INTERVAL_MS = 200;

export default function ScanQrScreen() {
  const router = useRouter();
  const videoRef = useRef<any>(null);
  const canvasRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScannedRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  const [permission, setPermission] = useState<Permission>('idle');
  const [busy, setBusy] = useState(false);

  // Cleanup del stream al desmontar (importante: si el user navega lejos, la
  // cámara debe apagarse para liberar el indicador del browser).
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const onScanned = useCallback(async (token: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await redeemQrToken(token);
      const extras = result.welcome_packs > 0 ? ` + ${result.welcome_packs} de bienvenida` : '';
      Alert.alert(
        '¡Sobres reclamados!',
        `Te otorgamos ${result.packs} sobre${result.packs !== 1 ? 's' : ''}${extras}.`,
        [{ text: 'Abrir ahora', onPress: () => router.replace(`/pack/open?albumId=${result.album_id}`) }],
      );
    } catch (err: any) {
      Alert.alert('No se pudo reclamar', errorMessage(err), [
        { text: 'Reintentar', onPress: () => { lastScannedRef.current = null; busyRef.current = false; setBusy(false); } },
        { text: 'Volver', onPress: () => router.back(), style: 'cancel' },
      ]);
    } finally {
      // busy queda en true hasta que el user toca Reintentar (sino loop infinito
      // de alerts si el QR sigue en cámara).
    }
  }, [router]);

  // Loop de escaneo: cada 200ms tomamos un frame del <video>, lo dibujamos en
  // el <canvas> oculto, y pasamos los pixels a jsQR. Si detecta y es un token
  // nuevo, disparamos onScanned.
  useEffect(() => {
    if (permission !== 'granted') return;

    let timer: any = null;

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === 4 && !busyRef.current) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w > 0 && h > 0) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, w, h);
          const data = ctx.getImageData(0, 0, w, h);
          const code = jsQR(data.data, data.width, data.height, {
            inversionAttempts: 'dontInvert',
          });
          if (code?.data && code.data !== lastScannedRef.current) {
            lastScannedRef.current = code.data;
            onScanned(code.data);
          }
        }
      }
      timer = setTimeout(tick, SCAN_INTERVAL_MS);
    }

    timer = setTimeout(tick, SCAN_INTERVAL_MS);
    return () => { if (timer) clearTimeout(timer); };
  }, [permission, onScanned]);

  async function requestCameraPermission() {
    // Verificación de soporte: Safari iOS <11 y algunos browsers viejos no
    // tienen mediaDevices o getUserMedia. También requiere HTTPS (Safari
    // bloquea en HTTP no-localhost).
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPermission('unsupported');
      return;
    }
    setPermission('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      // Esperamos que el video element esté montado antes de asignar srcObject.
      // El effect siguiente se dispara cuando permission cambia a granted.
      setPermission('granted');
      // Asignamos en el próximo tick (después del render que monta el <video>).
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (err: any) {
      setPermission('denied');
    }
  }

  if (permission === 'idle' || permission === 'requesting') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Escanear QR" back />
        <View style={styles.center}>
          <Text style={styles.title}>Escanear QR del owner</Text>
          <Text style={styles.body}>
            Necesitamos acceso a la cámara para leer el código.
          </Text>
          <Button
            label={permission === 'requesting' ? 'Pidiendo permiso…' : 'Activar cámara'}
            onPress={requestCameraPermission}
            disabled={permission === 'requesting'}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (permission === 'denied') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Escanear QR" back />
        <View style={styles.center}>
          <Text style={styles.title}>Permiso denegado</Text>
          <Text style={styles.body}>
            Habilitá el acceso a la cámara desde los ajustes del navegador y
            recargá la página.
          </Text>
          <Button label="Reintentar" onPress={requestCameraPermission} />
        </View>
      </SafeAreaView>
    );
  }

  if (permission === 'unsupported') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Escanear QR" back />
        <View style={styles.center}>
          <Text style={styles.title}>Cámara no disponible</Text>
          <Text style={styles.body}>
            Tu navegador no soporta acceso a la cámara, o estás en una
            conexión sin HTTPS. Probá desde Chrome o Safari en HTTPS, o
            descargá la app Android.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // permission === 'granted' — render del scanner
  return (
    <View style={styles.container}>
      {/* Stream de cámara: video HTML directo (RN-Web no tiene equivalente). */}
      {React.createElement('video', {
        ref: videoRef,
        playsInline: true,
        muted: true,
        autoPlay: true,
        style: {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        },
      })}
      {/* Canvas oculto para captura de frames */}
      {React.createElement('canvas', {
        ref: canvasRef,
        style: { display: 'none' },
      })}

      {/* Overlay con esquinas gold (mismo diseño que mobile) */}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.topTitle}>ESCANEÁ EL QR DEL OWNER</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.viewfinderWrap}>
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
        </View>

        <View style={styles.hintBar}>
          <Text style={styles.hintText}>
            {busy ? 'Procesando…' : 'Apuntá al QR. Si no funciona, pedile al owner que lo regenere.'}
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const VIEWFINDER = 240;
const CORNER = 28;
const CORNER_W = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.ink },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.screenX,
    gap: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.screenTitle,
    color: Colors.ink,
    textAlign: 'center',
  },
  body: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    color: Colors.inkSoft,
    textAlign: 'center',
  },
  overlay: { ...StyleSheet.absoluteFill },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screenX,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
  },
  backText: {
    fontFamily: FontFamily.body,
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 28,
  },
  topTitle: {
    fontFamily: FontFamily.mono,
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  viewfinderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewfinder: { width: VIEWFINDER, height: VIEWFINDER },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: Colors.gold,
  },
  tl: { top: 0, left: 0, borderTopWidth: CORNER_W, borderLeftWidth: CORNER_W },
  tr: { top: 0, right: 0, borderTopWidth: CORNER_W, borderRightWidth: CORNER_W },
  bl: { bottom: 0, left: 0, borderBottomWidth: CORNER_W, borderLeftWidth: CORNER_W },
  br: { bottom: 0, right: 0, borderBottomWidth: CORNER_W, borderRightWidth: CORNER_W },
  hintBar: {
    paddingHorizontal: Spacing.screenX,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  hintText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: '#FFFFFF',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
});
