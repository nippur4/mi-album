import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ImageUploadCard } from '@/components/image-upload-card';
import { RarityPills } from '@/components/rarity-pills';
import { ScreenHeader } from '@/components/screen-header';
import { Stepper } from '@/components/stepper';
import { TextInput } from '@/components/text-input';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAlbumDetail } from '@/lib/queries/albums';
import { addSticker, type Rarity } from '@/lib/queries/stickers';
import { uploadImage, type UploadedKeys } from '@/lib/queries/uploads';
import { errorMessage } from '@/lib/errors';

export default function NewStickerScreen() {
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const router = useRouter();
  const { album, stickers } = useAlbumDetail(albumId);

  // Próximo número libre como sugerencia inicial
  const usedNumbers = new Set(stickers.map((s) => s.number));
  const suggested = nextFreeNumber(usedNumbers, album?.total_stickers ?? 1);

  const [number, setNumber] = useState(suggested);
  const [name, setName] = useState('');
  const [rarity, setRarity] = useState<Rarity>('common');
  const [keys, setKeys] = useState<UploadedKeys | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const max = album?.total_stickers ?? 1;
  const numberTaken = usedNumbers.has(number);
  const canSubmit =
    !!albumId &&
    name.trim().length > 0 &&
    number >= 1 &&
    number <= max &&
    !numberTaken &&
    !!keys &&
    !uploading &&
    !submitting;

  async function onPicked(asset: import('expo-image-picker').ImagePickerAsset) {
    if (!albumId) return;
    setUploading(true);
    try {
      const k = await uploadImage(albumId, 'sticker', asset);
      setKeys(k);
    } catch (err: any) {
      Alert.alert('Error', errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit() {
    if (!albumId || !keys) return;
    Keyboard.dismiss();
    setSubmitting(true);
    const { error } = await addSticker({
      album_id: albumId,
      number,
      name: name.trim(),
      rarity,
      thumb_key: keys.thumb_key,
      large_key: keys.large_key,
    });
    setSubmitting(false);
    if (error) {
      Alert.alert('No se pudo cargar', errorMessage(error));
      return;
    }
    router.back();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Nueva figurita" back />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.imageRow}>
          <View style={{ width: 180 }}>
            <ImageUploadCard
              thumbKey={keys?.thumb_key ?? null}
              label="Foto"
              aspect={[4, 5]}
              onPicked={onPicked}
              busy={uploading}
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>NÚMERO</Text>
          <Stepper value={number} onChange={setNumber} min={1} max={max} step={1} />
          {numberTaken && (
            <Text style={styles.warn}>Ese número ya está cargado en este álbum.</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>NOMBRE</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Glorp el Voraz"
            autoCapitalize="words"
            maxLength={60}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>RAREZA</Text>
          <RarityPills value={rarity} onChange={setRarity} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={submitting ? 'Guardando...' : 'Cargar figurita'}
          onPress={onSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
        {!keys && <Text style={styles.fineprint}>Primero subí una imagen.</Text>}
      </View>
    </SafeAreaView>
  );
}

function nextFreeNumber(used: Set<number>, max: number): number {
  for (let i = 1; i <= max; i++) {
    if (!used.has(i)) return i;
  }
  return max;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  scroll: {
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.md,
    paddingBottom: 200,
    gap: Spacing.xl,
  },
  imageRow: {
    alignItems: 'center',
  },
  field: { gap: Spacing.sm },
  label: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
  },
  warn: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.amberWarn,
  },
  footer: {
    paddingHorizontal: Spacing.screenX,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  fineprint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.muted,
    textAlign: 'center',
  },
});
