import { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { palette, usePalette } from '../lib/palette';
import {
  formatMarketPrice,
  type MarketStore,
  type MarketProduct,
} from '../lib/marketplace';

function getStoreBackdrop(rubro?: string | null): string {
  switch (rubro?.toLowerCase()) {
    case 'tecnologia':
    case 'electronica':
      return 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&q=80&auto=format';
    case 'indumentaria':
    case 'moda':
      return 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80&auto=format';
    case 'hogar':
    case 'muebles':
      return 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80&auto=format';
    case 'belleza':
    case 'estetica':
      return 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80&auto=format';
    case 'alimentos':
    case 'gastronomia':
      return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80&auto=format';
    case 'servicios':
    case 'reparaciones':
      return 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80&auto=format';
    default:
      return 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800&q=80&auto=format';
  }
}

const RUBRO_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  tecnologia: 'hardware-chip-outline',
  electronica: 'phone-portrait-outline',
  indumentaria: 'shirt-outline',
  moda: 'shirt-outline',
  hogar: 'home-outline',
  muebles: 'bed-outline',
  alimentos: 'restaurant-outline',
  gastronomia: 'restaurant-outline',
  belleza: 'sparkles-outline',
  salud: 'medkit-outline',
  servicios: 'construct-outline',
  comercio: 'storefront-outline',
};

interface MarketplaceStoresShowcaseProps {
  stores: MarketStore[];
  products?: MarketProduct[];
  onSelectStore: (store: MarketStore) => void;
  onViewProducts: (store: MarketStore) => void;
  onExploreAll?: () => void;
}

export function MarketplaceStoresShowcase({
  stores,
  products = [],
  onSelectStore,
  onViewProducts,
  onExploreAll,
}: MarketplaceStoresShowcaseProps) {
  const colors = usePalette();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 56, 340);
  const scrollRef = useRef<ScrollView>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRubro, setSelectedRubro] = useState<string>('all');

  // Rubros únicos presentes en las tiendas
  const availableRubros = useMemo(() => {
    const set = new Set<string>();
    stores.forEach((s) => {
      if (s.rubro) set.add(s.rubro.toLowerCase());
    });
    return Array.from(set);
  }, [stores]);

  // Filtrado reactivo por texto y rubro
  const filteredStores = useMemo(() => {
    let list = stores;

    if (selectedRubro !== 'all') {
      list = list.filter((s) => s.rubro?.toLowerCase() === selectedRubro);
    }

    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;

    return list.filter((s) => {
      const matchName = s.name.toLowerCase().includes(q);
      const matchCity = (s.city || '').toLowerCase().includes(q);
      const matchRubro = (s.rubro || '').toLowerCase().includes(q);
      return matchName || matchCity || matchRubro;
    });
  }, [stores, searchQuery, selectedRubro]);

  const scrollToCard = async (index: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const target = Math.max(0, Math.min(index, filteredStores.length - 1));
    scrollRef.current?.scrollTo({ x: target * (cardWidth + 14), animated: true });
    setActiveIndex(target);
  };

  const handleOpenWhatsApp = async (phone: string, storeName: string) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const rawNumber = phone.replace(/\D/g, '');
    if (!rawNumber) return;
    const phoneWithCountry = rawNumber.startsWith('595')
      ? rawNumber
      : rawNumber.startsWith('0')
        ? '595' + rawNumber.slice(1)
        : '595' + rawNumber;
    const message = `¡Hola ${storeName}! Vi su tienda en el Marketplace y quería hacerles una consulta.`;
    await Linking.openURL(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`).catch(() => undefined);
  };

  if (stores.length === 0) return null;

  return (
    <View style={[styles.root, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* ── Encabezado Principal ── */}
      <View style={styles.header}>
        <View style={styles.eyebrowBadge}>
          <Ionicons name="sparkles" size={13} color="#38BDF8" />
          <Text style={styles.eyebrowText}>Selección Oficial · Comercios</Text>
          <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrowCount}>
            {filteredStores.length} {filteredStores.length === 1 ? 'tienda' : 'tiendas'}
          </Text>
        </View>

        <View style={styles.titleRow}>
          <View style={styles.titleTextWrap}>
            <Text style={[styles.headingTitle, { color: colors.text }]}>
              Tiendas destacadas
            </Text>
            <Text style={[styles.headingSubtitle, { color: colors.muted }]}>
              Comprá directo en tiendas oficiales con catálogo y atención online
            </Text>
          </View>

          {onExploreAll && (
            <Pressable
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onExploreAll();
              }}
              style={({ pressed }) => [
                styles.exploreAllBtn,
                {
                  backgroundColor: `${palette.primary}15`,
                  borderColor: `${palette.primary}35`,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Text style={[styles.exploreAllText, { color: palette.primary }]}>Ver todas</Text>
              <Ionicons name="arrow-forward" size={13} color={palette.primary} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Buscador Cápsula Flotante ── */}
      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: colors.background,
              borderColor: searchQuery ? palette.primary : colors.border,
            },
          ]}
        >
          <Ionicons name="search" size={17} color={searchQuery ? palette.primary : colors.muted} />
          <TextInput
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setActiveIndex(0);
            }}
            placeholder="Buscar tiendas o comercios..."
            placeholderTextColor={colors.muted}
            returnKeyType="search"
            style={[styles.searchInput, { color: colors.text }]}
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => setSearchQuery('')}
              hitSlop={8}
              style={styles.searchClearBtn}
            >
              <Ionicons name="close-circle" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>

        {/* Chips de Rubros */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          <Pressable
            onPress={async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedRubro('all');
              setActiveIndex(0);
            }}
            style={[
              styles.chip,
              {
                backgroundColor: selectedRubro === 'all' ? palette.primary : colors.background,
                borderColor: selectedRubro === 'all' ? palette.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: selectedRubro === 'all' ? '#FFFFFF' : colors.text },
              ]}
            >
              Todas ({stores.length})
            </Text>
          </Pressable>

          {availableRubros.map((rubro) => {
            const isSelected = selectedRubro === rubro;
            const iconName = RUBRO_ICONS[rubro] || 'storefront-outline';
            return (
              <Pressable
                key={rubro}
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedRubro(isSelected ? 'all' : rubro);
                  setActiveIndex(0);
                }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: isSelected ? palette.primary : colors.background,
                    borderColor: isSelected ? palette.primary : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={iconName}
                  size={12}
                  color={isSelected ? '#FFFFFF' : colors.muted}
                />
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: isSelected ? '#FFFFFF' : colors.text,
                      textTransform: 'capitalize',
                    },
                  ]}
                >
                  {rubro}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Carrusel o Estado Vacío ── */}
      {filteredStores.length === 0 ? (
        <View style={[styles.emptyContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <Ionicons name="business-outline" size={36} color={colors.muted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            No encontramos tiendas {searchQuery ? `para "${searchQuery}"` : ''}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
            Probá con otro término de búsqueda o limpiá los filtros.
          </Text>
          <Pressable
            onPress={() => {
              setSearchQuery('');
              setSelectedRubro('all');
            }}
            style={[styles.resetSearchBtn, { backgroundColor: palette.primary }]}
          >
            <Text style={styles.resetSearchBtnText}>Restablecer búsqueda</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.carouselWrapper}>
          <ScrollView
            ref={scrollRef}
            horizontal
            snapToInterval={cardWidth + 14}
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.track}
            scrollEventThrottle={32}
            onScroll={(e) => {
              const offsetX = e.nativeEvent.contentOffset.x;
              const idx = Math.round(offsetX / (cardWidth + 14));
              setActiveIndex(Math.max(0, Math.min(idx, filteredStores.length - 1)));
            }}
          >
            {filteredStores.map((store) => {
              const backdropImg = getStoreBackdrop(store.rubro);
              const storeProducts = products
                .filter((p) => p.store.slug === store.slug)
                .slice(0, 2);

              return (
                <View
                  key={store.id}
                  style={[styles.card, { width: cardWidth }]}
                >
                  {/* Imagen de Fondo de Alta Calidad */}
                  <Image
                    source={{ uri: backdropImg }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />

                  {/* Gradiente / Overlay Oscuro para Legibilidad */}
                  <View style={styles.cardDarkOverlay} />

                  {/* ── Parte Superior: Verificación, Logo y Nombre ── */}
                  <View style={styles.cardTop}>
                    <View style={styles.cardEyebrowRow}>
                      <View style={styles.officialBadge}>
                        <Ionicons name="sparkles" size={11} color="#38BDF8" />
                        <Text style={styles.officialBadgeText}>
                          TIENDA OFICIAL{store.city ? ` · ${store.city}` : ''}
                        </Text>
                      </View>

                      {store.rating ? (
                        <View style={styles.ratingPill}>
                          <Ionicons name="star" size={10} color="#F59E0B" />
                          <Text style={styles.ratingPillText}>{store.rating.toFixed(1)}</Text>
                        </View>
                      ) : (
                        <View style={styles.verifiedPill}>
                          <Ionicons name="shield-checkmark" size={11} color="#34D399" />
                          <Text style={styles.verifiedPillText}>Verificada</Text>
                        </View>
                      )}
                    </View>

                    {/* Logo + Título */}
                    <View style={styles.storeIdentityRow}>
                      <View style={styles.storeLogoBox}>
                        {store.logo ? (
                          <Image
                            source={{ uri: store.logo }}
                            style={styles.storeLogoImage}
                            contentFit="contain"
                          />
                        ) : (
                          <Text style={styles.storeLogoInitial}>
                            {store.name.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>

                      <View style={styles.storeNameBox}>
                        <View style={styles.storeTitleWithBadge}>
                          <Text numberOfLines={1} style={styles.storeTitleText}>
                            {store.name}
                          </Text>
                          <Ionicons name="checkmark-circle" size={16} color="#38BDF8" />
                        </View>

                        <View style={styles.storeMetaChips}>
                          {store.rubro && (
                            <View style={styles.metaChip}>
                              <Text style={styles.metaChipText}>{store.rubro}</Text>
                            </View>
                          )}
                          {store.products > 0 && (
                            <View style={styles.metaChip}>
                              <Ionicons name="cube-outline" size={10} color="#CBD5E1" />
                              <Text style={styles.metaChipText}>
                                {store.products} productos
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* ── Parte Central: Vitrina Esmerilada de Productos ── */}
                  <View style={styles.showcaseBox}>
                    <View style={styles.showcaseBoxHeader}>
                      <View style={styles.showcaseTitleRow}>
                        <Ionicons name="bag-handle-outline" size={12} color="#38BDF8" />
                        <Text style={styles.showcaseHeaderText}>PRODUCTOS DESTACADOS</Text>
                      </View>
                      <Pressable
                        onPress={() => onViewProducts(store)}
                        hitSlop={8}
                        style={styles.showcaseCatalogLink}
                      >
                        <Text style={styles.showcaseCatalogLinkText}>Ver catálogo</Text>
                        <Ionicons name="arrow-forward" size={11} color="#CBD5E1" />
                      </Pressable>
                    </View>

                    {storeProducts.length > 0 ? (
                      <View style={styles.productsMiniGrid}>
                        {storeProducts.map((prod) => (
                          <Pressable
                            key={prod.id}
                            onPress={() => onViewProducts(store)}
                            style={styles.prodMiniCard}
                          >
                            <View style={styles.prodMiniThumbWrap}>
                              {prod.image ? (
                                <Image
                                  source={{ uri: prod.image }}
                                  style={styles.prodMiniThumb}
                                  contentFit="contain"
                                />
                              ) : (
                                <Ionicons name="cube-outline" size={16} color="#94A3B8" />
                              )}
                              {prod.offerPrice && (
                                <View style={styles.prodMiniOfferBadge}>
                                  <Text style={styles.prodMiniOfferText}>OFERTA</Text>
                                </View>
                              )}
                            </View>
                            <Text numberOfLines={1} style={styles.prodMiniName}>
                              {prod.name}
                            </Text>
                            <Text numberOfLines={1} style={styles.prodMiniPrice}>
                              {formatMarketPrice(prod.offerPrice ?? prod.price ?? 0)}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => onViewProducts(store)}
                        style={styles.noProdsBanner}
                      >
                        <Ionicons name="storefront-outline" size={18} color="#38BDF8" />
                        <View style={styles.noProdsTextWrap}>
                          <Text style={styles.noProdsTitle}>Catálogo público disponible</Text>
                          <Text style={styles.noProdsSubtitle}>
                            Consultá precios y hacé tus pedidos directamente
                          </Text>
                        </View>
                      </Pressable>
                    )}
                  </View>

                  {/* ── Parte Inferior: Botón Visitar Tienda + WhatsApp ── */}
                  <View style={styles.cardActionsRow}>
                    <Pressable
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onSelectStore(store);
                      }}
                      style={({ pressed }) => [
                        styles.visitStoreBtn,
                        { opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      <Text style={styles.visitStoreBtnText}>Visitar tienda</Text>
                      <View style={styles.visitStoreCircleArrow}>
                        <Ionicons name="arrow-forward" size={13} color="#0F172A" />
                      </View>
                    </Pressable>

                    {Boolean(store.whatsapp) && (
                      <Pressable
                        onPress={() => handleOpenWhatsApp(store.whatsapp!, store.name)}
                        style={({ pressed }) => [
                          styles.whatsappBtn,
                          { opacity: pressed ? 0.85 : 1 },
                        ]}
                      >
                        <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
          </ScrollView>

          {/* ── Controles de Navegación y Puntos del Carrusel ── */}
          <View style={styles.controlsRow}>
            <Pressable
              onPress={() => scrollToCard(activeIndex - 1)}
              disabled={activeIndex === 0}
              style={[
                styles.arrowBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  opacity: activeIndex === 0 ? 0.35 : 1,
                },
              ]}
            >
              <Ionicons name="chevron-back" size={16} color={colors.text} />
            </Pressable>

            {/* Puntos expandibles */}
            <View style={styles.dotsRow}>
              {filteredStores.slice(0, 8).map((_, i) => (
                <Pressable
                  key={i}
                  onPress={() => scrollToCard(i)}
                  hitSlop={6}
                >
                  <View
                    style={[
                      styles.dot,
                      {
                        width: i === activeIndex ? 22 : 6,
                        backgroundColor: i === activeIndex ? palette.primary : colors.border,
                      },
                    ]}
                  />
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => scrollToCard(activeIndex + 1)}
              disabled={activeIndex === filteredStores.length - 1}
              style={[
                styles.arrowBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  opacity: activeIndex === filteredStores.length - 1 ? 0.35 : 1,
                },
              ]}
            >
              <Ionicons name="chevron-forward" size={16} color={colors.text} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  eyebrowBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#0284C715',
    borderWidth: 1,
    borderColor: '#0284C730',
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#0284C7',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  eyebrowDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#0284C7',
  },
  eyebrowCount: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0284C7',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleTextWrap: {
    flex: 1,
  },
  headingTitle: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  headingSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },
  exploreAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 2,
  },
  exploreAllText: {
    fontSize: 11,
    fontWeight: '800',
  },

  /* Buscador */
  searchSection: {
    paddingHorizontal: 16,
    marginBottom: 14,
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 13,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    paddingVertical: 0,
  },
  searchClearBtn: {
    padding: 2,
  },
  chipsScroll: {
    gap: 6,
    paddingRight: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
  },

  /* Carrusel */
  carouselWrapper: {
    gap: 10,
  },
  track: {
    paddingHorizontal: 16,
    gap: 14,
  },
  card: {
    height: 440,
    borderRadius: 24,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  cardDarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 15, 30, 0.88)',
  },

  /* Card Top */
  cardTop: {
    gap: 10,
  },
  cardEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  officialBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  officialBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  ratingPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FDE68A',
  },
  verifiedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  verifiedPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F8FAFC',
  },

  storeIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  storeLogoBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 3,
  },
  storeLogoImage: {
    width: '100%',
    height: '100%',
  },
  storeLogoInitial: {
    fontSize: 20,
    fontWeight: '900',
    color: palette.primary,
  },
  storeNameBox: {
    flex: 1,
    gap: 3,
  },
  storeTitleWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  storeTitleText: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  storeMetaChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  metaChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F1F5F9',
    textTransform: 'capitalize',
  },

  /* Vitrina de Productos */
  showcaseBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    padding: 10,
    gap: 8,
  },
  showcaseBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  showcaseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  showcaseHeaderText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#38BDF8',
    letterSpacing: 0.5,
  },
  showcaseCatalogLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  showcaseCatalogLinkText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#E2E8F0',
  },
  productsMiniGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  prodMiniCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 6,
    gap: 4,
  },
  prodMiniThumbWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  prodMiniThumb: {
    width: '100%',
    height: '100%',
  },
  prodMiniOfferBadge: {
    position: 'absolute',
    top: 3,
    right: 3,
    backgroundColor: '#E11D48',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  prodMiniOfferText: {
    fontSize: 7,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  prodMiniName: {
    fontSize: 10,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  prodMiniPrice: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  noProdsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 12,
  },
  noProdsTextWrap: {
    flex: 1,
  },
  noProdsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  noProdsSubtitle: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },

  /* Card Bottom Actions */
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  visitStoreBtn: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 18,
    paddingRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  visitStoreBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  visitStoreCircleArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0F172A15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsappBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },

  /* Controles de Navegación */
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },

  /* Empty state */
  emptyContainer: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
  },
  resetSearchBtn: {
    marginTop: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
  },
  resetSearchBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
