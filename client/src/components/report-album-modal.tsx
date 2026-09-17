import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet, sheetStyles } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { TextInput } from '@/components/text-input';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { reportAlbum } from '@/lib/queries/moderation';
import { errorMessage } from '@/lib/errors';

const REASONS = [
  'Contenido inapropiado u ofensivo',
  'Spam o engañoso',
  'Infringe derechos de autor',
  'Otro',
];

interface Props {
  visible: boolean;
  albumId: string;
  onClose: () => void;
}

// Reporte de un álbum: el usuario elige un motivo y opcionalmente agrega detalle.
// Envía a fn_report_album. Feedback inline (Alert es no-op en web).
export function ReportAlbumModal({ visible, albumId, onClose }: Props) {
  const [reason, setReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setReason(null);
      setDetails('');
      setError(null);
      setDone(false);
    }
  }

  async function handleSubmit() {
    if (!reason || busy) return;
    setError(null);
    setBusy(true);
    const { error: rpcErr } = await reportAlbum(albumId, reason, details);
    setBusy(false);
    if (rpcErr) {
      setError(errorMessage(rpcErr));
      return;
    }
    setDone(true);
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Reportar álbum"
      avoidKeyboard="both"
      dismissable={!busy}
    >
      {done ? (
        <>
          <Text style={styles.doneText}>
            Gracias. Recibimos tu reporte y lo vamos a revisar.
          </Text>
          <View style={sheetStyles.actions}>
            <Button label="Listo" onPress={onClose} />
          </View>
        </>
      ) : (
        <>
          <Text style={sheetStyles.hint}>
            Contanos qué está mal con este álbum. Vamos a revisarlo.
          </Text>

          <View style={styles.reasons}>
            {REASONS.map((r) => {
              const selected = reason === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setReason(r)}
                  style={({ pressed }) => [
                    styles.reasonChip,
                    selected && styles.reasonChipOn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.reasonText, selected && styles.reasonTextOn]}>{r}</Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={sheetStyles.label}>DETALLE (OPCIONAL)</Text>
          <TextInput
            value={details}
            onChangeText={setDetails}
            placeholder="Contanos más…"
            multiline
            maxLength={500}
            editable={!busy}
          />
          {error && <Text style={sheetStyles.error}>{error}</Text>}

          <View style={sheetStyles.actions}>
            <Button label="Cancelar" variant="outline" onPress={onClose} disabled={busy} />
            <Button
              label="Enviar reporte"
              onPress={handleSubmit}
              disabled={!reason || busy}
              loading={busy}
            />
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  reasons: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  reasonChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.paper2,
  },
  reasonChipOn: {
    borderColor: Colors.red,
    backgroundColor: Colors.amberWarnBg,
  },
  reasonText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.ink,
  },
  reasonTextOn: {
    fontWeight: '700',
  },
  doneText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    color: Colors.ink,
    marginBottom: Spacing.md,
  },
});
