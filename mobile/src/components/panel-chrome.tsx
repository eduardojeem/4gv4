import { bottomNavigation, navigationColor, navigationRouteActive } from '@/lib/bottom-nav-model';
import { PremiumBottomNav, type NavigationItem } from './premium-bottom-nav';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, usePalette } from '@/lib/palette';
import { iconFor, panelRoute, ROLE_LABELS, usePanel } from '@/lib/panel';

import { useNotifications } from '@/lib/notifications-context';
import { usePanelMenus } from './panel-menus';

/**
 * Cabecera del panel, como la web: ☰ abre las secciones, en el medio el
 * comercio, y el avatar abre el menú de perfil.
 */
export function PanelHeader() {
  const colors = usePalette();
  const { data } = usePanel();
  const { openSections, openProfile } = usePanelMenus();
  const { unreadCount } = useNotifications();
  const org = data?.organization;
  const initial = (data?.user.name || data?.user.email || '?').charAt(0).toUpperCase();

  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: colors.card }}>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Pressable
          onPress={openSections}
          accessibilityRole="button"
          accessibilityLabel="Abrir el menú de secciones"
          hitSlop={6}
          style={({ pressed }) => [styles.menuBtn, { borderColor: colors.border, backgroundColor: pressed ? colors.background : 'transparent' }]}>
          <Ionicons name="menu" size={22} color={colors.text} />
        </Pressable>
        <View style={[styles.orgLogo, { backgroundColor: palette.primary }]}>
          {org?.logoUrl ? (
            <Image source={org.logoUrl} style={styles.orgLogoImg} contentFit="cover" />
          ) : (
            <Text style={styles.orgInitial}>{(org?.name ?? 'M').charAt(0).toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={[styles.orgName, { color: colors.text }]}>{org?.name ?? 'Mi panel'}</Text>
          {org && (
            <Text numberOfLines={1} style={[styles.orgMeta, { color: colors.muted }]}>
              {ROLE_LABELS[org.role] ?? org.role} · Plan {org.plan}
            </Text>
          )}
        </View>
        <Pressable
          onPress={() => router.push('/panel/notifications' as any)}
          accessibilityRole="button"
          accessibilityLabel={unreadCount ? `Notificaciones, ${unreadCount} sin leer` : 'Notificaciones, sin avisos pendientes'}
          hitSlop={6}
          style={({ pressed }) => [styles.bellBtn, { borderColor: colors.border, backgroundColor: pressed ? colors.background : 'transparent' }]}>
          <Ionicons name="notifications-outline" size={20} color={colors.text} />
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: palette.primary }]}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : String(unreadCount)}
              </Text>
            </View>
          )}
        </Pressable>
        <Pressable
          onPress={openProfile}
          accessibilityRole="button"
          accessibilityLabel="Abrir el menú de perfil"
          style={[styles.avatar, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {data?.user.avatarUrl ? (
            <Image source={data.user.avatarUrl} style={styles.avatarImg} contentFit="cover" />
          ) : (
            <Text style={[styles.avatarText, { color: colors.text }]}>{initial}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function PanelTabBar() {
  const pathname = usePathname();
  const { data, findItem } = usePanel();
  const { openQuickMenu, openSections, activeMenu } = usePanelMenus();
  const model = bottomNavigation(data);
  const active = (route: string) => navigationRouteActive(pathname, route);
  const tabItems: NavigationItem[] = model.tabs.slice(0, 3).flatMap((key) => {
    const item = findItem(key);
    return item
      ? [
          {
            key,
            label: key === 'overview' ? 'Inicio' : key === 'cash-register' ? 'Caja' : item.mobileLabel ?? item.label,
            icon: iconFor(key),
            active: activeMenu === null && active(panelRoute(key)),
            onPress: () => router.navigate(panelRoute(key) as never),
          },
        ]
      : [];
  });
  const centerActive =
    activeMenu === 'quick' || (activeMenu === null && !tabItems.some((item) => item.active));
  const leftItems = tabItems.slice(0, 2);
  const rightItems: NavigationItem[] = [
    ...tabItems.slice(2, 3),
    {
      key: 'more-sections',
      label: 'Más',
      accessibilityLabel: 'Más: abrir menú lateral de secciones',
      icon: 'menu-outline',
      active: activeMenu === 'sections',
      onPress: openSections,
    },
  ];
  const items: NavigationItem[] = [
    ...leftItems,
    {
      key: 'quick-menu',
      label: 'Menú',
      accessibilityLabel: 'Abrir menú de secciones',
      icon: 'grid-outline',
      action: true,
      active: centerActive,
      onPress: openQuickMenu,
    },
    ...rightItems,
  ];
  const brand = navigationColor(data?.organization.brandColor, data?.organization.customBrandColor);
  return <PremiumBottomNav items={items} brand={brand} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  menuBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  orgLogo: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  orgLogoImg: { width: '100%', height: '100%' },
  orgInitial: { color: '#fff', fontSize: 18, fontWeight: '800' },
  orgName: { fontSize: 16, fontWeight: '800' },
  orgMeta: { fontSize: 12, marginTop: 1 },
  bellBtn: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  avatar: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: 15, fontWeight: '800' },
});
