import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { createContext, use, useEffect, useState, type PropsWithChildren } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAfterDismiss } from '@/lib/after-dismiss';
import { openWeb } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { hasNativePanelSection, iconFor, panelRoute, ROLE_LABELS, usePanel, type PanelItem } from '@/lib/panel';
import { profileMenuSections, type ProfileMenuEntry } from '@/lib/profile-menu';
import { useSession } from '@/lib/session';

/**
 * Los dos menús del panel, como en la web:
 * - Secciones: la barra lateral, como cajón desde la izquierda (botón ☰ y «Más»).
 * - Perfil: el menú del avatar, arriba a la derecha.
 */

type MenusContextValue = { openSections: () => void; openProfile: () => void };
const MenusContext = createContext<MenusContextValue | null>(null);

export function usePanelMenus() {
  const value = use(MenusContext);
  if (!value) throw new Error('usePanelMenus debe usarse dentro de <PanelMenusProvider />');
  return value;
}

export function PanelMenusProvider({ children }: PropsWithChildren) {
  const [open, setOpen] = useState<'sections' | 'profile' | null>(null);
  return (
    <MenusContext.Provider value={{ openSections: () => setOpen('sections'), openProfile: () => setOpen('profile') }}>
      {children}
      <SectionsDrawer visible={open === 'sections'} onClose={() => setOpen(null)} />
      <ProfileMenu visible={open === 'profile'} onClose={() => setOpen(null)} />
    </MenusContext.Provider>
  );
}

/** «Administración» abre su área aparte; volver atrás regresa al panel. */
const sectionRoute = (key: string) => (key === 'administration' ? '/admin' : panelRoute(key));

const initialOf = (value?: string | null) => (value || '?').trim().charAt(0).toUpperCase();

// ─── Cajón de secciones ────────────────────────────────────────────────────

function SectionsDrawer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const { data } = usePanel();
  const [query, setQuery] = useState('');
  const drawerWidth = Math.min(340, width * 0.86);
  const [progress] = useState(() => new Animated.Value(0));

  // Al abrir, el cajón entra desde la izquierda.
  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, progress]);

  // Al cerrar, primero sale y recién después se quita el modal.
  const close = (after?: () => void) => {
    Animated.timing(progress, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      setQuery('');
      onClose();
      after?.();
    });
  };

  const q = query.trim().toLowerCase();
  const groups = (data?.groups ?? [])
    .map((group) => ({
      ...group,
      items: q
        ? group.items.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(q))
        : group.items,
    }))
    .filter((group) => group.items.length > 0);

  const isActive = (item: PanelItem) => {
    const route = panelRoute(item.key);
    return route === '/panel' ? pathname === '/panel' : pathname === route;
  };

  const go = (route: string) => close(() => router.navigate(route as never));

  const org = data?.organization;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => close()} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel="Cerrar menú" />
      </Animated.View>
      <Animated.View
        style={[
          styles.drawer,
          {
            width: drawerWidth,
            backgroundColor: colors.card,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 8,
            transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-drawerWidth, 0] }) }],
          },
        ]}>
        {/* Comercio */}
        <View style={styles.drawerHead}>
          <View style={[styles.orgLogo, { backgroundColor: palette.primary }]}>
            {org?.logoUrl ? (
              <Image source={org.logoUrl} style={styles.fill} contentFit="cover" />
            ) : (
              <Text style={styles.orgInitial}>{initialOf(org?.name)}</Text>
            )}
          </View>
          <View style={styles.flex}>
            <Text numberOfLines={1} style={[styles.orgName, { color: colors.text }]}>{org?.name ?? 'Mi panel'}</Text>
            {org && <Text style={[styles.small, { color: colors.muted }]}>Plan {org.plan}</Text>}
          </View>
          <Pressable onPress={() => close()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar menú" style={styles.iconBtn}>
            <Ionicons name="close" size={22} color={colors.muted} />
          </Pressable>
        </View>

        {/* Buscar sección */}
        <View style={[styles.search, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="search" size={16} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar sección"
            placeholderTextColor={colors.muted}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Buscar sección"
            style={[styles.searchInput, { color: colors.text }]}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Borrar búsqueda">
              <Ionicons name="close-circle" size={16} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.drawerList} keyboardShouldPersistTaps="handled">
          {groups.length === 0 && (
            <Text style={[styles.empty, { color: colors.muted }]}>Ninguna sección coincide con «{query}».</Text>
          )}
          {groups.map((group) => (
            <View key={group.id} style={styles.group}>
              <Text style={[styles.groupLabel, { color: colors.muted }]}>{group.label}</Text>
              {group.items.map((item) => {
                const active = isActive(item);
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => go(sectionRoute(item.key))}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.item,
                      active && { backgroundColor: 'rgba(37,99,235,0.12)' },
                      pressed && !active && { backgroundColor: colors.background },
                    ]}>
                    <Ionicons name={iconFor(item.key)} size={20} color={active ? palette.primary : colors.muted} />
                    <View style={styles.flex}>
                      <Text style={[styles.itemLabel, { color: active ? palette.primary : colors.text }, active && styles.bold]}>{item.label}{!hasNativePanelSection(item.key) ? ' · Web' : ''}</Text>
                      {q ? <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>{item.description}</Text> : null}
                    </View>
                    {active && <View style={[styles.activeDot, { backgroundColor: palette.primary }]} />}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>

        <Pressable
          onPress={() => close(() => router.replace('/'))}
          style={[styles.drawerFooter, { borderColor: colors.border }]}>
          <Ionicons name="storefront-outline" size={20} color="#0891B2" />
          <Text style={[styles.itemLabel, styles.flex, { color: colors.text }]}>Ver el marketplace</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// ─── Menú de perfil ────────────────────────────────────────────────────────

const WEB_HINT = 'se abre en el navegador';

function ProfileMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { data, findItem } = usePanel();
  const { signOut, biometric, setBiometricEnabled } = useSession();
  const { schedule, onDismiss } = useAfterDismiss();
  const [progress] = useState(() => new Animated.Value(0));
  const [savingBiometric, setSavingBiometric] = useState(false);
  const user = data?.user;
  const org = data?.organization;
  const cardWidth = Math.min(340, width - 24);
  const top = insets.top + 58;

  // Aparece desde el avatar: se agranda un poco y baja apenas.
  useEffect(() => {
    if (!visible) return;
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: 170, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [visible, progress]);

  // Cierra y, recién cuando el menú ya no está, hace lo que se tocó.
  const close = (after?: () => void) => {
    if (after) schedule(after);
    Animated.timing(progress, { toValue: 0, duration: 120, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => onClose());
  };

  const open = (entry: ProfileMenuEntry) =>
    close(() => {
      if (entry.web) void openWeb(entry.web).catch(() => undefined);
      else if (entry.route === '/') router.replace('/');
      else if (entry.route) router.push(entry.route as never);
    });

  const confirmSignOut = () =>
    close(() =>
      Alert.alert('Cerrar sesión', '¿Querés salir de tu cuenta en este teléfono?', [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/');
          },
        },
      ])
    );

  // El interruptor queda en el menú: no hace falta cerrarlo para ver el cambio.
  const toggleBiometric = async (next: boolean) => {
    if (savingBiometric) return;
    setSavingBiometric(true);
    const ok = await setBiometricEnabled(next);
    setSavingBiometric(false);
    if (!ok) {
      Alert.alert(`No se pudo ${next ? 'activar' : 'desactivar'} ${biometric.label}`, `Revisá que ${biometric.label} esté configurado en el teléfono y probá de nuevo.`);
    }
  };

  const sections = profileMenuSections({
    isAdmin: Boolean(user?.isAdmin),
    isSuperAdmin: Boolean(user?.isSuperAdmin),
    hasAdministration: Boolean(findItem('administration')),
  });
  const version = Constants.expoConfig?.version;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => close()} onDismiss={onDismiss} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, styles.backdropLight, { opacity: progress }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => close()} accessibilityLabel="Cerrar menú de perfil" />
      </Animated.View>
      <Animated.View
        accessibilityViewIsModal
        style={[
          styles.profileCard,
          {
            top,
            width: cardWidth,
            maxHeight: height - top - insets.bottom - 16,
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: progress,
            transform: [
              { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
              { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
            ],
          },
        ]}>
        <ScrollView bounces={false} contentContainerStyle={styles.profileBody}>
          {/* Quién usa la app y en qué comercio */}
          <View style={[styles.profileHead, { backgroundColor: colors.background }]}>
            <View style={[styles.avatarLg, { backgroundColor: palette.primary }]}>
              {user?.avatarUrl ? (
                <Image source={user.avatarUrl} style={styles.fill} contentFit="cover" />
              ) : (
                <Text style={styles.avatarLgText}>{initialOf(user?.name || user?.email)}</Text>
              )}
            </View>
            <View style={styles.flex}>
              <Text numberOfLines={1} style={[styles.profileName, { color: colors.text }]}>{user?.name || 'Mi cuenta'}</Text>
              {user?.email ? <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>{user.email}</Text> : null}
              {org && (
                <View style={styles.badges}>
                  <View style={[styles.roleBadge, { backgroundColor: 'rgba(37,99,235,0.12)' }]}>
                    <Text style={[styles.roleText, { color: palette.primary }]}>{ROLE_LABELS[org.role] ?? org.role}</Text>
                  </View>
                  <Text numberOfLines={1} style={[styles.orgLine, { color: colors.muted }]}>{org.name} · Plan {org.plan}</Text>
                </View>
              )}
            </View>
          </View>

          {sections.map((section) => (
            <View key={section.key} style={styles.profileSection}>
              <Text style={[styles.groupLabel, { color: colors.muted }]}>{section.label}</Text>
              {section.entries.map((entry) => (
                <MenuRow
                  key={entry.key}
                  icon={entry.icon}
                  title={entry.title}
                  subtitle={entry.web ? `${entry.subtitle} · ${WEB_HINT}` : entry.subtitle}
                  trailing={entry.web ? 'open-outline' : 'chevron-forward'}
                  onPress={() => open(entry)}
                  colors={colors}
                />
              ))}
              {section.key === 'account' && biometric.available ? (
                <View
                  style={styles.option}
                  accessible
                  accessibilityRole="switch"
                  accessibilityState={{ checked: biometric.enabled, busy: savingBiometric }}
                  accessibilityLabel={`Entrar con ${biometric.label}`}>
                  <View style={[styles.optionIcon, { backgroundColor: colors.background }]}>
                    <Ionicons name="finger-print-outline" size={19} color={colors.text} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.optionTitle, { color: colors.text }]}>Entrar con {biometric.label}</Text>
                    <Text style={[styles.small, { color: colors.muted }]}>{biometric.enabled ? 'Activado en este teléfono' : 'Sin escribir la contraseña'}</Text>
                  </View>
                  <Switch
                    value={biometric.enabled}
                    disabled={savingBiometric}
                    onValueChange={(next) => void toggleBiometric(next)}
                    trackColor={{ true: palette.primary, false: colors.border }}
                  />
                </View>
              ) : null}
            </View>
          ))}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <MenuRow
            icon="log-out-outline"
            title="Cerrar sesión"
            subtitle="Salir de la app en este teléfono"
            tone={palette.danger}
            onPress={confirmSignOut}
            colors={colors}
          />

          {version ? <Text style={[styles.version, { color: colors.muted }]}>MiTiendaPy · versión {version}</Text> : null}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  trailing,
  tone,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  trailing?: keyof typeof Ionicons.glyphMap;
  tone?: string;
  onPress: () => void;
  colors: ReturnType<typeof usePalette>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      style={({ pressed }) => [styles.option, pressed && { backgroundColor: tone ? 'rgba(220,38,38,0.08)' : colors.background }]}>
      <View style={[styles.optionIcon, { backgroundColor: tone ? 'rgba(220,38,38,0.1)' : colors.background }]}>
        <Ionicons name={icon} size={19} color={tone ?? colors.text} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.optionTitle, { color: tone ?? colors.text }]}>{title}</Text>
        <Text numberOfLines={1} style={[styles.small, { color: tone ? 'rgba(220,38,38,0.75)' : colors.muted }]}>{subtitle}</Text>
      </View>
      {trailing ? <Ionicons name={trailing} size={16} color={colors.muted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  bold: { fontWeight: '800' },
  small: { fontSize: 12 },
  backdrop: { backgroundColor: 'rgba(2,6,23,0.5)' },
  backdropLight: { backgroundColor: 'rgba(2,6,23,0.25)' },

  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  drawerHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 6, marginBottom: 14 },
  orgLogo: { width: 44, height: 44, borderRadius: 13, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  orgInitial: { color: '#fff', fontSize: 19, fontWeight: '800' },
  orgName: { fontSize: 16, fontWeight: '800' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 42, marginHorizontal: 4, marginBottom: 8 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  drawerList: { paddingBottom: 12 },
  empty: { padding: 16, textAlign: 'center' },
  group: { marginTop: 12 },
  groupLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 12, marginBottom: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 12 },
  itemLabel: { fontSize: 15, fontWeight: '600' },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
  drawerFooter: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },

  profileCard: {
    position: 'absolute',
    right: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  profileBody: { padding: 8, paddingBottom: 10 },
  profileHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, marginBottom: 4 },
  avatarLg: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarLgText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  profileName: { fontSize: 16, fontWeight: '800' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  roleBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  roleText: { fontSize: 11, fontWeight: '800' },
  orgLine: { flex: 1, fontSize: 11, fontWeight: '600' },
  profileSection: { marginTop: 10 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 8, marginHorizontal: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 14, minHeight: 52 },
  optionIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  optionTitle: { fontSize: 15, fontWeight: '700' },
  version: { fontSize: 11, textAlign: 'center', marginTop: 8 },
});
