import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet, sheetStyles } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { TextInput } from '@/components/text-input';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { deleteAccount } from '@/lib/auth';
import { errorMessage } from '@/lib/errors';

const CONFIRM_WORD = 'ELIMINAR';

interface Props {
  visible: boolean;
  onClose: () => void;
}

// Confirmación de borrado de cuenta: el usuario debe tipear "ELIMINAR" para
// habilitar el botón destructivo. El error se muestra inline (Alert es no-op en
// web, decisión #31). Si sale bien, deleteAccount() cierra la sesión y el
// _layout redirige a login — no hace falta navegar a mano.
export function DeleteAccountModal({ visible, onClose }: Props) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setValue('');
      setError(null);
    }
  }

  const canDelete = value.trim().toUpperCase() === CONFIRM_WORD && !busy;

  async function handleDelete() {
    setError(null);
    setBusy(true);
    try {
      await deleteAccount();
      // Sesión cerrada: el redirect del _layout lleva a login. No reseteamos
      // busy a propósito (la pantalla desaparece).
    } catch (err) {
      setBusy(false);
      setError(errorMessage(err));
    }
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Eliminar cuenta"
      avoidKeyboard="both"
      dismissable={!busy}
    >
      <Text style={styles.warn}>
        Esta acción es <Text style={styles.bold}>permanente</Text>. Se borran tu perfil,
        tu colección de figuritas y tus datos personales.
      </Text>
      <Text style={styles.warn}>
        Los álbumes que creaste y que otras personas ya están jugando no se borran: quedan
        en solo lectura para que esos jugadores conserven su colección.
      </Text>

      <Text style={sheetStyles.label}>ESCRIBÍ “{CONFIRM_WORD}” PARA CONFIRMAR</Text>
      <TextInput
        value={value}
        onChangeText={setValue}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder={CONFIRM_WORD}
        editable={!busy}
      />
      {error && <Text style={sheetStyles.error}>{error}</Text>}

      <View style={sheetStyles.actions}>
        <Button label="Cancelar" variant="outline" onPress={onClose} disabled={busy} />
        <Button
          label="Eliminar mi cuenta"
          onPress={handleDelete}
          disabled={!canDelete}
          loading={busy}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  warn: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
    color: Colors.ink,
  },
});
