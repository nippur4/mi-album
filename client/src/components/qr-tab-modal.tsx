import Feather from '@expo/vector-icons/Feather';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { QrPosterModal } from '@/components/qr-poster-modal';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { useMyOwnedAlbums, type Album } from '@/lib/queries/albums';
import { useIsPro } from '@/lib/queries/subscriptions';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Modal accionado desde la tab "QR". Ofrece:
//   - Escanear QR (siempre): navega a /pack/scan.
//   - Mostrar QR (solo si pro y tiene >=1 álbum con qr.enabled):
//       1 álbum → abre QrPosterModal directo
//       N álbumes → muestra chooser inline
export function QrTabModal({ visible, onClose }: Props) {
  const router = useRouter();
  const { isPro } = useIsPro();
  const { albums } = useMyOwnedAlbums();
  const [posterFor, setPosterFor] = useState<Album | null>(null);
  const [choosing, setChoosing] = useState(false);

  const qrAlbums = useMemo(
    () =>
      albums.filter(
        (a) => a.status === 'published' && (a.pack_config as any)?.qr?.enabled === true,
      ),
    [albums],
  );

  function handleScan() {
    onClose();
    router.push('/pack/scan');
  }

  function handleShow() {
    if (!isPro || qrAlbums.length === 0) return;
    if (qrAlbums.length === 1) {
      setPosterFor(qrAlbums[0]);
      return;
    }
    setChoosing(true);
  }

  function handleClose() {
    setChoosing(false);
    setPosterFor(null);
    onClose();
  }

  const showDisabled = !isPro || qrAlbums.length === 0;
  const showHint = !isPro
    ? 'Para generar QR necesitás suscripción Pro.'
    : qrAlbums.length === 0
      ? 'Primero activá QR en algún álbum publicado.'
      : qrAlbums.length === 1
        ? `Mostrar QR de ${qrAlbums[0].name}.`
        : `Elegí de cuál de tus ${qrAlbums.length} álbumes mostrar el QR.`;

  return (
    <>
      <Modal
        visible={visible && posterFor === null}
        animationType="slide"
        transparent
        onRequestClose={handleClose}
      >
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <SafeAreaView edges={['bottom']} style={{ width: '100%' }}>
              <View style={styles.handle} />
              <Text style={styles.title}>QR</Text>

              {!choosing ? (
                <>
                  <Pressable
                    onPress={handleScan}
                    style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                  >
                    <View style={[styles.iconBox, { backgroundColor: Colors.ink }]}>
                      <Feather name="camera" size={22} color={Colors.paper} />
                    </View>
                    <View style={styles.optionText}>
                      <Text style={styles.optionTitle}>Escanear QR</Text>
                      <Text style={styles.optionSub}>
                        Escaneá el QR de un owner para sumar sobres.
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={20} color={Colors.muted} />
                  </Pressable>

                  <Pressable
                    onPress={handleShow}
                    disabled={showDisabled}
                    style={({ pressed }) => [
                      styles.option,
                      pressed && styles.pressed,
                      showDisabled && styles.disabled,
                    ]}
                  >
                    <View style={[styles.iconBox, { backgroundColor: Colors.gold }]}>
                      <Feather name="grid" size={22} color={Colors.ink} />
                    </View>
                    <View style={styles.optionText}>
                      <Text style={styles.optionTitle}>Mostrar QR</Text>
                      <Text style={styles.optionSub}>{showHint}</Text>
                    </View>
                    {!showDisabled && (
                      <Feather name="chevron-right" size={20} color={Colors.muted} />
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.chooseLabel}>ELEGÍ EL ÁLBUM</Text>
                  <ScrollView style={styles.chooseList}>
                    {qrAlbums.map((a) => (
                      <Pressable
                        key={a.id}
                        onPress={() => {
                          setChoosing(false);
                          setPosterFor(a);
                        }}
                        style={({ pressed }) => [styles.albumRow, pressed && styles.pressed]}
                      >
                        <Avatar source={a.name} size={40} />
                        <Text style={styles.albumName} numberOfLines={1}>{a.name}</Text>
                        <Feather name="chevron-right" size={20} color={Colors.muted} />
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Pressable onPress={() => setChoosing(false)} style={styles.cancelRow}>
                    <Text style={styles.cancelText}>Volver</Text>
                  </Pressable>
                </>
              )}
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>

      {posterFor && (
        <QrPosterModal
          visible={posterFor !== null}
          albumId={posterFor.id}
          albumName={posterFor.name}
          onClose={() => {
            setPosterFor(null);
            onClose();
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.paper,
    borderTopLeftRadius: Radius.cardLg,
    borderTopRightRadius: Radius.cardLg,
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    marginBottom: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.screenTitle,
    color: Colors.ink,
    marginBottom: Spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.55 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  optionSub: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
  },
  chooseLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
    marginBottom: Spacing.sm,
  },
  chooseList: {
    maxHeight: 320,
  },
  albumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  albumName: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  cancelRow: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    color: Colors.muted,
    fontWeight: '700',
  },
});
