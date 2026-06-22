import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { EditNameModal } from '@/components/edit-name-modal';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { signOut, useSession } from '@/lib/auth';
import { useIsAdmin } from '@/lib/queries/admin';
import { useMyProfile } from '@/lib/queries/profile';

export default function ProfileTab() {
  const router = useRouter();
  const { session } = useSession();
  const { profile, refetch } = useMyProfile();
  const { isAdmin } = useIsAdmin();
  const [editingName, setEditingName] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.inner}>
        <View>
          <Text style={styles.title}>Perfil</Text>

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
        </View>

        <Button label="Cerrar sesión" variant="outline" onPress={signOut} />
      </View>

      <EditNameModal
        visible={editingName}
        currentName={profile?.display_name ?? ''}
        onClose={() => setEditingName(false)}
        onSaved={refetch}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.screenX,
    paddingVertical: Spacing.xxl,
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.screenTitle,
    color: Colors.ink,
    marginBottom: Spacing.xl,
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
    marginBottom: Spacing.sm,
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
    marginTop: Spacing.xl,
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
