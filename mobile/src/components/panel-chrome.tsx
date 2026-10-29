import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, usePalette } from '@/lib/palette';
import { hasNativePanelSection, iconFor, panelRoute, ROLE_LABELS, usePanel } from '@/lib/panel';

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
          accessibilityLabel="Notificaciones"
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

/** Barra inferior: las mismas cuatro secciones que la web en celular, más «Más». */
export function PanelTabBar() {
  const colors = usePalette();
  const pathname = usePathname();
  const { data, findItem } = usePanel();
  const { openSections } = usePanelMenus();
  const tabs = (data?.tabs ?? ['overview']).map((key) => findItem(key)).filter((item) => item !== undefined);

  const isActive = (route: string) => (route === '/panel' ? pathname === '/panel' : pathname.startsWith(route));
  // «Más» queda marcado cuando estás en una sección que no tiene pestaña propia.
  const moreActive = !tabs.some((tab) => isActive(panelRoute(tab.key))) && pathname !== '/panel';

  return (
    <SafeAreaView edges={['bottom']} style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.tabRow}>
        {tabs.map((item) => (
          <TabButton
            key={item.key}
            colors={colors}
            route={panelRoute(item.key)}
            icon={iconFor(item.key)}
            label={`${item.mobileLabel ?? item.label}${hasNativePanelSection(item.key) ? '' : ' · Web'}`}
            active={isActive(panelRoute(item.key))}
          />
        ))}
        <TabButton colors={colors} onPress={openSections} icon="menu-outline" label="Más" active={moreActive} />
      </View>
    </SafeAreaView>
  );
}

type TabButtonProps = {
  route?: string;
  onPress?: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  colors: ReturnType<typeof usePalette>;
};

function TabButton({ route, onPress, icon, label, active, colors }: TabButtonProps) {
  // El ícono activo va relleno, como en la barra de la web.
  const name = active ? (icon.replace('-outline', '') as typeof icon) : icon;
  return (
    <Pressable
      onPress={onPress ?? (() => route && router.navigate(route as never))}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={styles.tab}>
      <View style={[styles.tabIcon, active && { backgroundColor: 'rgba(37,99,235,0.12)' }]}>
        <Ionicons name={name} size={22} color={active ? palette.primary : colors.muted} />
      </View>
      <Text numberOfLines={1} style={[styles.tabLabel, { color: active ? palette.primary : colors.muted }, active && styles.tabLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
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
  tabBar: { borderTopWidth: StyleSheet.hairlineWidth },
  tabRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 6, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  tabIcon: { width: 48, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 11, fontWeight: '600' },
  tabLabelActive: { fontWeight: '800' },
});
