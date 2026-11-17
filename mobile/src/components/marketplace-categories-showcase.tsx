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
import { palette } from '../lib/palette';

import type { ShowcaseCard } from '../../../src/lib/public/marketplace-showcase-content';

type CategorySlide = ShowcaseCard & { iconName: keyof typeof Ionicons.glyphMap; accentColor:string; bgDark:string };

interface MarketplaceCategoriesShowcaseProps {
  categories: ShowcaseCard[];
  onSelectCategory: (category: ShowcaseCard) => void;
  onExploreAll?: () => void;
  title?: string;
  subtitle?: string;
}

export function MarketplaceCategoriesShowcase({
  categories,
  onSelectCategory,
  onExploreAll,
  title = 'Categorías destacadas',
  subtitle = 'Explorá los rubros comerciales del marketplace y encontrá productos en tu ciudad.',
}: MarketplaceCategoriesShowcaseProps) {
  const slides = useMemo<CategorySlide[]>(() => categories.map(card => ({...card,iconName:"grid-outline",accentColor:palette.primary,bgDark:"#0F172A"})),[categories]);
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width - 56, 340);
  const scrollRef = useRef<ScrollView>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Filtrar categorías según búsqueda
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return slides;
    return slides.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.eyebrow.toLowerCase().includes(q) ||
        c.searchTerm.toLowerCase().includes(q)
    );
  }, [searchQuery, slides]);

  const activeCategory = filteredCategories[activeIndex] ?? filteredCategories[0] ?? slides[0];

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

  if (!slides.length) return null;

  return (
    <View style={[styles.container, { backgroundColor: activeCategory ? activeCategory.bgDark : '#0F172A' }]}>
      {/* Resplandor ambiental superior */}
      <View
        pointerEvents="none"
        style={[
          styles.ambientGlow,
          {
            backgroundColor: activeCategory?.accentColor ?? palette.primary,
            opacity: 0.28,
          },
        ]}
      />

      {/* Header superior */}
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <View style={styles.badgePill}>
            <Ionicons name="sparkles" size={13} color="#6EE7B7" />
            <Text style={styles.badgePillText}>EXPLORÁ POR RUBRO</Text>
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
          <Text style={styles.emptyTitle}>No encontramos categorías para «{searchQuery}»</Text>
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
                    onSelectCategory(cat);
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
                          <Text style={styles.actionBtnText}>Ver {cat.count} productos</Text>
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
