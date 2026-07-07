import Feather from '@expo/vector-icons/Feather';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';

import { BottomSheet, sheetStyles } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import { addSticker } from '@/lib/queries/stickers';
import { uploadImage } from '@/lib/queries/uploads';

interface Props {
  visible: boolean;
  albumId: string;
  totalStickers: number;
  // Primer número del álbum (1 salvo el álbum especial que arranca en 0).
  numberStart?: number;
  occupiedNumbers: Set<number>;   // números ya cargados, se saltean
  onClose: () => void;
  onFinished: () => void;          // refetch del owner view
}

interface Progress {
  total: number;
  done: number;
  failed: number;
  currentNumber: number | null;
}

// Resumen final de la corrida. Se muestra DENTRO del modal: Alert.alert es
// un no-op en react-native-web, así que en web el resumen por Alert nunca
// aparecía y el modal volvía a su estado inicial sin feedback.
interface Summary {
  done: number;
  failed: number;
  lastError: string | null;
}

// Carga masiva: el owner selecciona N imágenes del rollo y se asignan a los
// próximos N números libres del álbum. Cada imagen se sube + se crea como
// sticker rarity='common' con name "#NN". El user puede editar cada una
// después desde la grilla.
export function BulkStickerUploadModal({
  visible,
  albumId,
  totalStickers,
  numberStart = 1,
  occupiedNumbers,
  onClose,
  onFinished,
}: Props) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  // shouldStop vive en un ref para que el loop async lo lea en vivo (un
  // state quedaría capturado en el closure del loop).
  const shouldStopRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setProgress(null);
      setSummary(null);
      shouldStopRef.current = false;
    }
  }, [visible]);

  // Lista de números libres en orden ascendente (numberStart..último).
  const freeNumbers: number[] = [];
  for (let n = numberStart; n <= numberStart + totalStickers - 1; n++) {
    if (!occupiedNumbers.has(n)) freeNumbers.push(n);
  }
  const freeCount = freeNumbers.length;

  async function pickAndUpload() {
    if (freeCount === 0) {
      Alert.alert('Sin lugar', 'No hay números libres en este álbum.');
      return;
    }

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: freeCount,
      quality: 0.9,
    });
    if (result.canceled || result.assets.length === 0) return;

    const assets = result.assets.slice(0, freeCount);
    setRunning(true);
    shouldStopRef.current = false;
    setProgress({ total: assets.length, done: 0, failed: 0, currentNumber: null });

    let done = 0;
    let failed = 0;
    let lastError: string | null = null;

    for (let i = 0; i < assets.length; i++) {
      if (shouldStopRef.current) break;
      const number = freeNumbers[i];
      setProgress({ total: assets.length, done, failed, currentNumber: number });
      try {
        const keys = await uploadImage(albumId, 'sticker', assets[i]);
        const { error: rpcErr } = await addSticker({
          album_id: albumId,
          number,
          name: `#${String(number).padStart(2, '0')}`,
          rarity: 'common',
          thumb_key: keys.thumb_key,
          large_key: keys.large_key,
        });
        if (rpcErr) throw rpcErr;
        done += 1;
      } catch (err: any) {
        failed += 1;
        lastError = errorMessage(err);
        console.warn(`[bulk] sticker #${number} failed:`, err);
      }
      setProgress({ total: assets.length, done, failed, currentNumber: null });
    }

    setRunning(false);
    setProgress(null);
    onFinished();
    setSummary({ done, failed, lastError });
  }

  function requestCancel() {
    if (!running) {
      onClose();
      return;
    }
    // En web Alert.alert no existe (no-op): detenemos directo. Lo ya subido
    // se conserva igual, así que no es destructivo.
    if (Platform.OS === 'web') {
      shouldStopRef.current = true;
      return;
    }
    Alert.alert(
      'Cancelar carga',
      'Las figuritas ya subidas se guardan. ¿Detener?',
      [
        { text: 'Seguir', style: 'cancel' },
        { text: 'Detener', style: 'destructive', onPress: () => { shouldStopRef.current = true; } },
      ],
    );
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      onRequestClose={requestCancel}
      dismissable={!running}
      title="Carga masiva"
    >
      {summary ? (
        <>
          <View style={styles.doneRow}>
            <Feather
              name={summary.failed === 0 ? 'check-circle' : 'alert-circle'}
              size={22}
              color={summary.failed === 0 ? Colors.green : Colors.amberWarn ?? Colors.red}
            />
            <Text style={styles.doneTitle}>
              {summary.failed === 0 ? '¡Listo!' : 'Carga parcial'}
            </Text>
          </View>
          <Text style={styles.body}>
            Se {summary.done === 1 ? 'cargó' : 'cargaron'} {summary.done} figurita
            {summary.done === 1 ? '' : 's'}.
            {summary.failed > 0 ? ` Fallaron ${summary.failed}.` : ''}
            {summary.lastError ? `\n\nÚltimo error: ${summary.lastError}` : ''}
          </Text>
          <View style={sheetStyles.actions}>
            <Button label="Listo" onPress={onClose} />
          </View>
        </>
      ) : !running ? (
        <>
          <Text style={styles.body}>
            Elegí varias imágenes del rollo y las asignamos a los próximos números
            libres ({freeCount} disponibles). Cada figurita se crea con nombre
            "#NN" y rareza común — podés editarlas después desde la grilla.
          </Text>

          <View style={styles.infoRow}>
            <Feather name="info" size={16} color={Colors.muted} />
            <Text style={styles.infoText}>
              Asignación en orden: primer foto → próximo número libre, y así.
            </Text>
          </View>

          <View style={sheetStyles.actions}>
            <Button label="Cancelar" variant="outline" onPress={onClose} />
            <Button
              label={freeCount === 0 ? 'Sin lugar' : 'Elegir imágenes'}
              onPress={pickAndUpload}
              disabled={freeCount === 0}
            />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.body}>
            Subiendo {progress?.done ?? 0} de {progress?.total ?? 0}…
            {progress?.currentNumber !== null && progress?.currentNumber !== undefined
              ? ` (#${String(progress.currentNumber).padStart(2, '0')})`
              : ''}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress ? (progress.done / Math.max(1, progress.total)) * 100 : 0}%`,
                },
              ]}
            />
          </View>
          {progress && progress.failed > 0 && (
            <Text style={styles.warn}>{progress.failed} fallidas hasta ahora</Text>
          )}
          <View style={sheetStyles.actions}>
            <Button label="Detener" variant="outline" onPress={requestCancel} />
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    color: Colors.inkSoft,
    lineHeight: 22,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  doneTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '800',
    color: Colors.ink,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    backgroundColor: Colors.paper2,
    padding: Spacing.md,
    borderRadius: Radius.card,
  },
  infoText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    lineHeight: 18,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.paper2,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: Spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.red,
  },
  warn: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabel,
    color: Colors.amberWarn ?? Colors.red,
    letterSpacing: 1,
    marginTop: Spacing.sm,
  },
});
