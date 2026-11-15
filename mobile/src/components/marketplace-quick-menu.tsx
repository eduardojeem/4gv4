import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAfterDismiss } from '@/lib/after-dismiss';
import { marketplaceQuickActivityKeys } from '@/lib/marketplace-nav-model';
import { palette, usePalette } from '@/lib/palette';

export type MarketplaceQuickMenuProps = {
  visible: boolean;
  onClose: () => void;
  signedIn: boolean;
  locationLabel: string;
  favoritesCount: number;
  categoriesCount: number;
  storesCount: number;
  canOpenPanel: boolean;
  orgName?: string | null;
  registerLabel: string;
  onSearchProducts: (query?: string) => void;
  onOpenStores: () => void;
  onOpenCategories: () => void;
  onOpenFavorites: () => void;
  onOpenOrders: () => void;
  onOpenRepairs: () => void;
  onSignIn: () => void;
  onOpenPanel: () => void;
  onOpenSaas: () => void;
};

export function MarketplaceQuickMenu({
  visible,
  onClose,
  signedIn,
  locationLabel,
  favoritesCount,
  categoriesCount,
  storesCount,
  canOpenPanel,
  orgName,
  registerLabel,
  onSearchProducts,
  onOpenStores,
  onOpenCategories,
  onOpenFavorites,
  onOpenOrders,
  onOpenRepairs,
  onSignIn,
  onOpenPanel,
  onOpenSaas,
}: MarketplaceQuickMenuProps) {
  const colors = usePalette();
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { schedule, onDismiss } = useAfterDismiss();
  const [searchQuery, setSearchQuery] = useState('');
  const [slideAnim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) {
      slideAnim.setValue(0);
      return;
    }
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 22,
      bounciness: 5,
    }).start();
  }, [visible, slideAnim]);

  const closeMenu = () => {
    Keyboard.dismiss();
    setSearchQuery('');
    onClose();
  };

  const closeThen = (action: () => void) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    schedule(action);
    closeMenu();
  };

  const submitSearch = () => {
    const trimmed = searchQuery.trim();
    closeThen(() => onSearchProducts(trimmed));
  };

  const activities = marketplaceQuickActivityKeys(signedIn);
  const cardBg = dark ? '#0F172A' : '#FFFFFF';
  const cardBorder = dark ? '#1E293B' : '#E2E8F0';
  const subtlePillBg = dark ? '#1E293B' : '#F1F5F9';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={closeMenu}
      onDismiss={onDismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[
          styles.overlay,
          { backgroundColor: dark ? 'rgba(2, 6, 23, 0.78)' : 'rgba(15, 23, 42, 0.5)' },
        ]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeMenu}
          accessibilityRole="button"
          accessibilityLabel="Cerrar menú de accesos rápidos"
        />

        <View
          style={[
            styles.deckWrap,
            { paddingBottom: Math.max(insets.bottom, 10) + 8 },
          ]}
          pointerEvents="box-none">
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
                maxHeight: Math.min(height * 0.74, 620),
                opacity: slideAnim,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [28, 0],
                    }),
                  },
                  {
                    scale: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}>
            <View style={[styles.handle, { backgroundColor: dark ? '#334155' : '#CBD5E1' }]} />

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.cardBody}>
              {/* ── Cabecera del panel Bento ── */}
              <View style={styles.headerRow}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Accesos rápidos</Text>
                <View style={[styles.locationPill, { backgroundColor: subtlePillBg, borderColor: cardBorder }]}>
                  <Ionicons name="location-sharp" size={12} color={palette.primary} />
                  <Text numberOfLines={1} style={[styles.locationPillText, { color: colors.text }]}>
                    {locationLabel}
                  </Text>
                </View>
              </View>

              {/* ── Buscador integrado ── */}
              <View
                style={[
                  styles.searchPill,
                  {
                    backgroundColor: subtlePillBg,
                    borderColor: searchQuery ? palette.primary : cardBorder,
                  },
                ]}>
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={searchQuery ? palette.primary : colors.muted}
                />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={submitSearch}
                  placeholder="Buscar productos, marcas…"
                  placeholderTextColor={colors.muted}
                  returnKeyType="search"
                  style={[styles.searchInput, { color: colors.text }]}
                />
                {searchQuery.length > 0 && (
                  <Pressable
                    onPress={() => setSearchQuery('')}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Limpiar búsqueda">
                    <Ionicons name="close-circle" size={17} color={colors.muted} />
                  </Pressable>
                )}
                <Pressable
                  onPress={submitSearch}
                  accessibilityRole="button"
                  accessibilityLabel="Buscar productos"
                  style={({ pressed }) => [
                    styles.searchSubmitBtn,
                    { opacity: pressed ? 0.85 : 1 },
                  ]}>
                  <Ionicons name="search" size={16} color="#FFFFFF" />
                </Pressable>
              </View>

              {!signedIn ? (
                <>
                  {/* ── Modo Visitante: Tarjetas Bento principales ── */}
                  <View style={styles.bentoRow}>
                    <Pressable
                      onPress={() => closeThen(() => onSearchProducts())}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.bentoLargeCard,
                        {
                          backgroundColor: dark ? 'rgba(37, 99, 235, 0.16)' : '#EFF6FF',
                          borderColor: dark ? 'rgba(59, 130, 246, 0.35)' : '#BFDBFE',
                          opacity: pressed ? 0.86 : 1,
                        },
                      ]}>
                      <View style={[styles.squircleLarge, { backgroundColor: '#2563EB' }]}>
                        <Ionicons name="search" size={20} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.bentoTitle, { color: colors.text }]}>Buscar productos</Text>
                      <Text style={[styles.bentoSub, { color: colors.muted }]}>
                        Catálogo, ofertas y marcas
                      </Text>
                      <View
                        style={[
                          styles.bentoTagPill,
                          { backgroundColor: dark ? 'rgba(37, 99, 235, 0.3)' : '#DBEAFE' },
                        ]}>
                        <Text
                          style={[
                            styles.bentoTagText,
                            { color: dark ? '#93C5FD' : '#1D4ED8' },
                          ]}>
                          Explorar ›
                        </Text>
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={() => closeThen(onOpenStores)}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.bentoLargeCard,
                        {
                          backgroundColor: dark ? 'rgba(79, 70, 229, 0.16)' : '#EEF2FF',
                          borderColor: dark ? 'rgba(99, 102, 241, 0.35)' : '#C7D2FE',
                          opacity: pressed ? 0.86 : 1,
                        },
                      ]}>
                      <View style={[styles.squircleLarge, { backgroundColor: '#4F46E5' }]}>
                        <Ionicons name="storefront" size={20} color="#FFFFFF" />
                      </View>
                      <Text style={[styles.bentoTitle, { color: colors.text }]}>Ver tiendas</Text>
                      <Text style={[styles.bentoSub, { color: colors.muted }]}>
                        {storesCount > 0 ? `${storesCount} comercios adheridos` : 'Comercios adheridos'}
                      </Text>
                      <View
                        style={[
                          styles.bentoTagPill,
                          { backgroundColor: dark ? 'rgba(79, 70, 229, 0.32)' : '#E0E7FF' },
                        ]}>
                        <Text
                          style={[
                            styles.bentoTagText,
                            { color: dark ? '#C7D2FE' : '#4338CA' },
                          ]}>
                          Directorio ›
                        </Text>
                      </View>
                    </Pressable>
                  </View>

                  {/* ── Fila secundaria compacta ── */}
                  <View style={styles.bentoRow}>
                    <Pressable
                      onPress={() => closeThen(onOpenCategories)}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.bentoCompactCard,
                        {
                          backgroundColor: dark ? 'rgba(245, 158, 11, 0.14)' : '#FFFBEB',
                          borderColor: dark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A',
                          opacity: pressed ? 0.86 : 1,
                        },
                      ]}>
                      <View style={[styles.squircleSmall, { backgroundColor: '#F59E0B' }]}>
                        <Ionicons name="grid" size={16} color="#FFFFFF" />
                      </View>
                      <View style={styles.flex}>
                        <Text numberOfLines={1} style={[styles.bentoCompactTitle, { color: colors.text }]}>
                          Categorías
                        </Text>
                        {categoriesCount > 0 && (
                          <Text style={[styles.bentoCompactSub, { color: colors.muted }]}>
                            {categoriesCount} rubros
                          </Text>
                        )}
                      </View>
                    </Pressable>

                    <Pressable
                      onPress={() => closeThen(onOpenFavorites)}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.bentoCompactCard,
                        {
                          backgroundColor: dark ? 'rgba(244, 63, 94, 0.14)' : '#FFF1F2',
                          borderColor: dark ? 'rgba(244, 63, 94, 0.3)' : '#FECDD3',
                          opacity: pressed ? 0.86 : 1,
                        },
                      ]}>
                      <View style={[styles.squircleSmall, { backgroundColor: '#F43F5E' }]}>
                        <Ionicons name="heart" size={16} color="#FFFFFF" />
                      </View>
                      <View style={styles.flex}>
                        <Text numberOfLines={1} style={[styles.bentoCompactTitle, { color: colors.text }]}>
                          Favoritos
                        </Text>
                        <Text style={[styles.bentoCompactSub, { color: colors.muted }]}>
                          {favoritesCount} guardado{favoritesCount !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    </Pressable>
                  </View>

                  {/* ── Banner oscuro de acceso ── */}
                  <Pressable
                    onPress={() => closeThen(onSignIn)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.guestAuthBanner,
                      {
                        backgroundColor: dark ? '#1E293B' : '#0F172A',
                        borderColor: dark ? '#334155' : '#0F172A',
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}>
                    <Text style={styles.guestAuthText}>
                      Entrá para ver tus pedidos y reparaciones
                    </Text>
                    <View style={styles.guestAuthPill}>
                      <Text style={styles.guestAuthPillText}>Acceder ›</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    onPress={() => closeThen(onOpenSaas)}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.guestSaasLink, { opacity: pressed ? 0.7 : 1 }]}>
                    <Ionicons name="rocket-outline" size={14} color={palette.primary} />
                    <Text style={[styles.guestSaasLinkText, { color: colors.muted }]}>
                      ¿Tenés un negocio?{' '}
                      <Text style={{ color: colors.text, fontWeight: '800' }}>Publicá tu tienda ›</Text>
                    </Text>
                  </Pressable>
                </>
              ) : (
                <>
                  {/* ── Modo Con Sesión: Explorar compacto + Tu Actividad ── */}
                  <View style={styles.bentoRow}>
                    <Pressable
                      onPress={() => closeThen(() => onSearchProducts())}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.bentoCompactCard,
                        {
                          backgroundColor: dark ? 'rgba(37, 99, 235, 0.16)' : '#EFF6FF',
                          borderColor: dark ? 'rgba(59, 130, 246, 0.35)' : '#BFDBFE',
                          opacity: pressed ? 0.86 : 1,
                        },
                      ]}>
                      <View style={[styles.squircleSmall, { backgroundColor: '#2563EB' }]}>
                        <Ionicons name="search" size={16} color="#FFFFFF" />
                      </View>
                      <Text numberOfLines={2} style={[styles.bentoCompactTitle, styles.flex, { color: colors.text }]}>
                        Buscar productos
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => closeThen(onOpenStores)}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.bentoCompactCard,
                        {
                          backgroundColor: dark ? 'rgba(79, 70, 229, 0.16)' : '#EEF2FF',
                          borderColor: dark ? 'rgba(99, 102, 241, 0.35)' : '#C7D2FE',
                          opacity: pressed ? 0.86 : 1,
                        },
                      ]}>
                      <View style={[styles.squircleSmall, { backgroundColor: '#4F46E5' }]}>
                        <Ionicons name="storefront" size={16} color="#FFFFFF" />
                      </View>
                      <Text numberOfLines={2} style={[styles.bentoCompactTitle, styles.flex, { color: colors.text }]}>
                        Ver tiendas
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.bentoRow}>
                    <Pressable
                      onPress={() => closeThen(onOpenCategories)}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.miniOutlineTile,
                        {
                          backgroundColor: subtlePillBg,
                          borderColor: cardBorder,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}>
                      <Ionicons name="grid-outline" size={16} color="#F59E0B" />
                      <Text numberOfLines={1} style={[styles.miniOutlineText, { color: colors.text }]}>
                        Categorías
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={() => closeThen(onOpenFavorites)}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.miniOutlineTile,
                        {
                          backgroundColor: subtlePillBg,
                          borderColor: cardBorder,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}>
                      <Ionicons name="heart-outline" size={16} color="#F43F5E" />
                      <Text numberOfLines={1} style={[styles.miniOutlineText, { color: colors.text }]}>
                        Favoritos ({favoritesCount})
                      </Text>
                    </Pressable>
                  </View>

                  {/* ── Tu Actividad (solo con sesión) ── */}
                  {activities.length > 0 && (
                    <View style={styles.activitySection}>
                      <View style={styles.activityHeader}>
                        <Text style={[styles.activityEyebrow, { color: colors.muted }]}>TU ACTIVIDAD</Text>
                        <View style={styles.liveDot} />
                      </View>

                      <View style={styles.bentoRow}>
                        <Pressable
                          onPress={() => closeThen(onOpenOrders)}
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            styles.bentoLargeCard,
                            {
                              backgroundColor: dark ? 'rgba(37, 99, 235, 0.16)' : '#F0F9FF',
                              borderColor: dark ? 'rgba(56, 189, 248, 0.38)' : '#BAE6FD',
                              opacity: pressed ? 0.86 : 1,
                            },
                          ]}>
                          <View style={[styles.squircleLarge, { backgroundColor: '#2563EB' }]}>
                            <Ionicons name="bag-handle" size={20} color="#FFFFFF" />
                          </View>
                          <Text style={[styles.bentoTitle, { color: colors.text }]}>Mis pedidos</Text>
                          <Text style={[styles.bentoSub, { color: colors.muted }]}>
                            Compras en tiendas
                          </Text>
                          <View
                            style={[
                              styles.bentoTagPill,
                              { backgroundColor: dark ? 'rgba(37, 99, 235, 0.3)' : '#FFFFFF' },
                            ]}>
                            <Text
                              style={[
                                styles.bentoTagText,
                                { color: dark ? '#93C5FD' : '#1D4ED8' },
                              ]}>
                              Ver compras ›
                            </Text>
                          </View>
                        </Pressable>

                        <Pressable
                          onPress={() => closeThen(onOpenRepairs)}
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            styles.bentoLargeCard,
                            {
                              backgroundColor: dark ? 'rgba(6, 182, 212, 0.16)' : '#ECFEFF',
                              borderColor: dark ? 'rgba(34, 211, 238, 0.38)' : '#A5F3FC',
                              opacity: pressed ? 0.86 : 1,
                            },
                          ]}>
                          <View style={[styles.squircleLarge, { backgroundColor: '#0891B2' }]}>
                            <Ionicons name="construct" size={20} color="#FFFFFF" />
                          </View>
                          <Text style={[styles.bentoTitle, { color: colors.text }]}>Mis reparaciones</Text>
                          <Text style={[styles.bentoSub, { color: colors.muted }]}>
                            Estado en taller
                          </Text>
                          <View
                            style={[
                              styles.bentoTagPill,
                              { backgroundColor: dark ? 'rgba(6, 182, 212, 0.3)' : '#FFFFFF' },
                            ]}>
                            <Text
                              style={[
                                styles.bentoTagText,
                                { color: dark ? '#67E8F9' : '#0E7490' },
                              ]}>
                              Rastrear ›
                            </Text>
                          </View>
                        </Pressable>
                      </View>
                    </View>
                  )}

                  {/* ── Franja oscura inferior: Panel o Empezar negocio ── */}
                  <Pressable
                    onPress={() => closeThen(canOpenPanel ? onOpenPanel : onOpenSaas)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.obsidianStrip,
                      {
                        backgroundColor: dark ? '#1E293B' : '#0F172A',
                        borderColor: canOpenPanel ? '#06B6D4' : dark ? '#334155' : '#0F172A',
                        opacity: pressed ? 0.9 : 1,
                      },
                    ]}>
                    <Ionicons
                      name={canOpenPanel ? 'grid-outline' : 'rocket-outline'}
                      size={16}
                      color="#38BDF8"
                    />
                    <Text numberOfLines={1} style={styles.obsidianStripText}>
                      {canOpenPanel && orgName
                        ? `Panel de ${orgName}`
                        : `¿Tenés un negocio? ${registerLabel}`}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                  </Pressable>
                </>
              )}
            </ScrollView>
          </Animated.View>

          {/* ── Botón central X (morfado desde el botón +) ── */}
          <Pressable
            onPress={closeMenu}
            accessibilityRole="button"
            accessibilityLabel="Cerrar accesos rápidos"
            style={({ pressed }) => [
              styles.closeOrb,
              {
                backgroundColor: dark ? '#F8FAFC' : '#0F172A',
                borderColor: dark ? '#334155' : '#FFFFFF',
                opacity: pressed ? 0.85 : 1,
              },
            ]}>
            <Ionicons name="close" size={26} color={dark ? '#0F172A' : '#FFFFFF'} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  deckWrap: {
    width: '100%',
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 12,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 28,
    borderWidth: 1,
    paddingTop: 10,
    shadowColor: '#020617',
    shadowOpacity: 0.28,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 165,
  },
  locationPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    paddingLeft: 14,
    paddingRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '500',
    paddingVertical: 6,
  },
  searchSubmitBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bentoLargeCard: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 13,
    gap: 5,
    justifyContent: 'space-between',
  },
  squircleLarge: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    shadowColor: '#0F172A',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  bentoTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  bentoSub: {
    fontSize: 11.5,
    lineHeight: 15,
  },
  bentoTagPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 4,
  },
  bentoTagText: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  bentoCompactCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  squircleSmall: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoCompactTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  bentoCompactSub: {
    fontSize: 11,
    marginTop: 1,
  },
  miniOutlineTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  miniOutlineText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  activitySection: {
    gap: 8,
    marginTop: 2,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  activityEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  guestAuthBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  guestAuthText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    lineHeight: 17,
  },
  guestAuthPill: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  guestAuthPillText: {
    color: '#0F172A',
    fontSize: 12.5,
    fontWeight: '800',
  },
  guestSaasLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  guestSaasLinkText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  obsidianStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  obsidianStripText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  closeOrb: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#020617',
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
});
