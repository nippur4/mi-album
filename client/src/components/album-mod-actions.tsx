import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TextInput } from '@/components/text-input';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { adminDeleteAlbum, blockAlbum, unblockAlbum } from '@/lib/queries/admin';
import { PROTECTED_ALBUM_IDS } from '@/lib/queries/albums';
import { errorMessage } from '@/lib/errors';

interface Props {
  albumId: string;
  blocked: boolean;
  onChanged: () => void;
}

// Acciones de moderación de un álbum, compartidas por Reports y Moderar:
//   - Ver: abre el álbum para revisar el contenido.
//   - Bloquear / Desbloquear: reversible (lo saca del carrusel + frena joins).
//   - Eliminar: borrado definitivo. Confirmación FUERTE — hay que escribir la
//     palabra "eliminar" (no basta un doble tap). Los álbumes especiales
//     curados NO se pueden eliminar: el botón no aparece y el server igual lo
//     rechaza (P0201).
export function AlbumModActions({ albumId, blocked, onChanged }: Props) {
  const router = useRouter();
  const isProtected = PROTECTED_ALBUM_IDS.has(albumId);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canDelete = text.trim().toLowerCase() === 'eliminar';

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
    if (!canDelete) return;
    setError(null);
    setBusy(true);
    const { error: e } = await adminDeleteAlbum(albumId);
    setBusy(false);
    if (e) {
      setError(errorMessage(e));
      return;
    }
    onChanged();
  }

  function openConfirm() {
    setText('');
    setError(null);
    setConfirming(true);
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
        {isProtected ? (
          <View style={styles.protectedChip}>
            <Text style={styles.protectedText}>🔒 Protegido</Text>
          </View>
        ) : !confirming ? (
          <Pressable
            onPress={openConfirm}
            disabled={busy}
            style={({ pressed }) => [styles.btn, styles.btnDanger, pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.btnText, styles.btnDangerText]}>Eliminar</Text>
          </Pressable>
        ) : null}
      </View>

      {isProtected && (
        <Text style={styles.protectedHint}>
          Álbum especial curado: no se puede eliminar.
        </Text>
      )}

      {confirming && !isProtected && (
        <View style={styles.confirmBox}>
          <Text style={styles.confirmLabel}>
            Borrado <Text style={styles.strong}>definitivo</Text> (figuritas, colecciones y
            membresías, cascade). Para confirmar, escribí la palabra{' '}
            <Text style={styles.strong}>eliminar</Text>:
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="eliminar"
            editable={!busy}
          />
          <View style={styles.confirmActions}>
            <Pressable
              onPress={() => {
                setConfirming(false);
                setText('');
              }}
              disabled={busy}
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.btnText}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={doDelete}
              disabled={!canDelete || busy}
              style={({ pressed }) => [
                styles.btn,
                styles.btnDanger,
                (!canDelete || busy) && styles.btnDisabled,
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={[styles.btnText, styles.btnDangerText]}>
                {busy ? '...' : 'Eliminar definitivamente'}
              </Text>
            </Pressable>
          </View>
        </View>
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
  btnDisabled: { opacity: 0.4 },
  error: { fontFamily: FontFamily.body, fontSize: FontSize.bodySmall, color: Colors.red },
  strong: { fontWeight: '800', color: Colors.ink },
  confirmBox: {
    backgroundColor: Colors.paper,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.red,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginTop: 4,
  },
  confirmLabel: { fontFamily: FontFamily.body, fontSize: FontSize.bodySmall, color: Colors.inkSoft, lineHeight: 18 },
  confirmActions: { flexDirection: 'row', gap: Spacing.sm },
  protectedChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.paper3,
  },
  protectedText: { fontFamily: FontFamily.body, fontSize: FontSize.bodySmall, fontWeight: '700', color: Colors.muted },
  protectedHint: { fontFamily: FontFamily.body, fontSize: FontSize.caption, color: Colors.muted },
});
