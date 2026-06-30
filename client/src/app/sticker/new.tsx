import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { RarityInfoLine } from '@/components/rarity-info-line';
import { RarityPills } from '@/components/rarity-pills';
import { ScreenHeader } from '@/components/screen-header';
import { Stepper } from '@/components/stepper';
import { TextInput } from '@/components/text-input';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';
import { useAlbumDetail } from '@/lib/queries/albums';
import { addSticker, type Rarity } from '@/lib/queries/stickers';
import { useIsPro } from '@/lib/queries/subscriptions';
import { uploadImage, type UploadedKeys } from '@/lib/queries/uploads';
import { errorMessage } from '@/lib/errors';

export default function NewStickerScreen() {
  const { albumId, number: numberParam } = useLocalSearchParams<{
    albumId: string;
    number?: string;
  }>();
  const router = useRouter();
  const { album, stickers } = useAlbumDetail(albumId);
  const { isPro } = useIsPro();

  // Set de números ya ocupados — el Stepper los saltará
  const usedNumbers = new Set(stickers.map((s) => s.number));

  const [number, setNumber] = useState(() => {
    const fromParam = numberParam ? parseInt(numberParam, 10) : NaN;
    return Number.isFinite(fromParam) && fromParam >= 1 ? fromParam : 1;
  });
  const [name, setName] = useState('');
  const [rarity, setRarity] = useState<Rarity>('common');
  const [keys, setKeys] = useState<UploadedKeys | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Cuando se cargan los stickers, si no llegó número por param,
  // ajustamos al próximo libre. Solo una vez (initialSetRef).
  const initialSetRef = useRef(false);
  useEffect(() => {
    if (initialSetRef.current) return;
    if (!album) return;
    if (numberParam) {
      initialSetRef.current = true;
      return;
    }
    setNumber(nextFreeNumber(usedNumbers, album.total_stickers));
    initialSetRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [album, stickers.length]);

  // Free no puede elegir rareza: forzamos a 'common'.
  useEffect(() => {
    if (!isPro && rarity !== 'common') setRarity('common');
  }, [isPro, rarity]);

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
          <Stepper
            value={number}
            onChange={setNumber}
            min={1}
            max={max}
            step={1}
            excluded={usedNumbers}
          />
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

        {isPro ? (
          <View style={styles.field}>
            <Text style={styles.label}>RAREZA</Text>
            <RarityPills value={rarity} onChange={setRarity} />
            <RarityInfoLine rarity={rarity} packConfig={album?.pack_config as any} />
          </View>
        ) : (
          <View style={styles.field}>
            <Text style={styles.label}>RAREZA</Text>
            <Text style={styles.proHint}>
              En el plan Free todas las figuritas son comunes. Suscribite a Pro
              para definir rarezas (rara, épica, legendaria) y configurar las
              probabilidades del sobre.
            </Text>
            <RarityInfoLine rarity="common" packConfig={album?.pack_config as any} />
          </View>
        )}
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
  fineprint: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.caption,
    color: Colors.muted,
    textAlign: 'center',
  },
});
