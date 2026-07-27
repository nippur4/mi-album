// Header horizontal de navegación para TODO web (cualquier ancho).
// Reemplaza a la tab bar inferior — en la app nativa la nav sigue abajo.
//   - Ancho (≥768px): branding a la izquierda, tabs con label al lado, avatar.
//   - Angosto (web mobile): sin brand, tabs compactas ícono-sobre-label como
//     una tab bar clásica pero arriba, avatar chico a la derecha.
//
// La tab QR sigue interceptada — no navega, abre el QrTabModal.

import Feather from '@expo/vector-icons/Feather';
import { usePathname, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { QrTabModal } from '@/components/qr-tab-modal';
import { useSession } from '@/lib/auth';
import { useMyPacksTabData } from '@/lib/queries/packs-tab';
import { useMyOffers } from '@/lib/queries/trades';
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
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  // Web angosto (mobile en el navegador): versión compacta ícono-sobre-label.
  const compact = width < 768;
  const [qrOpen, setQrOpen] = useState(false);
  const tabs = buildTabs(() => setQrOpen(true));

  // Badge de SOBRES: sin abrir + dailies reclamables. Misma query key que la
  // pantalla del tab, así comparten cache e invalidaciones.
  const { pending, playable } = useMyPacksTabData();
  const packsBadge =
    pending.reduce((acc, r) => acc + r.count, 0) +
    playable.filter((r) => r.daily.canClaim).length;

  // Badge de CAMBIOS: ofertas recibidas pendientes. Misma query key que el tab.
  const { received } = useMyOffers();
  const tradesBadge = received.filter((o) => o.status === 'pending').length;

  const displayName =
    profile?.display_name ??
    (session?.user.user_metadata?.display_name as string | undefined) ??
    session?.user.email?.split('@')[0] ??
    'Vos';

  return (
    <>
      <View
        style={[
          styles.header,
          compact && styles.headerCompact,
          // PWA standalone (iOS) mete el status bar arriba; en navegador da 0.
          compact && { paddingTop: insets.top + Spacing.xs },
        ]}
      >
        <View style={[styles.inner, compact && styles.innerCompact]}>
          {/* Brand + navegación agrupados a la izquierda; avatar a la derecha.
              En compacto se oculta el brand para que entren las 5 tabs. */}
          <View style={[styles.leftGroup, compact && styles.leftGroupCompact]}>
          {!compact && <Text style={styles.brand}>MI ÁLBUM</Text>}
          <View style={[styles.tabs, compact && styles.tabsCompact]}>
            {tabs.map((t) => {
              const active = isActiveTab(pathname, t);
              const badgeCount =
                t.key === 'packs' ? packsBadge : t.key === 'trades' ? tradesBadge : 0;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => {
                    if (t.onPress) t.onPress();
                    else if (t.href) router.push(t.href as any);
                  }}
                  style={({ pressed }) => [
                    styles.tab,
                    compact && styles.tabCompact,
                    active && styles.tabActive,
                    pressed && styles.tabPressed,
                  ]}
                  hitSlop={4}
                >
                  <View style={styles.iconWrap}>
                    <Feather
                      name={t.icon}
                      size={compact ? 20 : 18}
                      color={active ? Colors.red : Colors.muted}
                    />
                    {/* En compacto el badge flota sobre el ícono (no hay lugar
                        al lado del label en columna). */}
                    {compact && badgeCount > 0 && (
                      <View style={[styles.badge, styles.badgeFloat]}>
                        <Text style={styles.badgeText}>{badgeCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.tabLabel,
                      compact && styles.tabLabelCompact,
                      active && styles.tabLabelActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                  {!compact && badgeCount > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{badgeCount}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
          </View>
          <Pressable
            onPress={() => router.push('/profile')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
          >
            <Avatar
              source={displayName}
              size={compact ? 36 : 48}
              imageKey={profile?.avatar_thumb_key ?? null}
            />
          </Pressable>
        </View>
      </View>

      <QrTabModal visible={qrOpen} onClose={() => setQrOpen(false)} />
    </>
  );
}

// Más ancho que el contenido (1080) a propósito: en escritorio el header
// aprovecha la pantalla — brand+nav bien a la izquierda, avatar a la derecha.
const HEADER_MAX_WIDTH = 1440;

const styles = StyleSheet.create({
  header: {
    width: '100%',
    backgroundColor: Colors.paper,
    borderBottomColor: Colors.border,
    borderBottomWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerCompact: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xs,
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
  innerCompact: {
    gap: Spacing.sm,
  },
  // Brand + navegación juntos a la izquierda.
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xl,
    flex: 1,
  },
  // Compacto: sin brand, las tabs ocupan todo el ancho disponible.
  leftGroupCompact: {
    gap: 0,
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
    alignItems: 'center',
  },
  // Compacto: distribuye las 5 tabs a lo ancho.
  tabsCompact: {
    flex: 1,
    gap: 0,
    justifyContent: 'space-around',
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
  // Compacto: ícono sobre label, sin borde inferior (activo por color).
  tabCompact: {
    flexDirection: 'column',
    gap: 3,
    paddingHorizontal: 2,
    borderBottomWidth: 0,
  },
  tabActive: {
    borderBottomColor: Colors.red,
  },
  tabPressed: {
    opacity: 0.7,
  },
  iconWrap: {
    position: 'relative',
  },
  tabLabel: {
    fontFamily: FontFamily.mono,
    fontSize: FontSize.monoLabelSmall,
    color: Colors.muted,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  tabLabelCompact: {
    fontSize: 8,
    letterSpacing: 0.5,
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
  // Compacto: el badge flota en la esquina del ícono.
  badgeFloat: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
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
