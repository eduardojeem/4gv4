import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ADMIN_NAV, ADMIN_TABS, adminItem, type AdminNavItem } from '@/lib/admin-nav';
import { openWeb } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';

/** El área de Administración tiene su propio color, como /admin en la web, para no confundirla con el panel. */
const ADMIN = { bar: '#0F172A', accent: '#A5B4FC' };

const MenuContext = createContext<{ open: () => void }>({ open: () => undefined });
export const useAdminMenu = () => useContext(MenuContext);

const go = (item: AdminNavItem) => {
  if (item.route) router.navigate(item.route as never);
  else if (item.web) void openWeb(item.web);
};

const isActive = (pathname: string, item: AdminNavItem) => Boolean(item.route) && (item.route === '/admin' ? pathname === '/admin' : pathname.startsWith(item.route!));

export function AdminMenuProvider({ children }: PropsWithChildren) {
  const [visible, setVisible] = useState(false);
  const value = useMemo(() => ({ open: () => setVisible(true) }), []);
  return (
    <MenuContext.Provider value={value}>
      {children}
      <AdminDrawer visible={visible} onClose={() => setVisible(false)} />
    </MenuContext.Provider>
  );
}

/** Cabecera oscura del área: ☰ con todas las secciones, el comercio y la vuelta al panel. */
export function AdminHeader() {
  const { data } = usePanel();
  const { open } = useAdminMenu();
  const org = data?.organization;
  return (
    <SafeAreaView edges={['top']} style={{ backgroundColor: ADMIN.bar }}>
      <View style={styles.header}>
        <Pressable onPress={open} accessibilityRole="button" accessibilityLabel="Abrir las secciones de administración" hitSlop={6} style={styles.menuBtn}>
          <Ionicons name="menu" size={22} color="#fff" />
        </Pressable>
        <View style={styles.badge}>
          <Ionicons name="shield-half-outline" size={18} color={ADMIN.accent} />
        </View>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.title}>Administración</Text>
          <Text numberOfLines={1} style={styles.subtitle}>{org?.name ?? 'Tu negocio'}</Text>
        </View>
        <Pressable onPress={() => router.replace('/panel' as never)} accessibilityRole="button" accessibilityLabel="Volver al panel" style={styles.exit}>
          <Ionicons name="grid-outline" size={15} color="#fff" />
          <Text style={styles.exitText}>Panel</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

export function AdminTabBar() {
  const colors = usePalette();
  const pathname = usePathname();
  const { open } = useAdminMenu();
  const tabs = ADMIN_TABS.map(adminItem).filter((item): item is AdminNavItem => Boolean(item));
  const moreActive = !tabs.some((tab) => isActive(pathname, tab));
  const shortLabel: Record<string, string> = { overview: 'Resumen', cash: 'Cajas', users: 'Equipo', reviews: 'Reseñas' };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.tabRow}>
        {tabs.map((item) => (
          <Tab key={item.key} icon={item.icon} label={shortLabel[item.key] ?? item.label} active={isActive(pathname, item)} onPress={() => go(item)} colors={colors} />
        ))}
        <Tab icon="menu-outline" label="Más" active={moreActive} onPress={open} colors={colors} />
      </View>
    </SafeAreaView>
  );
}

function Tab({ icon, label, active, onPress, colors }: { icon: AdminNavItem['icon']; label: string; active: boolean; onPress: () => void; colors: ReturnType<typeof usePalette> }) {
  const name = active ? (icon.replace('-outline', '') as typeof icon) : icon;
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected: active }} accessibilityLabel={label} style={styles.tab}>
      <View style={[styles.tabIcon, active && { backgroundColor: 'rgba(79,70,229,0.14)' }]}>
        <Ionicons name={name} size={22} color={active ? '#4F46E5' : colors.muted} />
      </View>
      <Text numberOfLines={1} style={[styles.tabLabel, { color: active ? '#4F46E5' : colors.muted }, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

/** Menú lateral con las mismas categorías que la barra de /admin. */
function AdminDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = usePalette();
  const pathname = usePathname();
  const { data } = usePanel();
  const org = data?.organization;

  const pick = (item: AdminNavItem) => {
    onClose();
    go(item);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.drawerWrap}>
        <SafeAreaView edges={['top', 'bottom']} style={[styles.drawer, { backgroundColor: colors.card }]}>
          <View style={styles.drawerHead}>
            <View style={styles.orgLogo}>
              {org?.logoUrl ? <Image source={org.logoUrl} style={styles.fill} contentFit="cover" /> : <Text style={styles.orgInitial}>{(org?.name ?? 'M').charAt(0).toUpperCase()}</Text>}
            </View>
            <View style={styles.flex}>
              <Text numberOfLines={1} style={styles.drawerTitle}>{org?.name ?? 'Tu negocio'}</Text>
              <Text style={styles.drawerSub}>Administración</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Cerrar">
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.drawerBody}>
            {ADMIN_NAV.map((group) => (
              <View key={group.label} style={styles.group}>
                <Text style={[styles.groupLabel, { color: colors.muted }]}>{group.label}</Text>
                {group.items.map((item) => {
                  const active = isActive(pathname, item);
                  return (
                    <Pressable key={item.key} onPress={() => pick(item)} style={({ pressed }) => [styles.item, { backgroundColor: active ? 'rgba(79,70,229,0.1)' : pressed ? colors.background : 'transparent' }]}>
                      <Ionicons name={item.icon} size={20} color={active ? '#4F46E5' : colors.muted} />
                      <View style={styles.flex}>
                        <Text style={[styles.itemLabel, { color: active ? '#4F46E5' : colors.text }]}>{item.label}</Text>
                        <Text numberOfLines={1} style={[styles.itemHint, { color: colors.muted }]}>{item.hint}</Text>
                      </View>
                      {item.web ? <Ionicons name="open-outline" size={15} color={colors.muted} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ))}
            <Pressable
              onPress={() => {
                onClose();
                router.replace('/panel' as never);
              }}
              style={[styles.back, { borderColor: colors.border }]}>
              <Ionicons name="arrow-back" size={18} color={palette.primary} />
              <Text style={[styles.itemLabel, { color: palette.primary }]}>Volver al panel</Text>
            </Pressable>
          </ScrollView>
        </SafeAreaView>
        <Pressable style={styles.flex} onPress={onClose} accessibilityLabel="Cerrar el menú" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  menuBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  badge: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(165,180,252,0.15)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 16, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 1 },
  exit: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: 'rgba(255,255,255,0.12)' },
  exitText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  tabBar: { borderTopWidth: StyleSheet.hairlineWidth },
  tabRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 6, paddingBottom: 4 },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  tabIcon: { width: 48, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 11, fontWeight: '600' },
  tabLabelActive: { fontWeight: '800' },
  drawerWrap: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(15,23,42,0.45)' },
  drawer: { width: '84%', maxWidth: 360 },
  drawerHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: ADMIN.bar },
  orgLogo: { width: 40, height: 40, borderRadius: 12, overflow: 'hidden', backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  orgInitial: { color: '#fff', fontSize: 18, fontWeight: '800' },
  drawerTitle: { color: '#fff', fontSize: 15, fontWeight: '800' },
  drawerSub: { color: ADMIN.accent, fontSize: 12, fontWeight: '700' },
  drawerBody: { padding: 10, paddingBottom: 24, gap: 6 },
  group: { gap: 2 },
  groupLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9 },
  itemLabel: { fontSize: 14, fontWeight: '700' },
  itemHint: { fontSize: 11, marginTop: 1 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10, paddingHorizontal: 10, paddingTop: 14 },
});
