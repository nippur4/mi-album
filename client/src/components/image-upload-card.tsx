import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { r2Url } from '@/lib/storage';

interface Props {
  // key actual de la imagen subida (thumb_key). null si no hay imagen.
  thumbKey: string | null;
  label: string;
  hint?: string;
  aspect?: [number, number];
  onPicked: (asset: ImagePicker.ImagePickerAsset) => Promise<void>;
  // Si true, muestra ActivityIndicator overlay (uploading)
  busy?: boolean;
}

// Card de upload de imagen. Estado vacío = placeholder con + y label.
// Estado lleno = imagen + tap para reemplazar.
export function ImageUploadCard({
  thumbKey,
  label,
  hint,
  aspect = [4, 5],
  onPicked,
  busy,
}: Props) {
  const [picking, setPicking] = useState(false);

  async function pick() {
    if (busy || picking) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos para cargar la imagen.');
      return;
    }
    setPicking(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect,
        quality: 0.9,
      });
      if (result.canceled) return;
      await onPicked(result.assets[0]);
    } catch (err: any) {
      Alert.alert('Error', err?.error ?? err?.message ?? 'No pudimos subir la imagen.');
    } finally {
      setPicking(false);
    }
  }

  const url = r2Url(thumbKey);
  const showLoader = busy || picking;
  const ratio = aspect[0] / aspect[1];

  return (
    <Pressable onPress={pick} disabled={showLoader} style={[styles.card, { aspectRatio: ratio }]}>
      {url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.plus}>+</Text>
          <Text style={styles.label}>{label}</Text>
          {hint && <Text style={styles.hint}>{hint}</Text>}
        </View>
      )}
      {showLoader && (
        <View style={styles.overlay}>
          <ActivityIndicator color={Colors.paper} />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderRadius: Radius.cardLg,
    backgroundColor: Colors.paper3,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.borderStrong,
    overflow: 'hidden',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
  },
  plus: {
    fontFamily: FontFamily.display,
    fontSize: 44,
    color: Colors.muted,
    lineHeight: 44,
  },
  label: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    fontWeight: '700',
    color: Colors.inkSoft,
    textAlign: 'center',
  },
  hint: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(42,30,22,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
