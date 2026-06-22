import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { generateQrToken } from '@/lib/queries/qr';
import { errorMessage } from '@/lib/errors';

interface Props {
  visible: boolean;
  albumId: string;
  albumName: string;
  onClose: () => void;
}

export function QrPosterModal({ visible, albumId, albumName, onClose }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setToken(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    generateQrToken(albumId)
      .then((t) => setToken(t))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [visible, albumId]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.kicker}>QR DE SOBRES</Text>
          <Text style={styles.title} numberOfLines={2}>{albumName.toUpperCase()}</Text>
        </View>

        <View style={styles.qrWrap}>
          <View style={styles.qrCard}>
            {loading ? (
              <ActivityIndicator color={Colors.ink} size="large" />
            ) : error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : token ? (
              <QRCode
                value={token}
                size={260}
                backgroundColor="#FFFFFF"
                color={Colors.ink}
              />
            ) : null}
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.hint}>
            Mostralo a los jugadores para que escaneen con la app y reciban sobres.
          </Text>
          <Text style={styles.hintSmall}>
            Cada jugador puede escanear una vez por día (según el cooldown configurado).
            Si querés invalidar este QR, rotá el secret en la configuración del álbum.
          </Text>
        </View>

        <View style={styles.footer}>
          <Button label="Cerrar" variant="outline" onPress={onClose} />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.ink },
  header: {
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  kicker: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.gold,
    letterSpacing: 2.5,
    fontWeight: '700',
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 26,
    color: Colors.paper,
    letterSpacing: 0.5,
  },
  qrWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
  qrCard: {
    width: 300,
    height: 300,
    borderRadius: Radius.cardLg,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.red,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  body: {
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  hint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.paper,
    textAlign: 'center',
  },
  hintSmall: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.muted,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
  footer: {
    paddingHorizontal: Spacing.screenX,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.md,
    marginTop: 'auto',
  },
});
