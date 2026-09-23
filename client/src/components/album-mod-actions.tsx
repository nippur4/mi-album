import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { adminDeleteAlbum, blockAlbum, unblockAlbum } from '@/lib/queries/admin';
import { errorMessage } from '@/lib/errors';

interface Props {
  albumId: string;
  blocked: boolean;
  onChanged: () => void;
}

// Acciones de moderación de un álbum, compartidas por Reports y Moderar:
//   - Ver: abre el álbum para revisar el contenido.
//   - Bloquear / Desbloquear: reversible (lo saca del carrusel + frena joins).
//   - Eliminar: borrado definitivo, con confirmación inline de DOS toques
//     (Alert.alert es no-op en web, y el admin se usa en desktop).
export function AlbumModActions({ albumId, blocked, onChanged }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doBlock() {
    setError(null);
    setBusy(true);
    const { error: e } = blocked ? await unblockAlbum(albumId) : await blockAlbum(albumId);
    setBusy(false);
    if (e) {
      setError(errorMessage(e));
      return;
    }
    onChanged();
  }

  async function doDelete() {
    setError(null);
    setBusy(true);
    const { error: e } = await adminDeleteAlbum(albumId);
    setBusy(false);
    if (e) {
      setConfirmDelete(false);
      setError(errorMessage(e));
      return;
    }
    onChanged();
  }

  return (
    <View style={styles.wrap}>
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.row}>
        <Pressable
          onPress={() => router.push(`/album/${albumId}` as any)}
          disabled={busy}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.btnText}>Ver álbum</Text>
        </Pressable>
        <Pressable
          onPress={doBlock}
          disabled={busy}
          style={({ pressed }) => [styles.btn, blocked && styles.btnWarn, pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.btnText, blocked && styles.btnWarnText]}>
            {busy ? '...' : blocked ? 'Desbloquear' : 'Bloquear'}
          </Text>
        </Pressable>
        <Pressable
          onPress={confirmDelete ? doDelete : () => setConfirmDelete(true)}
          disabled={busy}
          style={({ pressed }) => [styles.btn, styles.btnDanger, pressed && { opacity: 0.6 }]}
        >
          <Text style={[styles.btnText, styles.btnDangerText]}>
            {confirmDelete ? '¿Seguro? Eliminar' : 'Eliminar'}
          </Text>
        </Pressable>
      </View>
      {confirmDelete && (
        <Text style={styles.dangerHint}>
          Borrado definitivo: figuritas, colecciones y membresías. No se puede deshacer.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  btn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.paper,
  },
  btnText: { fontFamily: FontFamily.body, fontSize: FontSize.bodySmall, fontWeight: '700', color: Colors.ink },
  btnWarn: { borderColor: Colors.gold, backgroundColor: Colors.amberWarnBg },
  btnWarnText: { color: Colors.goldDark },
  btnDanger: { borderColor: Colors.red },
  btnDangerText: { color: Colors.red },
  dangerHint: { fontFamily: FontFamily.body, fontSize: FontSize.caption, color: Colors.red },
  error: { fontFamily: FontFamily.body, fontSize: FontSize.bodySmall, color: Colors.red },
});
