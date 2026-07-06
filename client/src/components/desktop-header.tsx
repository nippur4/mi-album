// Header horizontal para el layout desktop (web ≥ 768px).
// Reemplaza a la tab bar inferior mobile: branding a la izquierda, tabs al
// centro, avatar a la derecha.
//
// La tab QR sigue interceptada — no navega, abre el QrTabModal.

import Feather from '@expo/vector-icons/Feather';
import { usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { QrTabModal } from '@/components/qr-tab-modal';
import { useSession } from '@/lib/auth';
import { useMyPacksTabData } from '@/lib/queries/packs-tab';
import { useMyProfile } from '@/lib/queries/profile';
import { Colors, FontFamily, FontSize, Spacing } from '@/constants/theme';

interface TabItem {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
  // Ruta a la que se navega. undefined = no navega (ej. QR abre modal).
  href?: string;
  // Callback opcional cuando se presiona (para QR abrir modal).
  onPress?: () => void;
}

// Mismo orden que la tab bar mobile.
const buildTabs = (openQr: () => void): TabItem[] => [
  { key: 'index',  label: 'INICIO',    icon: 'home',     href: '/(tabs)/' },
  { key: 'album',  label: 'GESTIONAR', icon: 'grid',     href: '/(tabs)/album' },
  { key: 'qr',     label: 'QR',        icon: 'maximize', onPress: openQr },
  { key: 'packs',  label: 'SOBRES',    icon: 'mail',     href: '/(tabs)/packs' },
  { key: 'trades', label: 'CAMBIOS',   icon: 'repeat',   href: '/(tabs)/trades' },
];

// Devuelve true si el pathname actual matchea la ruta del item.
// Consideramos "/" y "/(tabs)/" como Home. Sobres/etc matchean exacto o prefix.
function isActiveTab(pathname: string, item: TabItem): boolean {
  if (!item.href) return false;
  if (item.key === 'index') return pathname === '/' || pathname === '/(tabs)/' || pathname === '';
  // Los otros: last segment del href debe estar al final del pathname
  const segment = item.href.replace('/(tabs)/', '');
  return pathname.endsWith(`/${segment}`);
}

export function DesktopHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const { session } = useSession();
  const { profile } = useMyProfile();
  const [qrOpen, setQrOpen] = useState(false);
  const tabs = buildTabs(() => setQrOpen(true));

  // Badge de SOBRES: sin abrir + dailies reclamables. Misma query key que la
  // pantalla del tab, así comparten cache e invalidaciones.
  const { pending, playable } = useMyPacksTabData();
  const packsBadge =
    pending.reduce((acc, r) => acc + r.count, 0) +
    playable.filter((r) => r.daily.canClaim).length;

  const displayName =
    profile?.display_name ??
    (session?.user.user_metadata?.display_name as string | undefined) ??
    session?.user.email?.split('@')[0] ??
    'Vos';

  return (
    <>
      <View style={styles.header}>
        <View style={styles.inner}>
          <Text style={styles.brand}>MI ÁLBUM</Text>
          <View style={styles.tabs}>
            {tabs.map((t) => {
              const active = isActiveTab(pathname, t);
              return (
                <Pressable
                  key={t.key}
                  onPress={() => {
                    if (t.onPress) t.onPress();
                    else if (t.href) router.push(t.href as any);
                  }}
                  style={({ pressed }) => [
                    styles.tab,
                    active && styles.tabActive,
                    pressed && styles.tabPressed,
                  ]}
                  hitSlop={4}
                >
                  <Feather
                    name={t.icon}
                    size={18}
                    color={active ? Colors.red : Colors.muted}
                  />
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {t.label}
                  </Text>
                  {t.key === 'packs' && packsBadge > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{packsBadge}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
          <Pressable
            onPress={() => router.push('/profile')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
          >
            <Avatar
              source={displayName}
              size={40}
              imageKey={profile?.avatar_thumb_key ?? null}
            />
          </Pressable>
        </View>
      </View>

      <QrTabModal visible={qrOpen} onClose={() => setQrOpen(false)} />
    </>
  );
}

const HEADER_MAX_WIDTH = 1080;

const styles = StyleSheet.create({
  header: {
    width: '100%',
    backgroundColor: Colors.paper,
    borderBottomColor: Colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  inner: {
    width: '100%',
    maxWidth: HEADER_MAX_WIDTH,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.lg,
  },
  brand: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    color: Colors.ink,
    letterSpacing: 1.5,
  },
  tabs: {
    flexDirection: 'row',
    gap: Spacing.md,
    flex: 1,
    justifyContent: 'center',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: Colors.red,
  },
  tabPressed: {
    opacity: 0.7,
  },
  tabLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FontFamily.mono,
    fontSize: 10,
    color: Colors.paper,
    fontWeight: '700',
  },
  tabLabelActive: {
    color: Colors.red,
  },
});
