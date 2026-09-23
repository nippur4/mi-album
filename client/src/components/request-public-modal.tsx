import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet, sheetStyles } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { TextInput } from '@/components/text-input';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { requestAlbumPublic } from '@/lib/queries/albums';
import { errorMessage } from '@/lib/errors';

interface Props {
  visible: boolean;
  albumId: string;
  onClose: () => void;
  onRequested: () => void;
}

// El owner solicita que su álbum sea público. Pide un MOTIVO y exige una
// declaración: el álbum no tiene contenido sensible y quien lo pide es dueño de
// las imágenes (o tiene derecho a usarlas, sin infringir derechos de autor).
export function RequestPublicModal({ visible, albumId, onClose, onRequested }: Props) {
  const [note, setNote] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setNote('');
      setAccepted(false);
      setError(null);
    }
  }

  const canSubmit = note.trim().length > 0 && accepted && !busy;

  async function handleSubmit() {
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    const { error: rpcErr } = await requestAlbumPublic(albumId, note.trim());
    setBusy(false);
    if (rpcErr) {
      setError(errorMessage(rpcErr));
      return;
    }
    onRequested();
    onClose();
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Solicitar ser público"
      avoidKeyboard="both"
      dismissable={!busy}
    >
      <Text style={sheetStyles.hint}>
        Los álbumes públicos aparecen en el inicio, visibles para cualquiera. Solo
        aprobamos álbumes <Text style={styles.strong}>sin contenido sensible</Text> y
        cuyo creador sea <Text style={styles.strong}>dueño de las imágenes</Text> (o
        tenga derecho a usarlas, sin infringir derechos de autor).
      </Text>

      <Text style={sheetStyles.label}>¿POR QUÉ QUERÉS QUE SEA PÚBLICO?</Text>
      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Contanos de qué trata y por qué debería ser público…"
        multiline
        maxLength={500}
        editable={!busy}
      />

      <Pressable
        onPress={() => setAccepted((v) => !v)}
        disabled={busy}
        style={({ pressed }) => [styles.check, pressed && { opacity: 0.7 }]}
      >
        <View style={[styles.box, accepted && styles.boxOn]}>
          {accepted && <Feather name="check" size={14} color={Colors.paper} />}
        </View>
        <Text style={styles.checkText}>
          Declaro que este álbum no tiene contenido sensible y que soy dueño de las
          imágenes o tengo derecho a usarlas, sin infringir derechos de autor.
        </Text>
      </Pressable>

      {error && <Text style={sheetStyles.error}>{error}</Text>}

      <View style={sheetStyles.actions}>
        <Button label="Cancelar" variant="outline" onPress={onClose} disabled={busy} />
        <Button
          label={busy ? 'Enviando…' : 'Enviar solicitud'}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={busy}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  strong: { color: Colors.ink, fontWeight: '700' },
  check: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxOn: {
    backgroundColor: Colors.green,
    borderColor: Colors.green,
  },
  checkText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    lineHeight: 18,
  },
});
