import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ImageUploadCard } from '@/components/image-upload-card';
import { RarityInfoLine } from '@/components/rarity-info-line';
import { RarityPills } from '@/components/rarity-pills';
import { ScreenHeader } from '@/components/screen-header';
import { TextInput } from '@/components/text-input';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import type { Sticker } from '@/lib/queries/albums';
import type { PackConfig } from '@/lib/queries/economy';
import {
  deleteSticker,
  updateSticker,
  type Rarity,
} from '@/lib/queries/stickers';
import { useIsPro } from '@/lib/queries/subscriptions';
import { uploadImage, type UploadedKeys } from '@/lib/queries/uploads';
import { useDesktopCap } from '@/lib/use-is-desktop';
import { errorMessage } from '@/lib/errors';

interface Props {
  sticker: Sticker;
  packConfig?: PackConfig | null;
}

// Vista de edición de figurita para el owner del álbum (solo en draft).
export function EditStickerView({ sticker, packConfig }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const desktopCap = useDesktopCap(560);
  const { isPro } = useIsPro();

  const [name, setName] = useState('');
  const [rarity, setRarity] = useState<Rarity>('common');
  const [pendingKeys, setPendingKeys] = useState<UploadedKeys | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Confirm de borrado inline (dos toques). Antes era Alert.alert, que es
  // no-op en react-native-web → en web el botón no hacía nada.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setName(sticker.name);
    setRarity(sticker.rarity);
  }, [sticker]);

  useEffect(() => {
    if (!isPro && rarity !== 'common') setRarity('common');
  }, [isPro, rarity]);

  const currentThumbKey = pendingKeys?.thumb_key ?? sticker.thumb_key;
  const canSave = name.trim().length > 0 && !uploading && !saving && !deleting;

  async function onPicked(asset: import('expo-image-picker').ImagePickerAsset) {
    setUploading(true);
    try {
      const keys = await uploadImage(sticker.album_id, 'sticker', asset);
      setPendingKeys(keys);
    } catch (err: any) {
      Alert.alert('Error', errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function onSave() {
    Keyboard.dismiss();
    setSaving(true);
    const { error } = await updateSticker({
      sticker_id: sticker.id,
      name: name.trim(),
      rarity,
      thumb_key: pendingKeys?.thumb_key,
      large_key: pendingKeys?.large_key,
    });
    setSaving(false);
    if (error) {
      Alert.alert('No se pudo guardar', errorMessage(error));
      return;
    }
    router.back();
  }

  async function onDelete() {
    setDeleteError(null);
    setDeleting(true);
    const { error } = await deleteSticker(sticker.id);
    setDeleting(false);
    if (error) {
      setConfirmingDelete(false);
      setDeleteError(errorMessage(error));
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={desktopCap}>
        <ScreenHeader title={`Figurita #${sticker.number}`} back />
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, desktopCap]} keyboardShouldPersistTaps="handled">
        <View style={styles.imageRow}>
          <View style={{ width: 180 }}>
            <ImageUploadCard
              thumbKey={currentThumbKey}
              largeKey={pendingKeys?.large_key ?? sticker.large_key}
              label="Foto"
              aspect={[4, 5]}
              onPicked={onPicked}
              busy={uploading}
            />
          </View>
          {pendingKeys && (
            <Text style={styles.pendingHint}>
              Nueva foto subida. Tocá "Guardar cambios" para aplicarla.
            </Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>NOMBRE</Text>
          <TextInput value={name} onChangeText={setName} maxLength={60} />
        </View>

        {isPro ? (
          <View style={styles.field}>
            <Text style={styles.label}>RAREZA</Text>
            <RarityPills value={rarity} onChange={setRarity} />
            <RarityInfoLine rarity={rarity} packConfig={packConfig} />
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={styles.label}>RAREZA</Text>
            <Text style={styles.proHint}>
              En el plan Free todas las figuritas son comunes.
            </Text>
            <RarityInfoLine rarity="common" packConfig={packConfig} />
          </View>
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          // Arriba de la barra del sistema (3 botones Android / pill de gestos).
          { paddingBottom: Math.max(insets.bottom + Spacing.sm, Spacing.xl) },
        ]}
      >
        <Button
          label={saving ? 'Guardando...' : 'Guardar cambios'}
          onPress={onSave}
          disabled={!canSave}
          loading={saving}
        />
        {confirmingDelete ? (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>
              ¿Borrar la #{sticker.number}? Esta acción no se puede deshacer.
            </Text>
            <View style={styles.confirmRow}>
              <View style={{ flex: 1 }}>
                <Button
                  label="Cancelar"
                  variant="outline"
                  onPress={() => setConfirmingDelete(false)}
                  disabled={deleting}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label={deleting ? 'Eliminando...' : 'Sí, eliminar'}
                  onPress={onDelete}
                  loading={deleting}
                  disabled={deleting}
                />
              </View>
            </View>
          </View>
        ) : (
          <Button
            label="Eliminar figurita"
            variant="outline"
            onPress={() => {
              setDeleteError(null);
              setConfirmingDelete(true);
            }}
            disabled={uploading || saving}
          />
        )}
        {deleteError && <Text style={styles.deleteError}>{deleteError}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    color: Colors.red,
    padding: Spacing.xl,
    textAlign: 'center',
  },
  scroll: {
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.md,
    paddingBottom: 220,
    gap: Spacing.xl,
  },
  imageRow: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  pendingHint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.green,
    textAlign: 'center',
  },
  field: { gap: Spacing.sm },
  label: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
  },
  proHint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    backgroundColor: Colors.paper2,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  footer: {
    paddingHorizontal: Spacing.screenX,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  confirmBox: {
    gap: Spacing.sm,
    backgroundColor: Colors.paper2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.red,
    padding: Spacing.md,
  },
  confirmText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.ink,
    lineHeight: 19,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  deleteError: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.red,
    textAlign: 'center',
  },
});
