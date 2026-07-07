import Feather from '@expo/vector-icons/Feather';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BottomSheet, sheetStyles } from '@/components/bottom-sheet';
import { Button } from '@/components/button';
import { TextInput } from '@/components/text-input';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { deleteAlbum } from '@/lib/queries/albums';
import { errorMessage } from '@/lib/errors';

interface Props {
  visible: boolean;
  albumId: string;
  albumName: string;
  // Email de la sesión — el paso 2 exige tipearlo idéntico. El server lo
  // revalida contra el JWT (fn_delete_album), esto es solo la UX.
  sessionEmail: string;
  onClose: () => void;
  // El álbum ya no existe: el caller navega afuera e invalida caches.
  onDeleted: () => void;
}

// Eliminación definitiva de un álbum en dos pasos:
//   1. Advertencia de consecuencias (jugadores pierden su colección).
//   2. Confirmación tipeando el email de la cuenta.
// Todo in-modal (Alert es no-op en web).
export function DeleteAlbumModal({
  visible,
  albumId,
  albumName,
  sessionEmail,
  onClose,
  onDeleted,
}: Props) {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setStep(1);
      setEmail('');
      setError(null);
    }
  }, [visible]);

  const emailMatches =
    email.trim().toLowerCase() === sessionEmail.trim().toLowerCase() && sessionEmail !== '';

  async function handleDelete() {
    if (!emailMatches || deleting) return;
    setError(null);
    setDeleting(true);
    const { error: rpcErr } = await deleteAlbum(albumId, email.trim());
    setDeleting(false);
    if (rpcErr) {
      setError(errorMessage(rpcErr));
      return;
    }
    onDeleted();
  }

  return (
    <BottomSheet
      visible={visible}
      onClose={deleting ? () => {} : onClose}
      dismissable={!deleting}
      title="Eliminar álbum"
      avoidKeyboard="both"
    >
      {step === 1 ? (
        <>
          <View style={styles.warnBox}>
            <Feather name="alert-triangle" size={18} color={Colors.red} />
            <Text style={styles.warnText}>
              Vas a eliminar <Text style={styles.warnBold}>{albumName}</Text> para
              siempre. Se borran sus figuritas, las colecciones de TODOS los
              jugadores, sus sobres y los intercambios. No se puede deshacer.
            </Text>
          </View>
          <Text style={sheetStyles.hint}>
            Si solo querés sacarlo de tus listas, usá "Archivar álbum" — es
            reversible y los jugadores no pierden nada.
          </Text>

          <View style={sheetStyles.actions}>
            <Button label="Cancelar" variant="outline" onPress={onClose} />
            <Button label="Continuar" onPress={() => setStep(2)} />
          </View>
        </>
      ) : (
        <>
          <Text style={sheetStyles.label}>ESCRIBÍ TU EMAIL PARA CONFIRMAR</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder={sessionEmail}
          />
          <Text style={sheetStyles.hint}>
            Es el email de tu cuenta. Al confirmar, el álbum se elimina
            definitivamente.
          </Text>
          {error && <Text style={sheetStyles.error}>{error}</Text>}

          <View style={sheetStyles.actions}>
            <Button label="Cancelar" variant="outline" onPress={onClose} />
            <Button
              label={deleting ? 'Eliminando...' : 'Eliminar definitivamente'}
              onPress={handleDelete}
              disabled={!emailMatches || deleting}
              loading={deleting}
            />
          </View>
        </>
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.red,
    padding: Spacing.md,
  },
  warnText: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.ink,
    lineHeight: 19,
  },
  warnBold: {
    fontWeight: '800',
  },
});
