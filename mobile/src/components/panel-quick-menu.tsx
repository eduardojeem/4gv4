import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
import { palette, usePalette } from '@/lib/palette';
import { hasNativePanelSection, usePanel } from '@/lib/panel';
import {
  buildPanelQuickActions,
  buildPanelSectionShortcuts,
  filterPanelQuickSearch,
  MAX_PINNED_SHORTCUTS,
  panelTileTone,
  pinnedShortcutsStorageKey,
  resolvePinnedShortcutKeys,
  togglePinnedShortcutKey,
  type PanelShortcutItem,
} from '@/lib/panel-nav-model';
import { sectionMenuActive } from '@/lib/sections-menu-model';
import { secureStorage } from '@/lib/secure-storage';

const COBALT = '#2563EB';
const ADMIN_INDIGO = '#1E1B4B';

export type PanelQuickMenuProps = {
  visible: boolean;
  onClose: () => void;
  onOpenSections: () => void;
};

export function PanelQuickMenu({ visible, onClose, onOpenSections }: PanelQuickMenuProps) {
  const colors = usePalette();
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const pathname = usePathname();
  const { data, findItem } = usePanel();
  const { schedule, onDismiss } = useAfterDismiss();

  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savedKeys, setSavedKeys] = useState<string[] | null>(null);
  const [slideAnim] = useState(() => new Animated.Value(0));

  const org = data?.organization;
  const user = data?.user;
  const groups = useMemo(() => data?.groups ?? [], [data?.groups]);
  const canOpenAdmin = Boolean(user?.isAdmin || user?.isSuperAdmin || findItem('administration'));
  const storageKey = pinnedShortcutsStorageKey(org?.id);

  useEffect(() => {
    let active = true;
    secureStorage
      .getItem(storageKey)
      .then((raw) => {
        if (!active) return;
        if (!raw) {
          setSavedKeys(null);
          return;
        }
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
          setSavedKeys(parsed);
        } else {
          setSavedKeys(null);
        }
      })
      .catch(() => {
        if (active) setSavedKeys(null);
      });
    return () => {
      active = false;
    };
  }, [storageKey]);

  useEffect(() => {
    if (!visible) {
      slideAnim.setValue(0);
      return;
    }
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 24,
      bounciness: 5,
    }).start();
  }, [visible, slideAnim]);

  const closeMenu = () => {
    Keyboard.dismiss();
    setSearchOpen(false);
    setQuery('');
    setEditing(false);
    setShowAll(false);
    onClose();
  };

  const navigateNow = (route: string) => {
    void Haptics.selectionAsync().catch(() => undefined);
    closeMenu();
    router.navigate(route as never);
  };

  const openSectionsAfterDismiss = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    schedule(onOpenSections);
    closeMenu();
  };

  const sectionShortcuts = useMemo(
    () => buildPanelSectionShortcuts(groups, data?.businessFocus),
    [groups, data?.businessFocus]
  );
  const quickActions = useMemo(() => buildPanelQuickActions(data), [data]);
  const allSelectable = useMemo(
    () => [...sectionShortcuts, ...quickActions],
    [sectionShortcuts, quickActions]
  );

  const validKeySet = useMemo(() => new Set(allSelectable.map((item) => item.key)), [allSelectable]);
  const shortcutByKey = useMemo(
    () => new Map(allSelectable.map((item) => [item.key, item])),
    [allSelectable]
  );

  // En vista normal siempre completamos hasta 4 favoritos válidos; en edición reflejamos la selección exacta (0..4)
  const effectivePinnedKeys = useMemo(
    () => resolvePinnedShortcutKeys(savedKeys, allSelectable, sectionShortcuts, MAX_PINNED_SHORTCUTS),
    [savedKeys, allSelectable, sectionShortcuts]
  );

  const editSelectedKeys = useMemo(() => {
    if (savedKeys === null) return effectivePinnedKeys;
    return savedKeys.filter((key) => validKeySet.has(key)).slice(0, MAX_PINNED_SHORTCUTS);
  }, [savedKeys, effectivePinnedKeys, validKeySet]);

  const activePinnedKeys = editing ? editSelectedKeys : effectivePinnedKeys;
  const pinnedItems = useMemo(
    () =>
      activePinnedKeys
        .map((key) => shortcutByKey.get(key))
        .filter((item): item is PanelShortcutItem => Boolean(item)),
    [activePinnedKeys, shortcutByKey]
  );

  const pinnedSet = useMemo(() => new Set(activePinnedKeys), [activePinnedKeys]);
  const remainingSections = useMemo(
    () => sectionShortcuts.filter((item) => !pinnedSet.has(item.key)),
    [sectionShortcuts, pinnedSet]
  );
  const extraCount = remainingSections.length + quickActions.length;

  const searchResults = useMemo(
    () => filterPanelQuickSearch(groups, query, quickActions),
    [groups, query, quickActions]
  );

  const persistPinnedKeys = (nextKeys: string[]) => {
    const clean = nextKeys.slice(0, MAX_PINNED_SHORTCUTS);
    setSavedKeys(clean);
    void secureStorage.setItem(storageKey, JSON.stringify(clean)).catch(() => undefined);
  };

  const handleTogglePin = (key: string) => {
    void Haptics.selectionAsync().catch(() => undefined);
    const current = savedKeys === null ? effectivePinnedKeys : editSelectedKeys;
    const next = togglePinnedShortcutKey(current, key, MAX_PINNED_SHORTCUTS);
    persistPinnedKeys(next);
  };

  const handleFinishEditing = () => {
    if (editSelectedKeys.length === 0) {
      persistPinnedKeys(resolvePinnedShortcutKeys([], allSelectable, sectionShortcuts, MAX_PINNED_SHORTCUTS));
    }
    setEditing(false);
  };

  const cardWidth = Math.min(width - 28, 392);
  const tileGap = 6;
  const tileWidth = Math.max(58, Math.floor((cardWidth - 26 - tileGap * 3) / 4));
  const sheetBg = dark ? '#0F172A' : '#FFFFFF';
  const sheetBorder = dark ? '#1E293B' : '#E2E8F0';
  const headerChipBg = dark ? '#1E293B' : '#F1F5F9';
  const dividerColor = dark ? '#1E293B' : '#E2E8F0';
  const initial = (org?.name || 'M').trim().charAt(0).toUpperCase();

  const isTileActive = (item: PanelShortcutItem) => {
    if (item.kind === 'action') return pathname === item.route;
    return sectionMenuActive(pathname, item.key);
  };

  const renderTile = (
    item: PanelShortcutItem,
    index: number,
    options?: {
      badge?: 'check' | 'plus' | 'remove';
      tinted?: boolean;
      onPress?: () => void;
      accessibilityLabel?: string;
    }
  ) => {
    const active = !editing && isTileActive(item);
    const tone = options?.tinted ? panelTileTone(index, item.kind) : panelTileTone(4, item.kind);
    const bg = dark ? tone.darkBg : tone.lightBg;
    const border = active || options?.badge === 'check'
      ? COBALT
      : dark
        ? tone.darkBorder
        : tone.lightBorder;
    const iconColor = active ? COBALT : dark ? tone.darkIcon : tone.lightIcon;

    return (
      <Pressable
        key={item.key}
        onPress={options?.onPress ?? (() => navigateNow(item.route))}
        accessibilityRole="button"
        accessibilityLabel={options?.accessibilityLabel ?? item.label}
        accessibilityState={{ selected: active || options?.badge === 'check' }}
        style={({ pressed }) => [
          styles.tile,
          {
            width: tileWidth,
            backgroundColor: bg,
            borderColor: border,
            borderWidth: active || options?.badge === 'check' ? 1.5 : 1,
            opacity: pressed ? 0.82 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }],
          },
        ]}>
        {options?.badge === 'check' && (
          <View style={[styles.tileBadge, { backgroundColor: COBALT }]}>
            <Ionicons name="checkmark" size={9} color="#FFFFFF" />
          </View>
        )}
        {options?.badge === 'plus' && (
          <View
            style={[
              styles.tileBadge,
              { backgroundColor: dark ? '#334155' : '#E2E8F0' },
            ]}>
            <Ionicons name="add" size={9} color={dark ? '#E2E8F0' : '#475569'} />
          </View>
        )}
        {options?.badge === 'remove' && (
          <View
            style={[
              styles.tileBadge,
              { backgroundColor: dark ? '#334155' : '#FFFFFF', borderWidth: 1, borderColor: border },
            ]}>
            <Ionicons name="close" size={9} color={COBALT} />
          </View>
        )}
        <Ionicons name={item.icon} size={16} color={iconColor} />
        <Text
          numberOfLines={1}
          style={[
            styles.tileLabel,
            {
              color: active ? COBALT : dark ? '#F1F5F9' : '#0F172A',
            },
          ]}>
          {item.shortLabel}
        </Text>
      </Pressable>
    );
  };

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
          { backgroundColor: dark ? 'rgba(2, 6, 23, 0.72)' : 'rgba(15, 23, 42, 0.36)' },
        ]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={closeMenu}
          accessibilityRole="button"
          accessibilityLabel="Cerrar menú rápido del panel"
        />

        <View
          pointerEvents="box-none"
          style={[styles.deckWrap, { paddingBottom: Math.max(insets.bottom, 10) + 8 }]}>
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.card,
              {
                backgroundColor: sheetBg,
                borderColor: sheetBorder,
                maxHeight: Math.min(height * (editing || showAll ? 0.74 : 0.62), 540),
                opacity: slideAnim,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [22, 0],
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

            {/* ── Cabecera limpia en 1 fila (sin Admin apretado) ── */}
            <View style={styles.headerRow}>
              <View style={styles.orgLogo}>
                {org?.logoUrl ? (
                  <Image source={org.logoUrl} style={styles.fill} contentFit="cover" />
                ) : (
                  <Text style={styles.orgInitial}>{initial}</Text>
                )}
              </View>

              <Text numberOfLines={1} style={[styles.orgName, { color: colors.text }]}>
                {org?.name ?? 'Mi Negocio'}
              </Text>

              <Pressable
                onPress={() => {
                  setEditing(false);
                  setSearchOpen((prev) => {
                    if (prev) setQuery('');
                    return !prev;
                  });
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={searchOpen ? 'Cerrar buscador de secciones' : 'Buscar sección'}
                style={({ pressed }) => [
                  styles.headerIconBtn,
                  {
                    backgroundColor: searchOpen ? COBALT : headerChipBg,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}>
                <Ionicons
                  name={searchOpen ? 'close' : 'search'}
                  size={15}
                  color={searchOpen ? '#FFFFFF' : colors.text}
                />
              </Pressable>

              <Pressable
                onPress={openSectionsAfterDismiss}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Ver todas las secciones en menú lateral"
                style={({ pressed }) => [
                  styles.headerIconBtn,
                  { backgroundColor: headerChipBg, opacity: pressed ? 0.8 : 1 },
                ]}>
                <Ionicons name="menu" size={16} color={colors.text} />
              </Pressable>
            </View>

            {/* ── Buscador compacto opcional ── */}
            {searchOpen && (
              <View
                style={[
                  styles.searchBox,
                  { backgroundColor: headerChipBg, borderColor: query ? COBALT : sheetBorder },
                ]}>
                <Ionicons name="search" size={14} color={colors.muted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar sección o acción (reparación, caja, venta…)"
                  placeholderTextColor={colors.muted}
                  autoFocus
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  accessibilityLabel="Buscar sección del panel"
                  style={[styles.searchInput, { color: colors.text }]}
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Limpiar búsqueda">
                    <Ionicons name="close-circle" size={15} color={colors.muted} />
                  </Pressable>
                )}
              </View>
            )}

            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.scrollBody}>
              {searchOpen && query.trim().length > 0 ? (
                <View style={styles.searchList}>
                  {searchResults.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.muted }]}>
                      No encontramos esa sección ni acción rápida.
                    </Text>
                  ) : (
                    searchResults.map((item) => {
                      const active = isTileActive(item);
                      const isWeb = item.sectionKey ? !hasNativePanelSection(item.sectionKey) : false;
                      return (
                        <Pressable
                          key={item.key}
                          onPress={() => navigateNow(item.route)}
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            styles.searchRow,
                            {
                              backgroundColor: active
                                ? dark
                                  ? 'rgba(37, 99, 235, 0.2)'
                                  : '#EFF6FF'
                                : headerChipBg,
                              borderColor: active ? COBALT : 'transparent',
                              opacity: pressed ? 0.8 : 1,
                            },
                          ]}>
                          <Ionicons
                            name={item.icon}
                            size={16}
                            color={active ? COBALT : colors.text}
                          />
                          <Text numberOfLines={1} style={[styles.searchRowLabel, { color: colors.text }]}>
                            {item.label}
                          </Text>
                          <Text style={[styles.searchRowGroup, { color: colors.muted }]}>
                            {item.groupLabel}
                            {isWeb ? ' · Web' : ''}
                          </Text>
                          <Ionicons
                            name={isWeb ? 'open-outline' : 'chevron-forward'}
                            size={13}
                            color={colors.muted}
                          />
                        </Pressable>
                      );
                    })
                  )}
                </View>
              ) : editing ? (
                /* ── MODO CAMBIAR 4 PRINCIPALES ── */
                <View style={styles.sectionBlock}>
                  <View style={styles.subHeaderRow}>
                    <Text style={[styles.editHeading, { color: dark ? '#93C5FD' : COBALT }]}>
                      Elegí 4 accesos principales ({editSelectedKeys.length}/4)
                    </Text>
                    <Pressable
                      onPress={handleFinishEditing}
                      accessibilityRole="button"
                      accessibilityLabel="Guardar accesos principales"
                      style={({ pressed }) => [
                        styles.donePill,
                        { opacity: pressed ? 0.85 : 1 },
                      ]}>
                      <Text style={styles.donePillText}>Listo</Text>
                      <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                    </Pressable>
                  </View>

                  <Text style={[styles.microLabel, { color: colors.muted }]}>
                    TU BARRA PRINCIPAL (TOCA PARA QUITAR)
                  </Text>
                  <View style={styles.grid}>
                    {pinnedItems.map((item, index) =>
                      renderTile(item, index, {
                        tinted: true,
                        badge: 'remove',
                        onPress: () => handleTogglePin(item.key),
                        accessibilityLabel: `Quitar ${item.label} de principales`,
                      })
                    )}
                    {Array.from({ length: Math.max(0, MAX_PINNED_SHORTCUTS - pinnedItems.length) }).map(
                      (_, slotIdx) => (
                        <View
                          key={`slot-${slotIdx}`}
                          style={[
                            styles.emptySlot,
                            {
                              width: tileWidth,
                              borderColor: dark ? '#334155' : '#CBD5E1',
                              backgroundColor: dark ? 'rgba(15, 23, 42, 0.5)' : '#F8FAFC',
                            },
                          ]}>
                          <Ionicons name="add-outline" size={15} color={colors.muted} />
                          <Text style={[styles.emptySlotText, { color: colors.muted }]}>Libre</Text>
                        </View>
                      )
                    )}
                  </View>

                  {quickActions.length > 0 && (
                    <>
                      <Text style={[styles.microLabel, styles.spacedMicro, { color: colors.muted }]}>
                        ACCIONES RÁPIDAS (PARA AGREGAR)
                      </Text>
                      <View style={styles.grid}>
                        {quickActions.map((item, idx) =>
                          renderTile(item, 4 + idx, {
                            badge: pinnedSet.has(item.key) ? 'check' : 'plus',
                            onPress: () => handleTogglePin(item.key),
                            accessibilityLabel: pinnedSet.has(item.key)
                              ? `Quitar ${item.label}`
                              : `Agregar ${item.label} a principales`,
                          })
                        )}
                      </View>
                    </>
                  )}

                  {sectionShortcuts.length > 0 && (
                    <>
                      <Text style={[styles.microLabel, styles.spacedMicro, { color: colors.muted }]}>
                        SECCIONES DEL PANEL
                      </Text>
                      <View style={styles.grid}>
                        {sectionShortcuts.map((item, idx) =>
                          renderTile(item, 4 + idx, {
                            badge: pinnedSet.has(item.key) ? 'check' : 'plus',
                            onPress: () => handleTogglePin(item.key),
                            accessibilityLabel: pinnedSet.has(item.key)
                              ? `Quitar ${item.label}`
                              : `Agregar ${item.label} a principales`,
                          })
                        )}
                      </View>
                    </>
                  )}
                </View>
              ) : (
                /* ── VISTA PRINCIPAL LIMPIA (SOLO 4 ACCESOS + CAMBIAR) ── */
                <View style={styles.sectionBlock}>
                  <View style={styles.subHeaderRow}>
                    <Text style={[styles.microLabel, { color: colors.muted }]}>
                      PRINCIPALES ({pinnedItems.length})
                    </Text>
                    <Pressable
                      onPress={() => {
                        setShowAll(false);
                        setEditing(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Cambiar accesos principales"
                      style={({ pressed }) => [
                        styles.changePill,
                        {
                          backgroundColor: dark ? 'rgba(37, 99, 235, 0.22)' : '#EFF6FF',
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}>
                      <Ionicons name="pencil" size={11} color={dark ? '#93C5FD' : COBALT} />
                      <Text style={[styles.changePillText, { color: dark ? '#93C5FD' : COBALT }]}>
                        Cambiar
                      </Text>
                    </Pressable>
                  </View>

                  <View style={styles.grid}>
                    {pinnedItems.map((item, index) =>
                      renderTile(item, index, { tinted: true })
                    )}
                  </View>

                  {extraCount > 0 && (
                    <Pressable
                      onPress={() => setShowAll((prev) => !prev)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        showAll
                          ? 'Ocultar secciones y acciones rápidas'
                          : `Ver todas las secciones (${extraCount})`
                      }
                      style={({ pressed }) => [
                        styles.expandBar,
                        {
                          backgroundColor: dark ? '#1E293B' : '#F8FAFC',
                          borderColor: sheetBorder,
                          opacity: pressed ? 0.82 : 1,
                        },
                      ]}>
                      <Text style={[styles.expandBarText, { color: colors.muted }]}>
                        {showAll ? 'Ocultar secciones' : `Ver todas las secciones (${extraCount})`}
                      </Text>
                      <Ionicons
                        name={showAll ? 'chevron-up' : 'chevron-down'}
                        size={14}
                        color={colors.muted}
                      />
                    </Pressable>
                  )}

                  {showAll && (
                    <View style={styles.expandedWrap}>
                      {quickActions.length > 0 && (
                        <>
                          <Text style={[styles.microLabel, { color: colors.muted }]}>
                            ACCIONES RÁPIDAS
                          </Text>
                          <View style={styles.grid}>
                            {quickActions.map((item, idx) => renderTile(item, 4 + idx))}
                          </View>
                        </>
                      )}

                      {remainingSections.length > 0 && (
                        <>
                          <Text style={[styles.microLabel, styles.spacedMicro, { color: colors.muted }]}>
                            MÁS SECCIONES
                          </Text>
                          <View style={styles.grid}>
                            {remainingSections.map((item, idx) => renderTile(item, 4 + idx))}
                          </View>
                        </>
                      )}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            {/* ── Botón mejorado Ir a Administración (fijo y bien ubicado abajo) ── */}
            {canOpenAdmin && (
              <View style={[styles.adminWrap, { borderTopColor: dividerColor }]}>
                <Pressable
                  onPress={() => navigateNow('/admin')}
                  accessibilityRole="button"
                  accessibilityLabel="Ir a Administración"
                  style={({ pressed }) => [
                    styles.adminCard,
                    {
                      backgroundColor: dark ? '#1E1B4B' : ADMIN_INDIGO,
                      opacity: pressed ? 0.9 : 1,
                      transform: [{ scale: pressed ? 0.985 : 1 }],
                    },
                  ]}>
                  <View style={styles.adminIconBadge}>
                    <Ionicons name="shield-checkmark" size={16} color="#22D3EE" />
                  </View>
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={styles.adminTitle}>
                      Ir a Administración
                    </Text>
                    <Text numberOfLines={1} style={styles.adminSubtitle}>
                      Configuración, cajas y finanzas
                    </Text>
                  </View>
                  <View style={styles.adminGoPill}>
                    <Text style={styles.adminGoText}>Ir</Text>
                    <Ionicons name="arrow-forward" size={11} color="#082F49" />
                  </View>
                </Pressable>
              </View>
            )}
          </Animated.View>

          {/* ── Botón circular Cobalto de cierre X ── */}
          <Pressable
            onPress={closeMenu}
            accessibilityRole="button"
            accessibilityLabel="Cerrar menú rápido del panel"
            style={({ pressed }) => [
              styles.closeCircle,
              {
                backgroundColor: palette.primary,
                opacity: pressed ? 0.88 : 1,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}>
            <Ionicons name="close" size={19} color="#FFFFFF" />
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
    gap: 10,
  },
  card: {
    width: '100%',
    maxWidth: 392,
    borderRadius: 24,
    borderWidth: 1,
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 11,
    shadowColor: '#0F172A',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 16,
    overflow: 'hidden',
  },
  handle: {
    alignSelf: 'center',
    width: 32,
    height: 3.5,
    borderRadius: 2,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  orgLogo: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: COBALT,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { width: '100%', height: '100%' },
  orgInitial: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  orgName: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    marginBottom: 9,
  },
  searchInput: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '500',
    paddingVertical: 2,
  },
  scrollBody: {
    paddingBottom: 2,
  },
  sectionBlock: {
    gap: 8,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  microLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  spacedMicro: {
    marginTop: 6,
  },
  editHeading: {
    fontSize: 11.5,
    fontWeight: '800',
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  changePillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: COBALT,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  donePillText: {
    color: '#FFFFFF',
    fontSize: 10.5,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tile: {
    height: 54,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 3,
    position: 'relative',
  },
  tileBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 9.5,
    lineHeight: 11,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.15,
  },
  emptySlot: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  emptySlotText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  expandBar: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
  },
  expandBarText: {
    fontSize: 11,
    fontWeight: '700',
  },
  expandedWrap: {
    marginTop: 4,
    gap: 6,
  },
  adminWrap: {
    marginTop: 10,
    paddingTop: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  adminIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 211, 238, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminTitle: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    letterSpacing: -0.1,
  },
  adminSubtitle: {
    color: '#A5B4FC',
    fontSize: 10,
    fontWeight: '600',
  },
  adminGoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    backgroundColor: '#22D3EE',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  adminGoText: {
    color: '#082F49',
    fontSize: 10.5,
    fontWeight: '900',
  },
  searchList: {
    gap: 5,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchRowLabel: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
  },
  searchRowGroup: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 12,
    paddingVertical: 14,
  },
  closeCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 12,
  },
});
