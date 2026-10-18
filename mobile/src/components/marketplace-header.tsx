import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';

import { apiFetch } from '@/lib/api';
import { palette, usePalette } from '@/lib/palette';
import { ROLE_LABELS } from '@/lib/panel';
import { useSession } from '@/lib/session';

type OrganizationContext = {
  activeOrganization?: { id: string; name: string; slug: string; role: string };
};

type MarketplaceHeaderProps = {
  showBack?: boolean;
  onBack?: () => void;
  onOpenProfile?: () => void;
  cartItemCount?: number;
  onOpenCart?: () => void;
};

export function MarketplaceHeader({
  showBack,
  onBack,
  onOpenProfile,
  cartItemCount = 0,
  onOpenCart,
}: MarketplaceHeaderProps) {
  const { session, signOut } = useSession();
  const colors = usePalette();
  const dark = useColorScheme() === 'dark';
  const [menuVisible, setMenuVisible] = useState(false);
  const [org, setOrg] = useState<{ name: string; role: string } | null>(null);

  // Cargar información de comercio del usuario si tiene sesión activa
  useEffect(() => {
    if (!session) return;
    let active = true;
    apiFetch<OrganizationContext>('/api/organization-context')
      .then((data) => {
        if (active && data.activeOrganization) {
          setOrg({
            name: data.activeOrganization.name,
            role: data.activeOrganization.role,
          });
        }
      })
      .catch(() => {
        // En caso de que no tenga org asociada o falle la llamada
      });
    return () => {
      active = false;
    };
  }, [session]);

  const activeOrg = session ? org : null;

  const toggleMenu = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuVisible((prev) => !prev);
  };

  const handleGoToPanel = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setMenuVisible(false);
    router.push('/panel' as any);
  };

  const handleGoToSignIn = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMenuVisible(false);
    router.push('/sign-in' as any);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Estás seguro de que deseás salir de tu cuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setMenuVisible(false);
            await signOut();
          },
        },
      ]
    );
  };

  const initial = session?.user.email ? session.user.email.charAt(0).toUpperCase() : null;

  return (
    <>
      <View style={[styles.nav, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.navLeft}>
          {showBack && (
            <Pressable
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (onBack) onBack();
                else router.back();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Volver"
              style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          )}

          <Pressable
            onPress={() => router.replace('/')}
            accessibilityRole="link"
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

        <View style={styles.navRight}>
          {onOpenCart && (
            <Pressable
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onOpenCart();
              }}
              accessibilityRole="button"
              accessibilityLabel="Ver carrito de compras"
              style={({ pressed }) => [
                styles.cartButton,
                {
                  backgroundColor: cartItemCount > 0 ? (dark ? 'rgba(37,99,235,0.2)' : 'rgba(37,99,235,0.1)') : colors.background,
                  borderColor: cartItemCount > 0 ? palette.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}>
              <Ionicons
                name={cartItemCount > 0 ? 'cart' : 'cart-outline'}
                size={19}
                color={cartItemCount > 0 ? palette.primary : colors.text}
              />
              {cartItemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </Text>
                </View>
              )}
            </Pressable>
          )}

          {/* Botón de Perfil / Menú de Cuenta */}
          <Pressable
            onPress={toggleMenu}
            accessibilityRole="button"
            accessibilityLabel="Abrir menú de usuario"
            style={({ pressed }) => [
              styles.profileButton,
              {
                backgroundColor: session ? (dark ? 'rgba(37,99,235,0.2)' : 'rgba(37,99,235,0.1)') : colors.background,
                borderColor: session ? palette.primary : colors.border,
                opacity: pressed ? 0.8 : 1,
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
      </View>

      {/* ── Modal Menú de Perfil / Negocio ── */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onStartShouldSetResponder={() => true}>
            
            {/* Cabecera del Menú */}
            <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
              {session ? (
                <View style={styles.menuUserInfo}>
                  <View style={[styles.largeAvatar, { backgroundColor: palette.primary }]}>
                    <Text style={styles.largeAvatarText}>{initial}</Text>
                  </View>
                  <View style={styles.menuUserTexts}>
                    <Text numberOfLines={1} style={[styles.menuUserEmail, { color: colors.text }]}>
                      {session.user.email}
                    </Text>
                    {activeOrg ? (
                      <View style={styles.orgBadgeRow}>
                        <Ionicons name="business" size={12} color={palette.primary} />
                        <Text numberOfLines={1} style={[styles.orgName, { color: colors.text }]}>
                          {activeOrg.name}
                        </Text>
                        <Text style={[styles.orgRole, { color: colors.muted }]}>
                          ({ROLE_LABELS[activeOrg.role] ?? activeOrg.role})
                        </Text>
                      </View>
                    ) : (
                      <Text style={[styles.userBadge, { color: palette.success }]}>
                        ● Cuenta activa
                      </Text>
                    )}
                  </View>
                </View>
              ) : (
                <View style={styles.menuGuestHeader}>
                  <View style={[styles.largeAvatar, { backgroundColor: 'rgba(37,99,235,0.1)' }]}>
                    <Ionicons name="storefront" size={24} color={palette.primary} />
                  </View>
                  <View style={styles.menuUserTexts}>
                    <Text style={[styles.menuUserTitle, { color: colors.text }]}>
                      Mi tiendaPY<Text style={{ color: palette.primary }}>.com</Text>
                    </Text>
                    <Text style={[styles.menuUserSub, { color: colors.muted }]}>
                      Marketplace & Sistema Comercial
                    </Text>
                  </View>
                </View>
              )}
              <Pressable onPress={() => setMenuVisible(false)} hitSlop={8} style={styles.closeBtn}>
                <Ionicons name="close" size={20} color={colors.muted} />
              </Pressable>
            </View>

            {/* Opciones del Menú */}
            <View style={styles.menuActions}>
              {onOpenProfile && (
                <Pressable
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setMenuVisible(false);
                    onOpenProfile();
                  }}
                  style={({ pressed }) => [
                    styles.actionRow,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}>
                  <View style={[styles.actionIconBox, { backgroundColor: palette.primary }]}>
                    <Ionicons name="person" size={17} color="#FFFFFF" />
                  </View>
                  <View style={styles.actionTextBox}>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>
                      Mi Perfil de Usuario
                    </Text>
                    <Text style={[styles.actionSub, { color: colors.muted }]}>
                      Datos personales, compras y preferencias
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>
              )}

              {session ? (
                <>
                  {/* Opción 1: Ir al Panel */}
                  <Pressable
                    onPress={handleGoToPanel}
                    style={({ pressed }) => [
                      styles.actionRow,
                      {
                        backgroundColor: dark ? 'rgba(37,99,235,0.12)' : 'rgba(37,99,235,0.06)',
                        borderColor: palette.primary,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}>
                    <View style={[styles.actionIconBox, { backgroundColor: palette.primary }]}>
                      <Ionicons name="grid" size={18} color="#FFFFFF" />
                    </View>
                    <View style={styles.actionTextBox}>
                      <Text style={[styles.actionTitle, { color: palette.primary }]}>
                        Ir a Mi Panel de Control
                      </Text>
                      <Text style={[styles.actionSub, { color: colors.muted }]}>
                        Ventas, cobranzas, stock y órdenes de taller
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={palette.primary} />
                  </Pressable>

                  {/* Opción 2: ¿Tenés un negocio? */}
                  <Pressable
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setMenuVisible(false);
                      router.push('/saas' as any);
                    }}
                    style={({ pressed }) => [
                      styles.actionRow,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}>
                    <View style={[styles.actionIconBox, { backgroundColor: '#7C3AED' }]}>
                      <Ionicons name="rocket" size={18} color="#FFFFFF" />
                    </View>
                    <View style={styles.actionTextBox}>
                      <Text style={[styles.actionTitle, { color: colors.text }]}>
                        ¿Tenés un negocio?
                      </Text>
                      <Text style={[styles.actionSub, { color: colors.muted }]}>
                        Conocé nuestro software SaaS, planes y POS
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={15} color={colors.muted} />
                  </Pressable>

                  {/* Opción 3: Cerrar sesión */}
                  <Pressable
                    onPress={handleSignOut}
                    style={({ pressed }) => [
                      styles.actionRow,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}>
                    <View style={[styles.actionIconBox, { backgroundColor: 'rgba(220,38,38,0.1)' }]}>
                      <Ionicons name="log-out-outline" size={18} color={palette.danger} />
                    </View>
                    <View style={styles.actionTextBox}>
                      <Text style={[styles.actionTitle, { color: palette.danger }]}>
                        Cerrar sesión
                      </Text>
                      <Text style={[styles.actionSub, { color: colors.muted }]}>
                        Desconectar este dispositivo de tu cuenta
                      </Text>
                    </View>
                  </Pressable>
                </>
              ) : (
                <>
                  {/* Opción 1: Iniciar Sesión */}
                  <Pressable
                    onPress={handleGoToSignIn}
                    style={({ pressed }) => [
                      styles.actionRow,
                      {
                        backgroundColor: palette.primary,
                        borderColor: palette.primary,
                        opacity: pressed ? 0.88 : 1,
                      },
                    ]}>
                    <View style={[styles.actionIconBox, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                      <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                    </View>
                    <View style={styles.actionTextBox}>
                      <Text style={[styles.actionTitle, { color: '#FFFFFF' }]}>
                        Iniciar sesión
                      </Text>
                      <Text style={[styles.actionSub, { color: 'rgba(255,255,255,0.85)' }]}>
                        Entrá con tu cuenta comercial del sistema
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </Pressable>

                  {/* Opción 2: ¿Tenés un negocio? */}
                  <Pressable
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setMenuVisible(false);
                      router.push('/saas' as any);
                    }}
                    style={({ pressed }) => [
                      styles.actionRow,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}>
                    <View style={[styles.actionIconBox, { backgroundColor: '#7C3AED' }]}>
                      <Ionicons name="rocket" size={18} color="#FFFFFF" />
                    </View>
                    <View style={styles.actionTextBox}>
                      <Text style={[styles.actionTitle, { color: colors.text }]}>
                        ¿Tenés un negocio?
                      </Text>
                      <Text style={[styles.actionSub, { color: colors.muted }]}>
                        POS, Taller, Stock y Planes desde Gs. 150.000
                      </Text>
                    </View>
                    <Ionicons name="arrow-forward" size={15} color={colors.muted} />
                  </Pressable>

                  {/* Opción 3: Explorar catálogo */}
                  <Pressable
                    onPress={() => {
                      setMenuVisible(false);
                      router.push('/products' as any);
                    }}
                    style={({ pressed }) => [
                      styles.actionRow,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}>
                    <View style={[styles.actionIconBox, { backgroundColor: 'rgba(37,99,235,0.1)' }]}>
                      <Ionicons name="cube-outline" size={18} color={palette.primary} />
                    </View>
                    <View style={styles.actionTextBox}>
                      <Text style={[styles.actionTitle, { color: colors.text }]}>
                        Ver todos los productos
                      </Text>
                      <Text style={[styles.actionSub, { color: colors.muted }]}>
                        Catálogo público de todas las empresas
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={colors.muted} />
                  </Pressable>
                </>
              )}
            </View>

          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { padding: 4 },
  brandContainer: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  brandIcon: { width: 30, height: 30, borderRadius: 9 },
  brandTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },

  cartButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },

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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuUserInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 },
  menuGuestHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 8 },
  largeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeAvatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  menuUserTexts: { flex: 1, gap: 2 },
  menuUserEmail: { fontSize: 15, fontWeight: '800' },
  menuUserTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.4 },
  menuUserSub: { fontSize: 12 },
  userBadge: { fontSize: 12, fontWeight: '700' },
  orgBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  orgName: { fontSize: 13, fontWeight: '700' },
  orgRole: { fontSize: 12 },
  closeBtn: { padding: 4 },

  menuActions: { gap: 10 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  actionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextBox: { flex: 1, gap: 2 },
  actionTitle: { fontSize: 14, fontWeight: '700' },
  actionSub: { fontSize: 11, lineHeight: 15 },
});
