import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { AvatarPickerModal } from '@/components/avatar-picker-modal';
import { Button } from '@/components/button';
import { EditNameModal } from '@/components/edit-name-modal';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { signOut, useSession } from '@/lib/auth';
import { useIsAdmin } from '@/lib/queries/admin';
import { updateAvatar, useMyProfile } from '@/lib/queries/profile';
import { errorMessage } from '@/lib/errors';

export default function ProfileTab() {
  const router = useRouter();
  const { session } = useSession();
  const { profile, refetch } = useMyProfile();
  const { isAdmin } = useIsAdmin();
  const [editingName, setEditingName] = useState(false);
  const [pickingAvatar, setPickingAvatar] = useState(false);

  const displayName = profile?.display_name ?? session?.user.email?.split('@')[0] ?? 'Vos';
  const avatarKey = profile?.avatar_thumb_key ?? null;

  async function onAvatarSelected(thumbKey: string | null) {
    const { error } = await updateAvatar(thumbKey);
    if (error) {
      Alert.alert('No se pudo cambiar', errorMessage(error));
      return;
    }
    await refetch();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.title}>Perfil</Text>

        {/* Avatar grande + tap para cambiar */}
        <View style={styles.avatarWrap}>
          <Pressable onPress={() => setPickingAvatar(true)} style={styles.avatarBtn}>
            <Avatar source={displayName} imageKey={avatarKey} size={120} />
            <View style={styles.editBadge}>
              <Feather name="edit-2" size={14} color={Colors.paper} />
            </View>
          </Pressable>
          <Text style={styles.avatarHint}>Tocá para cambiar tu avatar</Text>
        </View>

        {/* Nombre público (editable) */}
        <Pressable
          onPress={() => setEditingName(true)}
          style={({ pressed }) => [styles.editableRow, pressed && styles.pressed]}
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>NOMBRE PÚBLICO</Text>
            <Text style={styles.value}>{profile?.display_name ?? '—'}</Text>
          </View>
          <Feather name="edit-2" size={16} color={Colors.muted} />
        </Pressable>

        {/* Email (no editable) */}
        <View style={styles.staticRow}>
          <Text style={styles.label}>EMAIL</Text>
          <Text style={styles.value}>{session?.user.email ?? '—'}</Text>
        </View>

        {isAdmin && (
          <Pressable
            onPress={() => router.push('/admin')}
            style={({ pressed }) => [styles.adminRow, pressed && styles.pressed]}
          >
            <Feather name="shield" size={18} color={Colors.ink} />
            <Text style={styles.adminLabel}>Panel admin</Text>
            <Feather name="chevron-right" size={20} color={Colors.muted} />
          </Pressable>
        )}

        <View style={{ flex: 1 }} />

        <Button label="Cerrar sesión" variant="outline" onPress={signOut} />
      </ScrollView>

      <EditNameModal
        visible={editingName}
        currentName={profile?.display_name ?? ''}
        onClose={() => setEditingName(false)}
        onSaved={refetch}
      />

      <AvatarPickerModal
        visible={pickingAvatar}
        currentName={displayName}
        currentThumbKey={avatarKey}
        onClose={() => setPickingAvatar(false)}
        onSelect={onAvatarSelected}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  inner: {
    flexGrow: 1,
    paddingHorizontal: Spacing.screenX,
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.screenTitle,
    color: Colors.ink,
    marginBottom: Spacing.md,
  },
  avatarWrap: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  avatarBtn: {
    position: 'relative',
  },
  editBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.paper,
  },
  avatarHint: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  editableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pressed: { opacity: 0.85 },
  staticRow: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  label: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: Spacing.xs,
  },
  value: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  adminRow: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  adminLabel: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
});
