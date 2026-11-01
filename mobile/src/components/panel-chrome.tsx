import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
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

/**
 * Barra inferior al estilo de Android actual (Material 3): fondo tonal sin
 * línea de corte, píldora detrás del ícono activo que aparece con animación,
 * ripple y una vibración corta al cambiar de pestaña. Las mismas cuatro
 * secciones que la web en celular, más «Más».
 */
export function PanelTabBar() {
  const colors = usePalette();
  const dark = useColorScheme() === 'dark';
  const pathname = usePathname();
  const { data, findItem } = usePanel();
  const { openSections } = usePanelMenus();
  const tabs = (data?.tabs ?? ['overview']).map((key) => findItem(key)).filter((item) => item !== undefined);

  const isActive = (route: string) => (route === '/panel' ? pathname === '/panel' : pathname.startsWith(route));
  // «Más» queda marcado cuando estás en una sección que no tiene pestaña propia.
  const moreActive = !tabs.some((tab) => isActive(panelRoute(tab.key))) && pathname !== '/panel';
  // Superficie tonal: un poco del color de la marca sobre la tarjeta, como «surface container» de Material 3.
  const surface = dark ? '#151E30' : '#F3F6FC';

  return (
    <SafeAreaView edges={['bottom']} accessibilityRole="tablist" style={[styles.tabBar, { backgroundColor: surface, shadowColor: dark ? '#000' : '#0F172A' }]}>
      <View style={styles.tabRow}>
        {tabs.map((item) => (
          <TabButton
            key={item.key}
            colors={colors}
            dark={dark}
            route={panelRoute(item.key)}
            icon={iconFor(item.key)}
            label={`${item.mobileLabel ?? item.label}${hasNativePanelSection(item.key) ? '' : ' · Web'}`}
            active={isActive(panelRoute(item.key))}
          />
        ))}
        <TabButton colors={colors} dark={dark} onPress={openSections} icon="grid-outline" label="Más" active={moreActive} />
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
  dark: boolean;
  colors: ReturnType<typeof usePalette>;
};

function TabButton({ route, onPress, icon, label, active, dark, colors }: TabButtonProps) {
  // El ícono activo va relleno, como en la barra de la web.
  const name = active ? (icon.replace('-outline', '') as typeof icon) : icon;
  const [progress] = useState(() => new Animated.Value(active ? 1 : 0));

  useEffect(() => {
    Animated.spring(progress, { toValue: active ? 1 : 0, useNativeDriver: true, speed: 18, bounciness: 6 }).start();
  }, [active, progress]);

  const press = () => {
    if (!active) void Haptics.selectionAsync().catch(() => undefined);
    if (onPress) onPress();
    else if (route && !active) router.navigate(route as never);
  };

  const indicator = dark ? 'rgba(96,165,250,0.22)' : 'rgba(37,99,235,0.14)';
  const activeColor = dark ? '#93C5FD' : palette.primary;

  return (
    <Pressable
      onPress={press}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      android_ripple={Platform.OS === 'android' ? { color: indicator, borderless: true, radius: 36 } : undefined}
      style={styles.tab}>
      <View style={styles.tabIcon}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.tabIndicator, { backgroundColor: indicator, opacity: progress, transform: [{ scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }] }]}
        />
        <Ionicons name={name} size={22} color={active ? activeColor : colors.muted} />
      </View>
      <Text numberOfLines={1} style={[styles.tabLabel, { color: active ? colors.text : colors.muted }, active && styles.tabLabelActive]}>
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
  tabBar: { elevation: 8, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: -2 } },
  tabRow: { flexDirection: 'row', justifyContent: 'space-around', minHeight: 72, paddingTop: 10, paddingBottom: 8 },
  tab: { flex: 1, alignItems: 'center', gap: 4 },
  tabIcon: { width: 64, height: 32, alignItems: 'center', justifyContent: 'center' },
  tabIndicator: { borderRadius: 16 },
  tabLabel: { fontSize: 12, fontWeight: '500', letterSpacing: 0.2 },
  tabLabelActive: { fontWeight: '700' },
});
