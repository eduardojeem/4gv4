import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAfterDismiss } from '@/lib/after-dismiss';
import { accountDisplayName, canOpenBusinessPanel, useMarketplaceAccount } from '@/lib/marketplace-account';
import { palette, usePalette } from '@/lib/palette';
import { ROLE_LABELS } from '@/lib/panel';
import { useSession } from '@/lib/session';

type MarketplaceHeaderProps = {
  showBack?: boolean;
  onBack?: () => void;
  onOpenProfile?: () => void;
  cartItemCount?: number;
  onOpenCart?: () => void;
};

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Cabecera del marketplace con el menú de cuenta. El menú usa los mismos datos
 * que la pestaña Perfil (useMarketplaceAccount): nombre y foto reales, y el
 * acceso al panel solo para quien tiene un rol en un comercio. El servidor
 * sigue autorizando cada pantalla del panel.
 */
export function MarketplaceHeader({
  showBack,
  onBack,
  onOpenProfile,
  cartItemCount = 0,
  onOpenCart,
}: MarketplaceHeaderProps) {
  const { signOut } = useSession();
  const account = useMarketplaceAccount();
  const colors = usePalette();
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { schedule, onDismiss } = useAfterDismiss();
  const [menuVisible, setMenuVisible] = useState(false);

  const signedIn = account.kind === 'buyer';
  const name = accountDisplayName(account);
  const initial = (account.fullName || account.email || '?').trim().charAt(0).toUpperCase();
  const business = account.business;
  const panelAllowed = canOpenBusinessPanel(business);

  const openMenu = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setMenuVisible(true);
  };

  /** Cierra el menú y recién después navega: abrir otra pantalla con el modal yéndose la deja colgada en iOS. */
  const closeThen = (action?: () => void) => {
    if (action) schedule(action);
    setMenuVisible(false);
  };

  const handleSignOut = () => {
    closeThen(() => Alert.alert('Cerrar sesión', '¿Querés salir de tu cuenta en este teléfono?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
          await signOut();
        },
      },
    ]));
  };

  const avatar = (size: number) => (
    <View style={[styles.avatarBase, { width: size, height: size, borderRadius: size / 2, backgroundColor: palette.primary }]}>
      {account.avatarUrl ? (
        <Image source={{ uri: account.avatarUrl }} style={styles.fill} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <Text style={[styles.avatarText, { fontSize: size * 0.42 }]}>{initial}</Text>
      )}
    </View>
  );

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

          <Pressable onPress={() => router.replace('/')} accessibilityRole="link" style={styles.brandContainer}>
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
              accessibilityLabel={cartItemCount > 0 ? `Ver carrito, ${cartItemCount} productos` : 'Ver carrito de compras'}
              style={({ pressed }) => [
                styles.cartButton,
                {
                  backgroundColor: cartItemCount > 0 ? (dark ? 'rgba(37,99,235,0.2)' : 'rgba(37,99,235,0.1)') : colors.background,
                  borderColor: cartItemCount > 0 ? palette.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}>
              <Ionicons name={cartItemCount > 0 ? 'cart' : 'cart-outline'} size={19} color={cartItemCount > 0 ? palette.primary : colors.text} />
              {cartItemCount > 0 && (
                <View style={styles.cartBadge}>
                  <Text style={styles.cartBadgeText}>{cartItemCount > 99 ? '99+' : cartItemCount}</Text>
                </View>
              )}
            </Pressable>
          )}

          <Pressable
            onPress={openMenu}
            accessibilityRole="button"
            accessibilityLabel={signedIn ? `Menú de cuenta de ${name}` : 'Abrir menú de cuenta'}
            style={({ pressed }) => [
              styles.profileButton,
              {
                backgroundColor: signedIn ? (dark ? 'rgba(37,99,235,0.2)' : 'rgba(37,99,235,0.1)') : colors.background,
                borderColor: signedIn ? palette.primary : colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}>
            {signedIn ? (
              <View style={styles.profileActiveRow}>
                {avatar(24)}
                <Ionicons name="chevron-down" size={14} color={palette.primary} />
              </View>
            ) : (
              <View style={styles.profileActiveRow}>
                <Ionicons name="person-circle-outline" size={20} color={colors.text} />
                <Ionicons name="chevron-down" size={12} color={colors.muted} />
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <Modal visible={menuVisible} transparent animationType="fade" statusBarTranslucent onRequestClose={() => closeThen()} onDismiss={onDismiss}>
        <View style={[styles.overlay, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => closeThen()} accessibilityLabel="Cerrar menú de cuenta" accessibilityRole="button" />
          <View
            accessibilityViewIsModal
            style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, maxHeight: height - insets.top - insets.bottom - 24 }]}>
            {/* Cabecera: quién soy */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              {signedIn ? avatar(48) : (
                <View style={[styles.avatarBase, styles.guestAvatar, { backgroundColor: dark ? 'rgba(37,99,235,0.2)' : 'rgba(37,99,235,0.1)' }]}>
                  <Ionicons name="person-outline" size={24} color={palette.primary} />
                </View>
              )}
              <View style={styles.flex}>
                <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>{name}</Text>
                <Text numberOfLines={1} style={[styles.sub, { color: colors.muted }]}>
                  {signedIn ? account.email : 'Entrá para ver tus pedidos y guardar favoritos'}
                </Text>
              </View>
              <Pressable onPress={() => closeThen()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Cerrar" style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.body} bounces={false} showsVerticalScrollIndicator={false}>
              {signedIn ? (
                <>
                  <Group label="Mi cuenta" colors={colors}>
                    {onOpenProfile && (
                      <Row icon="person-outline" title="Mi perfil" sub="Actividad, favoritos y carrito" colors={colors} onPress={() => closeThen(onOpenProfile)} />
                    )}
                    <Row icon="bag-handle-outline" title="Mis pedidos" sub="Compras en las tiendas" colors={colors} onPress={() => closeThen(() => router.push('/mis-pedidos' as never))} />
                    <Row icon="create-outline" title="Editar perfil" sub="Nombre, teléfono y foto" colors={colors} onPress={() => closeThen(() => router.push('/mi-cuenta' as never))} />
                  </Group>

                  <Group label="Mi negocio" colors={colors}>
                    {panelAllowed && business.state === 'member' ? (
                      <Row
                        icon="grid-outline"
                        title={`Panel de ${business.organization.name}`}
                        sub={`Tu rol: ${ROLE_LABELS[business.organization.role] ?? business.organization.role}`}
                        colors={colors}
                        highlight
                        onPress={() => closeThen(() => router.push('/panel' as never))}
                      />
                    ) : account.status === 'loading' ? (
                      <View style={styles.inline}>
                        <ActivityIndicator size="small" color={palette.primary} />
                        <Text style={[styles.sub, { color: colors.muted }]}>Revisando si tenés un negocio…</Text>
                      </View>
                    ) : business.state === 'unknown' ? (
                      <Pressable onPress={account.reload} accessibilityRole="button" style={styles.inline}>
                        <Ionicons name="refresh" size={16} color={palette.primary} />
                        <Text style={[styles.sub, { color: colors.muted }]}>No pudimos revisar tu negocio. <Text style={{ color: palette.primary, fontWeight: '700' }}>Reintentar</Text></Text>
                      </Pressable>
                    ) : (
                      <Row icon="storefront-outline" title="¿Tenés un negocio?" sub="Vendé en el marketplace con tu propio sistema" colors={colors} onPress={() => closeThen(() => router.push('/saas' as never))} />
                    )}
                  </Group>

                  <Row icon="log-out-outline" title="Cerrar sesión" colors={colors} danger onPress={handleSignOut} />
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => closeThen(() => router.push('/sign-in' as never))}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.primary, { opacity: pressed ? 0.88 : 1 }]}>
                    <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.primaryText}>Iniciar sesión</Text>
                  </Pressable>
                  <Row icon="cube-outline" title="Ver productos" sub="Catálogo de todas las tiendas" colors={colors} onPress={() => closeThen(() => router.push('/products' as never))} />
                  <Row icon="storefront-outline" title="¿Tenés un negocio?" sub="Conocé el sistema y sus planes" colors={colors} onPress={() => closeThen(() => router.push('/saas' as never))} />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

function Group({ label, colors, children }: { label: string; colors: ReturnType<typeof usePalette>; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, { color: colors.muted }]}>{label}</Text>
      {children}
    </View>
  );
}

function Row({ icon, title, sub, onPress, colors, highlight, danger }: {
  icon: IconName;
  title: string;
  sub?: string;
  onPress: () => void;
  colors: ReturnType<typeof usePalette>;
  highlight?: boolean;
  danger?: boolean;
}) {
  const tint = danger ? palette.danger : palette.primary;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { borderColor: highlight ? palette.primary : colors.border, backgroundColor: highlight ? 'rgba(37,99,235,0.08)' : colors.background, opacity: pressed ? 0.8 : 1 },
      ]}>
      <View style={[styles.rowIcon, { backgroundColor: danger ? 'rgba(220,38,38,0.1)' : 'rgba(37,99,235,0.1)' }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={styles.flex}>
        <Text style={[styles.rowTitle, { color: danger ? palette.danger : colors.text }]}>{title}</Text>
        {sub ? <Text style={[styles.sub, { color: colors.muted }]}>{sub}</Text> : null}
      </View>
      {!danger && <Ionicons name="chevron-forward" size={16} color={colors.muted} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  navLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backBtn: { padding: 4 },
  brandContainer: { flexDirection: 'row', alignItems: 'center', gap: 9, flexShrink: 1 },
  brandIcon: { width: 30, height: 30, borderRadius: 9 },
  brandTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5, flexShrink: 1 },
  cartButton: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  cartBadge: { position: 'absolute', top: -3, right: -3, backgroundColor: '#DC2626', borderRadius: 10, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  cartBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  profileButton: { borderWidth: 1, borderRadius: 22, paddingHorizontal: 8, minHeight: 40, justifyContent: 'center' },
  profileActiveRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  avatarBase: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  guestAvatar: { width: 48, height: 48, borderRadius: 24 },
  avatarText: { color: '#FFFFFF', fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  card: { width: '100%', maxWidth: 420, borderRadius: 24, borderWidth: 1, overflow: 'hidden', elevation: 8, shadowColor: '#0F172A', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  name: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 12, lineHeight: 16 },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, gap: 14 },
  group: { gap: 8 },
  groupLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, minHeight: 56, paddingVertical: 8 },
  rowIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  primary: { minHeight: 50, borderRadius: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
