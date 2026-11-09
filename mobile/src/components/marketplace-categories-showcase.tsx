import { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { palette, usePalette } from '../lib/palette';

export interface CategorySlide {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  searchTerm: string;
  iconName: keyof typeof Ionicons.glyphMap;
  accentColor: string;
  bgDark: string;
}

export const SHOWCASE_CATEGORIES: CategorySlide[] = [
  {
    id: 'belleza',
    eyebrow: 'BRILLA CON CONFIANZA',
    title: 'Belleza & Estética',
    description: 'Esenciales de piel, cabello y belleza hechos para ti.',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80&auto=format',
    searchTerm: 'belleza',
    iconName: 'sparkles-outline',
    accentColor: '#10B981',
    bgDark: '#064E3B',
  },
  {
    id: 'servicios',
    eyebrow: 'PROFESIONALES DE CONFIANZA',
    title: 'Servicios',
    description: 'Descubre expertos locales listos para ayudarte.',
    image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&q=80&auto=format',
    searchTerm: 'servicios',
    iconName: 'construct-outline',
    accentColor: '#0EA5E9',
    bgDark: '#0C4A6E',
  },
  {
    id: 'electronica',
    eyebrow: 'MÁS CONECTADO CADA DÍA',
    title: 'Electrónica',
    description: 'Dispositivos y tecnología para una vida conectada.',
    image: 'https://images.unsplash.com/photo-1593508512255-86ab42a8e620?w=800&q=80&auto=format',
    searchTerm: 'electronica',
    iconName: 'phone-portrait-outline',
    accentColor: '#8B5CF6',
    bgDark: '#4C1D95',
  },
  {
    id: 'electrodomesticos',
    eyebrow: 'CONFORT & TECNOLOGÍA EN CASA',
    title: 'Electrodomésticos',
    description: 'Heladeras, lavarropas, climatización y cocina para tu día a día.',
    image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&q=80&auto=format',
    searchTerm: 'electrodomesticos',
    iconName: 'hardware-chip-outline',
    accentColor: '#2563EB',
    bgDark: '#1E3A8A',
  },
  {
    id: 'muebles',
    eyebrow: 'CONFORT & DISEÑO',
    title: 'Muebles & Hogar',
    description: 'Muebles de diseño y confort para transformar tus ambientes.',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&q=80&auto=format',
    searchTerm: 'muebles',
    iconName: 'home-outline',
    accentColor: '#D97706',
    bgDark: '#78350F',
  },
  {
    id: 'computacion',
    eyebrow: 'PRODUCTIVIDAD & EQUIPAMIENTO',
    title: 'Computación',
    description: 'Pantallas, teclados, mouse, impresoras y conectividad.',
    image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&q=80&auto=format',
    searchTerm: 'computacion',
    iconName: 'laptop-outline',
    accentColor: '#6366F1',
    bgDark: '#312E81',
  },
  {
    id: 'audio',
    eyebrow: 'SONIDO DE ALTA FIDELIDAD',
    title: 'Audio & Video',
    description: 'Auriculares, parlantes y sonido envolvente.',
    image: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&q=80&auto=format',
    searchTerm: 'audio',
    iconName: 'headset-outline',
    accentColor: '#06B6D4',
    bgDark: '#164E63',
  },
  {
    id: 'moda',
    eyebrow: 'TU PROPIO ESTILO',
    title: 'Moda & Relojería',
    description: 'Remeras básicas, indumentaria corporativa y relojes.',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80&auto=format',
    searchTerm: 'reloj',
    iconName: 'shirt-outline',
    accentColor: '#F43F5E',
    bgDark: '#881337',
  },
];

interface MarketplaceCategoriesShowcaseProps {
  onSelectCategory: (searchTerm: string) => void;
  onExploreAll?: () => void;
  title?: string;
  subtitle?: string;
}

export function MarketplaceCategoriesShowcase({
  onSelectCategory,
  onExploreAll,
  title = 'Categorías destacadas',
  subtitle = 'Explorá los rubros comerciales del marketplace y encontrá productos en tu ciudad.',
}: MarketplaceCategoriesShowcaseProps) {
  const colors = usePalette();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 56, 340);
  const scrollRef = useRef<ScrollView>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrar categorías según búsqueda
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SHOWCASE_CATEGORIES;
    return SHOWCASE_CATEGORIES.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.eyebrow.toLowerCase().includes(q) ||
        c.searchTerm.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const activeCategory = filteredCategories[activeIndex] ?? filteredCategories[0] ?? SHOWCASE_CATEGORIES[0];

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const index = Math.round(offsetX / (cardWidth + 14));
      if (index >= 0 && index < filteredCategories.length && index !== activeIndex) {
        setActiveIndex(index);
      }
    },
    [cardWidth, filteredCategories.length, activeIndex]
  );

  const scrollToIndex = (index: number) => {
    const target = Math.max(0, Math.min(index, filteredCategories.length - 1));
    scrollRef.current?.scrollTo({
      x: target * (cardWidth + 14),
      animated: true,
    });
    setActiveIndex(target);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.container, { backgroundColor: activeCategory ? activeCategory.bgDark : '#0F172A' }]}>
      {/* Resplandor ambiental superior */}
      <View
        pointerEvents="none"
        style={[
          styles.ambientGlow,
          {
            backgroundColor: activeCategory.accentColor,
            opacity: 0.28,
          },
        ]}
      />

      {/* Header superior */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.badgePill}>
            <Ionicons name="sparkles" size={13} color="#6EE7B7" />
            <Text style={styles.badgePillText}>SHOWCASE · CATEGORÍAS</Text>
            <View style={styles.badgeDot} />
            <Text style={styles.badgeCountText}>{filteredCategories.length} rubros</Text>
          </View>

          {onExploreAll && (
            <Pressable
              onPress={onExploreAll}
              style={({ pressed }) => [
                styles.exploreAllBtn,
                pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
              ]}>
              <Text style={styles.exploreAllBtnText}>Ver todas</Text>
              <Ionicons name="arrow-forward" size={13} color="#FFFFFF" />
            </Pressable>
          )}
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {/* Buscador de categorías */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#94A3B8" />
          <TextInput
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setActiveIndex(0);
              scrollRef.current?.scrollTo({ x: 0, animated: false });
            }}
            placeholder="Buscar rubro (ej: belleza, electro, moda)..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
          {searchQuery.length > 0 && (
            <Pressable
              onPress={() => {
                setSearchQuery('');
                setActiveIndex(0);
                scrollRef.current?.scrollTo({ x: 0, animated: false });
              }}
              hitSlop={8}
              style={styles.clearSearchBtn}>
              <Ionicons name="close-circle" size={18} color="#CBD5E1" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Carrusel horizontal de tarjetas */}
      {filteredCategories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={32} color="#94A3B8" />
          <Text style={styles.emptyTitle}>No encontramos categorías para "{searchQuery}"</Text>
          <Pressable
            onPress={() => setSearchQuery('')}
            style={[styles.emptyResetBtn, { backgroundColor: palette.primary }]}>
            <Text style={styles.emptyResetBtnText}>Ver todas las categorías</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.carouselWrapper}>
          {/* Botones de navegación flotantes */}
          {filteredCategories.length > 1 && (
            <>
              {activeIndex > 0 && (
                <Pressable
                  onPress={() => scrollToIndex(activeIndex - 1)}
                  style={[styles.navArrowBtn, styles.navArrowLeft]}
                  hitSlop={6}>
                  <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
                </Pressable>
              )}
              {activeIndex < filteredCategories.length - 1 && (
                <Pressable
                  onPress={() => scrollToIndex(activeIndex + 1)}
                  style={[styles.navArrowBtn, styles.navArrowRight]}
                  hitSlop={6}>
                  <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
                </Pressable>
              )}
            </>
          )}

          <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + 14}
            decelerationRate="fast"
            contentContainerStyle={styles.scrollContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}>
            {filteredCategories.map((cat, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onSelectCategory(cat.searchTerm);
                  }}
                  style={({ pressed }) => [
                    styles.card,
                    {
                      width: cardWidth,
                      borderColor: isSelected ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.15)',
                    },
                    pressed && { opacity: 0.94, transform: [{ scale: 0.99 }] },
                  ]}>
                  {/* Foto de fondo */}
                  <Image
                    source={{ uri: cat.image }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={250}
                  />

                  {/* Superposición gradiente oscura para legibilidad */}
                  <View style={styles.cardGradientOverlay} />

                  {/* Contenido de la tarjeta */}
                  <View style={styles.cardContent}>
                    {/* Eyebrow badge */}
                    <View style={styles.cardTopRow}>
                      <View style={[styles.eyebrowBadge, { backgroundColor: 'rgba(0, 0, 0, 0.55)' }]}>
                        <Ionicons name={cat.iconName} size={13} color="#FFFFFF" />
                        <Text style={styles.eyebrowText}>{cat.eyebrow}</Text>
                      </View>
                    </View>

                    {/* Título & Descripción */}
                    <View style={styles.cardBottomGroup}>
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {cat.title}
                      </Text>
                      <Text style={styles.cardDescription} numberOfLines={2}>
                        {cat.description}
                      </Text>

                      {/* Botón de acción */}
                      <View style={styles.cardActionRow}>
                        <View style={[styles.actionBtn, { backgroundColor: cat.accentColor }]}>
                          <Text style={styles.actionBtnText}>Explorar ahora</Text>
                          <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                        </View>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Indicadores de diapositiva (dots) */}
      {filteredCategories.length > 1 && (
        <View style={styles.dotsRow}>
          {filteredCategories.map((_, i) => (
            <Pressable
              key={`dot-${i}`}
              onPress={() => scrollToIndex(i)}
              hitSlop={6}
              style={[
                styles.dot,
                i === activeIndex
                  ? [styles.activeDot, { backgroundColor: '#FFFFFF' }]
                  : styles.inactiveDot,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
    position: 'relative',
  },
  ambientGlow: {
    position: 'absolute',
    top: -60,
    left: -40,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  badgePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  badgeDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  badgeCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  exploreAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  exploreAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 17,
  },
  searchWrapper: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  clearSearchBtn: {
    padding: 2,
  },
  emptyContainer: {
    paddingVertical: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  emptyResetBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 4,
  },
  emptyResetBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  carouselWrapper: {
    position: 'relative',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 14,
  },
  card: {
    height: 310,
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    backgroundColor: '#1E293B',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  cardGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
  },
  cardContent: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  eyebrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  eyebrowText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },
  cardBottomGroup: {
    gap: 6,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 3,
  },
  cardDescription: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 17,
  },
  cardActionRow: {
    marginTop: 8,
    flexDirection: 'row',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  navArrowBtn: {
    position: 'absolute',
    top: '46%',
    zIndex: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  navArrowLeft: {
    left: 8,
  },
  navArrowRight: {
    right: 8,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    width: 22,
  },
  inactiveDot: {
    width: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
});
