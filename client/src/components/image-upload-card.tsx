import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { PresetBackground } from '@/components/preset-background';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { isPreset, presetIdFromKey, r2Url } from '@/lib/storage';

interface Props {
  // key actual de la imagen subida (thumb_key). null si no hay imagen.
  thumbKey: string | null;
  // key del tamaño grande. Este card renderiza el preview a ancho completo
  // (~700px en desktop), donde el thumb se pixela — si hay largeKey se usa esa.
  largeKey?: string | null;
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
  largeKey,
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
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect,
        quality: 0.9,
      });
      if (result.canceled) return;
      await onPicked(result.assets[0]);
    } catch (err: any) {
      console.error('image-upload-card: pick/upload failed', err);
      let msg: string;
      if (typeof err === 'string') {
        msg = err;
      } else if (err && typeof err.error === 'string') {
        msg = err.error;
      } else if (err && typeof err.message === 'string') {
        msg = err.message;
      } else {
        try { msg = JSON.stringify(err, null, 2); } catch { msg = '[error sin detalle]'; }
      }
      Alert.alert('Error', msg);
    } finally {
      setPicking(false);
    }
  }

  const url = r2Url(largeKey ?? thumbKey);
  const isPresetKey = isPreset(thumbKey);
  const showLoader = busy || picking;
  const ratio = aspect[0] / aspect[1];
  const hasContent = isPresetKey || !!url;

  return (
    <Pressable onPress={pick} disabled={showLoader} style={[styles.card, { aspectRatio: ratio }]}>
      {isPresetKey ? (
        <PresetBackground id={presetIdFromKey(thumbKey!)} />
      ) : url ? (
        <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={styles.empty}>
          <Text style={styles.plus}>+</Text>
          <Text style={styles.label}>{label}</Text>
          {hint && <Text style={styles.hint}>{hint}</Text>}
        </View>
      )}
      {/* Badge arriba con el label, visible siempre que haya contenido. Sin
          contenido el label central ya lo cubre, así no duplicamos. */}
      {hasContent && (
        <View style={styles.labelBadge}>
          <Text style={styles.labelBadgeText}>{label.toUpperCase()}</Text>
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
  labelBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(42,30,22,0.7)',
    borderRadius: 4,
  },
  labelBadgeText: {
    fontFamily: FontFamily.mono,
    fontSize: 9,
    color: Colors.paper,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
});
