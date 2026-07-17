import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { EditPresetNameModal } from '@/components/edit-preset-name-modal';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { errorMessage } from '@/lib/errors';
import {
  createAdminPreset,
  deleteAdminPreset,
  updateAdminPreset,
  useAdminPresets,
  type PresetImage,
  type PresetKind,
} from '@/lib/queries/presets';
import { uploadPresetImage } from '@/lib/queries/uploads';
import { r2Url } from '@/lib/storage';
import { useDesktopCap } from '@/lib/use-is-desktop';
import { useFocusRefetchStale } from '@/lib/use-focus-refetch';

export default function AdminPresetsScreen() {
  const desktopCap = useDesktopCap(960);
  const { items, isRefetching, error, refetch } = useAdminPresets();
  const [uploadingFor, setUploadingFor] = useState<PresetKind | null>(null);
  const [renaming, setRenaming] = useState<PresetImage | null>(null);

  useFocusRefetchStale(['admin', 'presets']);

  async function pickAndUpload(kind: PresetKind) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tus fotos.');
      return;
    }
    const aspect: [number, number] =
      kind === 'cover' ? [4, 5] : kind === 'pack' ? [3, 4] : [1, 1];
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect,
      // 1 = sin recompresión del picker (la compresión la hace uploads.ts).
      quality: 1,
    });
    if (result.canceled) return;

    setUploadingFor(kind);
    try {
      const up = await uploadPresetImage(kind, result.assets[0]);
      const defaultName =
        kind === 'cover'
          ? 'Carátula sin nombre'
          : kind === 'pack'
            ? 'Sobre sin nombre'
            : 'Avatar sin nombre';
      const { error: rpcErr } = await createAdminPreset({
        preset_id: up.preset_id,
        kind,
        name: defaultName,
        thumb_key: up.thumb_key,
        large_key: up.large_key,
      });
      if (rpcErr) throw rpcErr;
      await refetch();
    } catch (err: any) {
      Alert.alert('Error', errorMessage(err));
    } finally {
      setUploadingFor(null);
    }
  }

  const covers = items.filter((p) => p.kind === 'cover');
  const packs = items.filter((p) => p.kind === 'pack');
  const avatars = items.filter((p) => p.kind === 'avatar');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={desktopCap}>
        <ScreenHeader
          title="Plantillas"
          back
          right={<Feather name="image" size={20} color={Colors.ink} />}
        />
        <View style={styles.intro}>
          <Text style={styles.introText}>
            Carátulas (4:5) y sobres (3:4) que los owners pueden elegir, y avatares (1:1)
            que cualquier user puede elegir como foto de perfil. Se suman a los colores
            predefinidos en el caso de carátulas y sobres.
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, desktopCap]}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={Colors.red} />
        }
      >
        {error && (
          <View style={styles.center}>
            <Text style={styles.errorText}>{errorMessage({ message: error })}</Text>
          </View>
        )}

        <PresetKindSection
          title="Carátulas (4:5)"
          items={covers}
          uploading={uploadingFor === 'cover'}
          onUpload={() => pickAndUpload('cover')}
          onRename={setRenaming}
          onChanged={refetch}
        />

        <PresetKindSection
          title="Sobres (3:4)"
          items={packs}
          uploading={uploadingFor === 'pack'}
          onUpload={() => pickAndUpload('pack')}
          onRename={setRenaming}
          onChanged={refetch}
        />

        <PresetKindSection
          title="Avatares (1:1)"
          items={avatars}
          uploading={uploadingFor === 'avatar'}
          onUpload={() => pickAndUpload('avatar')}
          onRename={setRenaming}
          onChanged={refetch}
        />
      </ScrollView>

      <EditPresetNameModal
        preset={renaming}
        onClose={() => setRenaming(null)}
        onSaved={refetch}
      />
    </SafeAreaView>
  );
}

function PresetKindSection({
  title,
  items,
  uploading,
  onUpload,
  onRename,
  onChanged,
}: {
  title: string;
  items: PresetImage[];
  uploading: boolean;
  onUpload: () => void;
  onRename: (p: PresetImage) => void;
  onChanged: () => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.list}>
        {items.length === 0 && (
          <Text style={styles.emptyText}>Aún no hay imágenes en esta categoría.</Text>
        )}
        {items.map((p) => (
          <PresetRow key={p.id} preset={p} onRename={onRename} onChanged={onChanged} />
        ))}
      </View>
      <Button
        label={uploading ? 'Subiendo…' : '+ Agregar imagen'}
        variant="outline"
        onPress={onUpload}
        disabled={uploading}
        loading={uploading}
      />
    </View>
  );
}

function PresetRow({
  preset,
  onRename,
  onChanged,
}: {
  preset: PresetImage;
  onRename: (p: PresetImage) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [optimisticActive, setOptimisticActive] = useState(preset.active);
  const url = r2Url(preset.thumb_key);

  async function onToggle(next: boolean) {
    setOptimisticActive(next);
    setBusy(true);
    const { error } = await updateAdminPreset({ id: preset.id, active: next });
    setBusy(false);
    if (error) {
      setOptimisticActive(preset.active);
      Alert.alert('No se pudo cambiar', errorMessage(error));
      return;
    }
    onChanged();
  }

  function confirmDelete() {
    Alert.alert(
      'Eliminar plantilla',
      `¿Eliminar "${preset.name}"? Los álbumes que ya la eligieron seguirán mostrándola.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const { error } = await deleteAdminPreset(preset.id);
            setBusy(false);
            if (error) {
              Alert.alert('Error', errorMessage(error));
              return;
            }
            onChanged();
          },
        },
      ],
    );
  }

  return (
    <View style={styles.row}>
      <View style={styles.thumb}>
        {url ? (
          <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <Text style={styles.thumbFallback}>?</Text>
        )}
      </View>
      <View style={styles.rowText}>
        <Pressable onPress={() => onRename(preset)}>
          <Text style={styles.name} numberOfLines={1}>{preset.name}</Text>
        </Pressable>
        <Text style={styles.meta}>
          orden {preset.sort_order} · {preset.active ? 'activa' : 'oculta'}
        </Text>
      </View>
      <Switch
        value={optimisticActive}
        onValueChange={onToggle}
        disabled={busy}
        trackColor={{ true: Colors.green, false: Colors.paper3 }}
        thumbColor={optimisticActive ? Colors.paper : Colors.paper2}
      />
      <Pressable onPress={confirmDelete} disabled={busy} style={styles.deleteBtn} hitSlop={8}>
        {busy ? (
          <ActivityIndicator color={Colors.muted} size="small" />
        ) : (
          <Feather name="trash-2" size={18} color={Colors.red} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  intro: {
    paddingHorizontal: Spacing.screenX,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  introText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    lineHeight: 18,
  },
  scroll: {
    paddingHorizontal: Spacing.screenX,
    paddingBottom: Spacing.xxl,
    gap: Spacing.xl,
  },
  center: {
    paddingTop: Spacing.xxl,
    alignItems: 'center',
  },
  errorText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    color: Colors.red,
    textAlign: 'center',
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  list: {
    gap: Spacing.sm,
  },
  emptyText: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.muted,
    fontStyle: 'italic',
    paddingVertical: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: Colors.paper3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbFallback: {
    fontFamily: FontFamily.display,
    color: Colors.muted,
  },
  rowText: { flex: 1, gap: 2 },
  name: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  meta: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.muted,
    letterSpacing: 0.8,
  },
  deleteBtn: {
    padding: 6,
  },
});
