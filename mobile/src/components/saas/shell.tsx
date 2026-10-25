import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, usePathname, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type PropsWithChildren } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette, usePalette } from '@/lib/palette';
import { openSaasLink } from '@/lib/saas';
import { getSaasSection, SAAS_SECTIONS } from '@/lib/saas-navigation';
import { useSession } from '@/lib/session';

import { SaasButton, useSaasAccent } from './ui';

export function SaasShell({ children }: PropsWithChildren) {
  const colors = usePalette();
  const dark = useColorScheme() === 'dark';
  const accent = useSaasAccent();
  const pathname = usePathname();
  const activeSection = getSaasSection(pathname);
  const { session, signOut } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const displayName = typeof session?.user.user_metadata?.full_name === 'string' ? session.user.user_metadata.full_name.trim() : '';
  const initial = (displayName || session?.user.email || 'U').charAt(0).toUpperCase();

  const navigate = (href: Href) => {
    setMenuOpen(false);
    router.push(href);
  };

  const disconnect = () => Alert.alert('Cerrar sesión', 'Se cerrará tu sesión en este dispositivo.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Cerrar sesión', style: 'destructive', onPress: async () => {
      setSigningOut(true);
      try {
        await signOut();
        setMenuOpen(false);
      } catch {
        Alert.alert('No se pudo cerrar sesión', 'Probá de nuevo.');
      } finally {
        setSigningOut(false);
      }
    } },
  ]);

  return <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
    <StatusBar style={dark ? 'light' : 'dark'} />
    <View style={[styles.headerSurface, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver al Marketplace"
          onPress={() => router.replace('/')}
          hitSlop={8}
          style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Logo de Mi tiendaPY.com"
          onPress={() => router.replace('/saas' as Href)}
          style={styles.brandContainer}>
          <Image
            source={require('@/assets/images/branding/brand-icon.png')}
            style={styles.brandIcon}
            contentFit="contain"
            accessibilityLabel="Logo de Mi tiendaPY.com"
          />
          <Text style={[styles.brandTitle, { color: colors.text }]}>
            Mi tiendaPY<Text style={{ color: palette.primary }}>.com</Text>
          </Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={session ? 'Abrir mi cuenta' : 'Abrir menú de acceso'}
        accessibilityState={{ expanded: menuOpen }}
        onPress={() => setMenuOpen(true)}
        style={[
          styles.profileButton,
          {
            backgroundColor: session ? (dark ? 'rgba(37,99,235,0.2)' : 'rgba(37,99,235,0.1)') : colors.background,
            borderColor: session ? palette.primary : colors.border,
          },
        ]}>
        {session ? (
          <View style={styles.profileActiveRow}>
            <View style={[styles.avatarCircle, { backgroundColor: palette.primary }]}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
            <Ionicons name="menu" size={17} color={palette.primary} />
          </View>
        ) : (
          <View style={styles.profileGuestRow}>
            <Ionicons name="person-circle-outline" size={20} color={colors.text} />
            <Ionicons name="chevron-down" size={12} color={colors.muted} />
          </View>
        )}
      </Pressable>
    </View>
    <View style={styles.headerToolbar}>
      <Text style={[styles.sectionLabel, { color: colors.muted }]}>{SAAS_SECTIONS.find(section => section.key === activeSection)?.label || 'SaaS'}</Text>
      <Pressable accessibilityRole="link" accessibilityLabel="Entrar al Marketplace" onPress={() => router.push('/')}
        style={({ pressed }) => [styles.marketplaceButton, { backgroundColor: '#2563EB', opacity: pressed ? 0.8 : 1 }]}>
        <Ionicons name="storefront-outline" color="#FFFFFF" size={19} />
        <Text style={styles.marketplaceLabel}>Marketplace</Text>
        <Ionicons name="arrow-forward" color="#FFFFFF" size={17} />
      </Pressable>
    </View>
    </View>

    <View style={styles.main}>{children}</View>

    <View accessibilityRole="tablist" style={[styles.navigation, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {SAAS_SECTIONS.map((section) => {
        const selected = activeSection === section.key;
        return <Pressable key={section.key} accessibilityRole="tab" accessibilityState={{ selected }} accessibilityLabel={section.label}
          onPress={() => { if (!selected) router.replace(section.href as Href); }}
          style={[styles.tab, selected && { backgroundColor: `${accent}12`, borderColor: accent }]}>
          <Ionicons name={section.icon} size={22} color={selected ? accent : colors.muted} />
          <Text style={[styles.tabLabel, { color: selected ? accent : colors.muted, fontWeight: selected ? '700' : '500' }]}>{section.label}</Text>
        </Pressable>;
      })}
    </View>

    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cerrar menú de cuenta" onPress={() => setMenuOpen(false)} />
        <View accessibilityViewIsModal style={[styles.menu, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.menuHeader}>
            <Text accessibilityRole="header" style={[styles.menuTitle, { color: colors.text }]}>{session ? 'Mi cuenta' : 'Bienvenido'}</Text>
            <Pressable style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Cerrar menú" onPress={() => setMenuOpen(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.menuBody}>
            <View style={[styles.identity, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={[styles.avatar, { backgroundColor: `${accent}18` }]}>
                {session ? <Text style={[styles.avatarLetter, { color: accent }]}>{initial}</Text> : <Ionicons name="person-outline" size={25} color={accent} />}
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.identityName, { color: colors.text }]}>{session ? displayName || 'Tu cuenta' : 'Tu negocio empieza acá'}</Text>
                <Text style={[styles.email, { color: colors.muted }]}>{session?.user.email || 'Accedé a tus herramientas de gestión.'}</Text>
              </View>
            </View>
            {session ? <>
              <SaasButton label="Abrir mi panel" icon="speedometer-outline" onPress={() => navigate('/panel' as Href)} />
            </> : <>
              <SaasButton label="Ingresar" icon="log-in-outline" onPress={() => navigate('/sign-in')} />
              <ProfileMenuItem icon="person-add-outline" title="Crear cuenta" description="Registrá tu comercio desde la app" onPress={() => { setMenuOpen(false); void openSaasLink('/register'); }} />
            </>}
            <Text style={[styles.menuGroupLabel, { color: colors.muted }]}>EXPLORAR</Text>
            <ProfileMenuItem icon="pricetags-outline" title="Planes y funciones" description="Compará las opciones para tu comercio" onPress={() => { setMenuOpen(false); router.replace('/saas/planes' as Href); }} />
            <ProfileMenuItem icon="storefront-outline" title="Marketplace" description="Descubrí comercios, productos y ofertas" onPress={() => navigate('/')} />
            {session && <View style={[styles.logoutArea, { borderColor: colors.border }]}>
              <Pressable accessibilityRole="button" accessibilityState={{ disabled: signingOut }} disabled={signingOut} onPress={disconnect} style={styles.logoutButton}>
                <Ionicons name="log-out-outline" size={21} color={dark ? '#FCA5A5' : '#B91C1C'} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.logoutLabel, { color: dark ? '#FCA5A5' : '#B91C1C' }]}>{signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}</Text>
                  <Text style={[styles.email, { color: colors.muted }]}>Sólo en este dispositivo</Text>
                </View>
              </Pressable>
            </View>}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </SafeAreaView>;
}

function ProfileMenuItem({ icon, title, description, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; onPress: () => void }) {
  const colors = usePalette();
  const accent = useSaasAccent();
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.menuItem, { backgroundColor: pressed ? colors.background : 'transparent' }]}>
    <View style={[styles.menuItemIcon, { backgroundColor: `${accent}12` }]}><Ionicons name={icon} size={21} color={accent} /></View>
    <View style={{ flex: 1, gap: 3 }}><Text style={[styles.identityName, { color: colors.text }]}>{title}</Text><Text style={[styles.email, { color: colors.muted }]}>{description}</Text></View>
    <Ionicons name="chevron-forward" size={17} color={colors.muted} />
  </Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  main: { flex: 1 },
  headerSurface: { borderBottomWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  backBtn: { padding: 4 },
  headerToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14 },
  sectionLabel: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
  marketplaceButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  marketplaceLabel: { color: '#FFFFFF', fontSize: 14, lineHeight: 20, fontWeight: '700' },
  profileButton: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  profileActiveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  profileGuestRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  brandContainer: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandIcon: { width: 30, height: 30, borderRadius: 9 },
  brandTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  iconButton: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  navigation: { flexDirection: 'row', alignItems: 'stretch', borderTopWidth: 1, paddingHorizontal: 8, paddingVertical: 8, gap: 4 },
  tab: { flex: 1, minWidth: 0, minHeight: 60, paddingHorizontal: 2, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  tabLabel: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
  overlay: { flex: 1, padding: 20, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.55)' },
  menu: { width: '100%', maxWidth: 440, maxHeight: '85%', borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  menuHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  menuTitle: { flex: 1, fontSize: 21, fontWeight: '700' },
  menuBody: { padding: 20, paddingTop: 4, gap: 14 },
  email: { fontSize: 14, lineHeight: 22 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderWidth: 1, borderRadius: 16 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 22, fontWeight: '800' },
  identityName: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  menuGroupLabel: { fontSize: 11, lineHeight: 18, letterSpacing: 1.3, fontWeight: '700', paddingTop: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 4, minHeight: 64, borderRadius: 12 },
  menuItemIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoutArea: { borderTopWidth: 1, paddingTop: 8 },
  logoutButton: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingVertical: 10, paddingHorizontal: 4 },
  logoutLabel: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
});
