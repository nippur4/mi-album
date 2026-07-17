import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { redeemQrToken } from '@/lib/queries/qr';
import { errorMessage } from '@/lib/errors';

export default function ScanQrScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  // Para evitar que el scanner dispare el mismo QR muchas veces en milisegundos.
  const [lastScanned, setLastScanned] = useState<string | null>(null);

  if (!permission) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Escanear QR" back />
        <View style={styles.center}><Text style={styles.body}>Cargando cámara...</Text></View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScreenHeader title="Escanear QR" back />
        <View style={styles.center}>
          <Text style={styles.title}>Necesitamos acceso a la cámara</Text>
          <Text style={styles.body}>
            Para escanear el QR del owner, dale permiso a la cámara.
          </Text>
          <Button label="Dar permiso" onPress={requestPermission} />
        </View>
      </SafeAreaView>
    );
  }

  async function onScanned(token: string) {
    if (busy || token === lastScanned) return;
    setLastScanned(token);
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
        { text: 'Reintentar', onPress: () => setLastScanned(null) },
        { text: 'Volver', onPress: () => router.back(), style: 'cancel' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={busy ? undefined : (e) => onScanned(e.data)}
      />
      {/* Overlay con esquinas gold (handoff 06) */}
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
            {busy ? 'Procesando...' : 'Apuntá al QR. Si no funciona, pedile al owner que lo regenere.'}
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
  overlay: {
    ...StyleSheet.absoluteFill,
  },
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
  viewfinder: {
    width: VIEWFINDER,
    height: VIEWFINDER,
  },
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
