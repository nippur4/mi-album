import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { ScreenHeader } from '@/components/screen-header';
import { Colors, FontFamily, FontSize, Radius, Spacing } from '@/constants/theme';
import { useDesktopCap } from '@/lib/use-is-desktop';
import { useMyBlocks, useBlockActions } from '@/lib/queries/moderation';
import { errorMessage } from '@/lib/errors';

// Pantalla de gestión de usuarios bloqueados: lista + desbloquear.
export default function BlockedUsersScreen() {
  const desktopCap = useDesktopCap(560);
  const { blocks, isLoading, refetch } = useMyBlocks();
  const { unblock } = useBlockActions();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onUnblock(id: string) {
    if (busyId) return;
    setError(null);
    setBusyId(id);
    const { error: err } = await unblock(id);
    setBusyId(null);
    if (err) {
      setError(errorMessage(err));
      return;
    }
    refetch();
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={desktopCap}>
        <ScreenHeader title="Usuarios bloqueados" back />
      </View>
      <ScrollView contentContainerStyle={[styles.inner, desktopCap]}>
        {isLoading ? (
          <ActivityIndicator color={Colors.red} style={{ marginTop: Spacing.xl }} />
        ) : blocks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No bloqueaste a nadie.</Text>
            <Text style={styles.emptyBody}>
              Cuando bloqueás a un creador, dejás de ver sus álbumes públicos y sus
              propuestas de intercambio.
            </Text>
          </View>
        ) : (
          <>
            {error && <Text style={styles.error}>{error}</Text>}
            {blocks.map((b) => (
              <View key={b.blocked_id} style={styles.row}>
                <Avatar source={b.display_name ?? '?'} imageKey={b.avatar_thumb_key} size={44} />
                <Text style={styles.name} numberOfLines={1}>
                  {b.display_name ?? 'Usuario'}
                </Text>
                <Pressable
                  onPress={() => onUnblock(b.blocked_id)}
                  disabled={busyId === b.blocked_id}
                  style={({ pressed }) => [styles.unblockBtn, pressed && { opacity: 0.6 }]}
                >
                  <Text style={styles.unblockText}>
                    {busyId === b.blocked_id ? '...' : 'Desbloquear'}
                  </Text>
                </Pressable>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.paper },
  inner: {
    paddingHorizontal: Spacing.screenX,
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.paper2,
    borderRadius: Radius.cardLg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  name: {
    flex: 1,
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  unblockBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  unblockText: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.ink,
    fontWeight: '700',
    letterSpacing: 1,
  },
  empty: {
    paddingVertical: Spacing.xxl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.body,
    fontWeight: '700',
    color: Colors.ink,
  },
  emptyBody: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.inkSoft,
    textAlign: 'center',
  },
  error: {
    fontFamily: FontFamily.body,
    fontSize: FontSize.bodySmall,
    color: Colors.red,
    marginBottom: Spacing.sm,
  },
});
