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
  // Otros jugadores del álbum. > 0 → el álbum NO se borra, se RETIRA (queda
  // read_only + archivado, reversible) y el modal muestra un solo paso sin
  // email. 0 → borrado definitivo en dos pasos con email.
  playerCount: number;
  // Email de la sesión — el paso 2 (solo borrado) exige tipearlo idéntico. El
  // server lo revalida contra el JWT (fn_delete_album), esto es solo la UX.
  sessionEmail: string;
  onClose: () => void;
  // El álbum se eliminó o retiró: el caller navega afuera e invalida caches.
  onDeleted: () => void;
}

// Eliminar/retirar un álbum, in-modal (Alert es no-op en web):
//   - Con jugadores (playerCount > 0): un paso "Cerrar álbum" → el server lo
//     retira (read_only + owner_hidden). Los jugadores conservan todo.
//   - Sin jugadores: dos pasos (advertencia + tipear el email) → hard delete.
export function DeleteAlbumModal({
  visible,
  albumId,
  albumName,
  playerCount,
  sessionEmail,
  onClose,
  onDeleted,
}: Props) {
  const retire = playerCount > 0;
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
    if (deleting) return;
    // En el branch de borrado exigimos el email; en el de retirar no aplica.
    if (!retire && !emailMatches) return;
    setError(null);
    setDeleting(true);
    const { error: rpcErr } = await deleteAlbum(albumId, retire ? '' : email.trim());
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
      title={retire ? 'Cerrar álbum' : 'Eliminar álbum'}
      avoidKeyboard="both"
    >
      {retire ? (
        <>
          <View style={styles.warnBox}>
            <Feather name="archive" size={18} color={Colors.red} />
            <Text style={styles.warnText}>
              <Text style={styles.warnBold}>{albumName}</Text> lo están jugando{' '}
              {playerCount} {playerCount === 1 ? 'persona' : 'personas'}. Al
              eliminarlo se cierra: no se emiten más sobres y sale de tus listas,
              pero los jugadores conservan sus figuritas. Podés reactivarlo
              desarchivándolo.
            </Text>
          </View>
          {error && <Text style={sheetStyles.error}>{error}</Text>}

          <View style={sheetStyles.actions}>
            <Button label="Cancelar" variant="outline" onPress={onClose} disabled={deleting} />
            <Button
              label={deleting ? 'Cerrando...' : 'Cerrar álbum'}
              onPress={handleDelete}
              loading={deleting}
              disabled={deleting}
            />
          </View>
        </>
      ) : step === 1 ? (
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
