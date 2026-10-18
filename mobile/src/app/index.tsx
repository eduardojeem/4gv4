import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { MarketplaceHeader } from '@/components/marketplace-header';
import { CartSheet, type CartItem } from '@/components/cart-sheet';
import { CategoriesSheet } from '@/components/categories-sheet';
import { StoreDetailSheet } from '@/components/store-detail-sheet';
import { ProductDetailSheet } from '@/components/product-detail-sheet';
import { RepairTrackerModal } from '@/components/repair-tracker-modal';
import { secureStorage } from '@/lib/secure-storage';
import { apiFetch } from '@/lib/api';
import {
  fetchMarketplaceHome,
  formatGs,
  openWeb,
  productPath,
  storePath,
  type MarketplaceHome,
  type MarketProduct,
  type MarketStore,
} from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { ROLE_LABELS } from '@/lib/panel';
import { useSession } from '@/lib/session';

const cyan = {
  light: '#0284C7',
  dark: '#38BDF8',
  soft: { light: '#E0F2FE', dark: 'rgba(14,165,233,0.15)' },
};

type NavTab = 'inicio' | 'productos' | 'ofertas' | 'tiendas' | 'perfil';
type SortOption = 'default' | 'price_asc' | 'price_desc' | 'name_asc';
type PriceRange = 'all' | 'under_100k' | '100k_500k' | 'over_500k';
type FacetTab = 'categorias' | 'marcas' | 'tiendas';

const SORT_LABELS: Record<SortOption, string> = {
  default: 'Relevancia',
  price_asc: 'Menor precio',
  price_desc: 'Mayor precio',
  name_asc: 'Nombre A-Z',
};

const PRICE_RANGE_LABELS: Record<PriceRange, string> = {
  all: 'Todos los precios',
  under_100k: 'Hasta Gs. 100.000',
  '100k_500k': 'Gs. 100k – 500k',
  over_500k: 'Más de Gs. 500.000',
};

const NEXT_PRICE_RANGE: Record<PriceRange, PriceRange> = {
  all: 'under_100k',
  under_100k: '100k_500k',
  '100k_500k': 'over_500k',
  over_500k: 'all',
};

// Constantes de paginación
const PRODUCTS_PAGE_SIZE = 10;
const OFFERS_PAGE_SIZE = 10;
const STORES_PAGE_SIZE = 8;

/** Clave de la ciudad de una tienda; si el servidor no la mandó, se arma sin acentos, mayúsculas ni «, Paraguay». */
const storeCityKey = (store: Pick<MarketStore, 'city' | 'cityKey'>) =>
  store.cityKey ||
  (store.city
    ?.normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[,\s-]*(paraguay|py)\s*$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') ||
    null);

export default function MarketplaceScreen() {
  const { session, signOut } = useSession();
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const accent = dark ? cyan.dark : cyan.light;
  const accentSoft = dark ? cyan.soft.dark : cyan.soft.light;

  const params = useLocalSearchParams<{ tab?: string }>();
  const scrollRef = useRef<ScrollView>(null);

  // Pestaña activa dentro del mismo layout unificado
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    if (params.tab && ['inicio', 'ofertas', 'productos', 'tiendas', 'perfil'].includes(params.tab)) {
      return params.tab as NavTab;
    }
    return 'inicio';
  });

  // Datos globales del Marketplace
  const [data, setData] = useState<MarketplaceHome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Información de comercio/organización del usuario si está autenticado
  const [org, setOrg] = useState<{ name: string; role: string; slug?: string } | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }
    let active = true;
    apiFetch<{ activeOrganization?: { id: string; name: string; slug: string; role: string } }>('/api/organization-context')
      .then((res) => {
        if (active && res.activeOrganization) {
          setOrg({
            name: res.activeOrganization.name,
            role: res.activeOrganization.role,
            slug: res.activeOrganization.slug,
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session]);

  // Estados de búsqueda para la sección "Inicio"
  const [homeQuery, setHomeQuery] = useState('');

  // ── Estados avanzados de Filtros para "Productos" ──
  const [productQuery, setProductQuery] = useState('');
  const [productCategory, setProductCategory] = useState<string | null>(null);
  const [productBrand, setProductBrand] = useState<string | null>(null);
  const [productStore, setProductStore] = useState<string | null>(null);
  const [onlyOffers, setOnlyOffers] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [priceRange, setPriceRange] = useState<PriceRange>('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [facetTab, setFacetTab] = useState<FacetTab>('categorias');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showSortModal, setShowSortModal] = useState(false);
  const [productPage, setProductPage] = useState(1);

  // Estados para la sección "Ofertas"
  const [offerQuery, setOfferQuery] = useState('');
  const [offerSort, setOfferSort] = useState<'discount' | 'price_asc' | 'price_desc'>('discount');
  const [offerPage, setOfferPage] = useState(1);

  // Estados para la sección "Tiendas"
  const [storeQuery, setStoreQuery] = useState('');
  const [storeCity, setStoreCity] = useState<string | null>(null);
  const [storePage, setStorePage] = useState(1);

  // ── Funcionalidades interactivas públicas modernas ──
  const [selectedProduct, setSelectedProduct] = useState<MarketProduct | null>(null);
  const [showRepairTracker, setShowRepairTracker] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // ── Carrito de compras público interactivo ──
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showCartSheet, setShowCartSheet] = useState(false);
  const [showCategoriesSheet, setShowCategoriesSheet] = useState(false);
  const [selectedStorePreview, setSelectedStorePreview] = useState<MarketStore | null>(null);

  // Cargar carrito guardado en almacenamiento local seguro
  useEffect(() => {
    let mounted = true;
    secureStorage.getItem('marketplace_user_cart').then((raw) => {
      if (!mounted || !raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setCartItems(parsed);
      } catch {
        // Silently ignore corrupted storage
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const addToCart = useCallback(
    (product: MarketProduct) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCartItems((prev) => {
        const existingIndex = prev.findIndex((item) => item.id === product.id);
        let updated: CartItem[];
        if (existingIndex >= 0) {
          updated = prev.map((item, idx) =>
            idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item
          );
        } else {
          const storeMatch = data?.stores.find((s) => s.slug === product.store.slug);
          const effectivePrice = product.offerPrice ?? product.price ?? 0;
          const newItem: CartItem = {
            id: product.id,
            name: product.name,
            price: effectivePrice,
            image: product.image,
            store: {
              name: product.store.name,
              slug: product.store.slug,
              whatsapp: storeMatch?.whatsapp ?? null,
            },
            quantity: 1,
          };
          updated = [...prev, newItem];
        }
        void secureStorage.setItem('marketplace_user_cart', JSON.stringify(updated));
        return updated;
      });
    },
    [data]
  );

  const updateCartQuantity = useCallback((productId: string, delta: number) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCartItems((prev) => {
      const updated = prev
        .map((item) => {
          if (item.id === productId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
      void secureStorage.setItem('marketplace_user_cart', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setCartItems((prev) => {
      const updated = prev.filter((item) => item.id !== productId);
      void secureStorage.setItem('marketplace_user_cart', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearCart = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setCartItems([]);
    void secureStorage.removeItem('marketplace_user_cart');
  }, []);

  const totalCartCount = useMemo(() => {
    return cartItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [cartItems]);

  // Cargar favoritos guardados en almacenamiento local seguro
  useEffect(() => {
    let mounted = true;
    secureStorage.getItem('marketplace_user_favorites').then((raw) => {
      if (!mounted || !raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setFavorites(new Set(parsed));
      } catch {
        // Silently ignore corrupted storage
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  const toggleFavorite = useCallback(async (productId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      void secureStorage.setItem('marketplace_user_favorites', JSON.stringify(Array.from(next)));
      return next;
    });
  }, []);

  // Carga de datos
  useEffect(() => {
    let active = true;
    fetchMarketplaceHome()
      .then((home) => {
        if (!active) return;
        setData(home);
        setError(null);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'No pudimos cargar el marketplace.');
      })
      .finally(() => {
        if (active) setRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setAttempt((n) => n + 1);
  }, []);

  // Cambiar pestaña dentro del mismo layout con scroll automático al inicio
  const handleTabPress = async (tab: NavTab) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const stat = (key: 'stores' | 'products') => data?.stats.find((item) => item.key === key)?.value;

  // ── Filtros para pestaña INICIO ──
  const homeFilteredProducts = useMemo(() => {
    if (!data) return [];
    let list = data.products;
    if (homeQuery.trim()) {
      const q = homeQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.store.name.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q))
      );
    }
    return list;
  }, [data, homeQuery]);

  // ── Filtrado inteligente y exhaustivo para PRODUCTOS ──
  const allCatalogProducts = useMemo(() => {
    if (!data) return [];
    // Combinar productos regulares y de ofertas sin duplicar por ID
    const productMap = new Map<string, MarketProduct>();
    for (const p of data.products) productMap.set(p.id, p);
    for (const p of data.offers) productMap.set(p.id, p);
    let list = Array.from(productMap.values());

    // 1. Buscador por texto (nombre, comercio, marca, categoría)
    if (productQuery.trim()) {
      const q = productQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.store.name.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.category?.name && p.category.name.toLowerCase().includes(q))
      );
    }

    // 2. Filtro por Categoría con coincidencia robusta
    if (productCategory) {
      const catObj = data.categories.find((c) => c.id === productCategory);
      const catName = catObj ? catObj.name.toLowerCase() : productCategory.toLowerCase();
      list = list.filter((p) => {
        if (p.category?.id === productCategory) return true;
        if (p.category?.name && p.category.name.toLowerCase() === catName) return true;
        if (p.name.toLowerCase().includes(catName)) return true;
        return false;
      });
    }

    // 3. Filtro por Marca: Coincidencia en campo brand O en nombre del producto
    if (productBrand) {
      const b = productBrand.toLowerCase().trim();
      list = list.filter((p) => {
        // Coincidencia en la propiedad brand
        if (p.brand && (p.brand.toLowerCase().trim() === b || p.brand.toLowerCase().includes(b) || b.includes(p.brand.toLowerCase().trim()))) {
          return true;
        }
        // Coincidencia en el nombre del producto (ej: "Taladro Bosch 500w")
        if (p.name.toLowerCase().includes(b)) {
          return true;
        }
        return false;
      });
    }

    // 4. Filtro por Tienda específica
    if (productStore) {
      const target = productStore.toLowerCase();
      list = list.filter(
        (p) =>
          p.store.slug.toLowerCase() === target ||
          p.store.name.toLowerCase() === target ||
          p.store.slug.replace(/-/g, '').toLowerCase() === target.replace(/-/g, '') ||
          p.store.name.toLowerCase().includes(target)
      );
    }

    // 5. Filtro solo ofertas
    if (onlyOffers) {
      list = list.filter((p) => p.offerPrice !== null && (p.price === null || p.offerPrice < p.price));
    }

    // 6. Filtro solo con stock disponible
    if (onlyInStock) {
      list = list.filter((p) => p.inStock);
    }

    // 7. Filtro por rango de precios
    if (priceRange !== 'all') {
      list = list.filter((p) => {
        const effPrice = p.offerPrice ?? p.price;
        if (effPrice === null) return false;
        if (priceRange === 'under_100k') return effPrice <= 100000;
        if (priceRange === '100k_500k') return effPrice >= 100000 && effPrice <= 500000;
        if (priceRange === 'over_500k') return effPrice > 500000;
        return true;
      });
    }

    // 8. Filtro exclusivo por Favoritos
    if (onlyFavorites) {
      list = list.filter((p) => favorites.has(p.id));
    }

    // 9. Ordenamiento
    if (sortBy === 'price_asc') {
      list.sort((a, b) => (a.offerPrice ?? a.price ?? 999999999) - (b.offerPrice ?? b.price ?? 999999999));
    } else if (sortBy === 'price_desc') {
      list.sort((a, b) => (b.offerPrice ?? b.price ?? 0) - (a.offerPrice ?? a.price ?? 0));
    } else if (sortBy === 'name_asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'default') {
      list.sort((a, b) => Number(b.featured) - Number(a.featured));
    }

    return list;
  }, [
    data,
    productQuery,
    productCategory,
    productBrand,
    productStore,
    onlyOffers,
    onlyInStock,
    onlyFavorites,
    favorites,
    priceRange,
    sortBy,
  ]);

  // Contador de filtros activos en productos
  const activeFiltersCount =
    (productCategory ? 1 : 0) +
    (productBrand ? 1 : 0) +
    (productStore ? 1 : 0) +
    (onlyOffers ? 1 : 0) +
    (onlyInStock ? 1 : 0) +
    (onlyFavorites ? 1 : 0) +
    (priceRange !== 'all' ? 1 : 0) +
    (sortBy !== 'default' ? 1 : 0);

  const hasProductFilters = activeFiltersCount > 0 || productQuery.trim().length > 0;

  // Paginación segura de Productos
  const totalProductPages = Math.max(1, Math.ceil(allCatalogProducts.length / PRODUCTS_PAGE_SIZE));
  const safeProductPage = Math.min(Math.max(1, productPage), totalProductPages);
  const paginatedProducts = useMemo(() => {
    const start = (safeProductPage - 1) * PRODUCTS_PAGE_SIZE;
    return allCatalogProducts.slice(start, start + PRODUCTS_PAGE_SIZE);
  }, [allCatalogProducts, safeProductPage]);

  const handleProductPageChange = async (newPage: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProductPage(newPage);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const clearProductFilters = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProductQuery('');
    setProductCategory(null);
    setProductBrand(null);
    setProductStore(null);
    setOnlyOffers(false);
    setOnlyInStock(false);
    setOnlyFavorites(false);
    setPriceRange('all');
    setSortBy('default');
    setProductPage(1);
  };

  // ── Filtros para pestaña OFERTAS ──
  const allOfferProducts = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, MarketProduct>();
    for (const p of data.offers) map.set(p.id, p);
    for (const p of data.products) {
      if (p.offerPrice !== null && (p.price === null || p.offerPrice < p.price)) {
        map.set(p.id, p);
      }
    }
    let list = Array.from(map.values());

    if (offerQuery.trim()) {
      const q = offerQuery.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.store.name.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q))
      );
    }

    if (offerSort === 'discount') {
      list.sort((a, b) => {
        const discA = a.offerPrice && a.price ? 1 - a.offerPrice / a.price : 0;
        const discB = b.offerPrice && b.price ? 1 - b.offerPrice / b.price : 0;
        return discB - discA;
      });
    } else if (offerSort === 'price_asc') {
      list.sort((a, b) => (a.offerPrice ?? a.price ?? 0) - (b.offerPrice ?? b.price ?? 0));
    } else if (offerSort === 'price_desc') {
      list.sort((a, b) => (b.offerPrice ?? b.price ?? 0) - (a.offerPrice ?? a.price ?? 0));
    }
    return list;
  }, [data, offerQuery, offerSort]);

  const totalOfferPages = Math.max(1, Math.ceil(allOfferProducts.length / OFFERS_PAGE_SIZE));
  const safeOfferPage = Math.min(Math.max(1, offerPage), totalOfferPages);
  const paginatedOffers = useMemo(() => {
    const start = (safeOfferPage - 1) * OFFERS_PAGE_SIZE;
    return allOfferProducts.slice(start, start + OFFERS_PAGE_SIZE);
  }, [allOfferProducts, safeOfferPage]);

  const handleOfferPageChange = async (newPage: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setOfferPage(newPage);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // ── Filtros para pestaña TIENDAS ──
  // Una sola opción por ciudad (el servidor ya unifica «asuncion», «Asunción, PY»…),
  // con cuántas tiendas tiene y las que más tienen primero.
  const allStoreCities = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { key: string; display: string; count: number }>();
    for (const s of data.stores) {
      const key = storeCityKey(s);
      if (!key || !s.city) continue;
      const current = map.get(key);
      if (current) current.count += 1;
      else map.set(key, { key, display: s.city.trim(), count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count || a.display.localeCompare(b.display, 'es'));
  }, [data]);

  const allFilteredStores = useMemo(() => {
    if (!data) return [];
    let list = data.stores;
    if (storeQuery.trim()) {
      const q = storeQuery.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.city && s.city.toLowerCase().includes(q)) ||
          (s.rubro && s.rubro.toLowerCase().includes(q))
      );
    }
    if (storeCity) {
      list = list.filter((s) => storeCityKey(s) === storeCity);
    }
    return list;
  }, [data, storeQuery, storeCity]);

  const totalStorePages = Math.max(1, Math.ceil(allFilteredStores.length / STORES_PAGE_SIZE));
  const safeStorePage = Math.min(Math.max(1, storePage), totalStorePages);
  const paginatedStores = useMemo(() => {
    const start = (safeStorePage - 1) * STORES_PAGE_SIZE;
    return allFilteredStores.slice(start, start + STORES_PAGE_SIZE);
  }, [allFilteredStores, safeStorePage]);

  const handleStorePageChange = async (newPage: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStorePage(newPage);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  // Nombres descriptivos para chips activos
  const activeCategoryName = data?.categories.find((c) => c.id === productCategory)?.name ?? productCategory;
  const activeStoreName = data?.stores.find((s) => s.slug === productStore)?.name ?? productStore;

  const handleSignOutConfirm = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro de que deseás cerrar la sesión en tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await signOut();
        },
      },
    ]);
  };

  const userInitial = session?.user.email ? session.user.email.charAt(0).toUpperCase() : null;

  return (
    <SafeAreaView edges={['top']} style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar style={dark ? 'light' : 'dark'} />

      {/* ── Barra superior persistente con Menú de Perfil / Negocio ── */}
      <MarketplaceHeader
        showBack={activeTab !== 'inicio'}
        onBack={() => handleTabPress('inicio')}
        onOpenProfile={() => handleTabPress('perfil')}
        cartItemCount={totalCartCount}
        onOpenCart={() => setShowCartSheet(true)}
      />

      <View style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scroll, { paddingBottom: 110 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reload} tintColor={accent} />}>
          
          {/* ══════════════════════════════════════════════════════════════
              PESTAÑA 1: INICIO (HOME MARKETPLACE)
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'inicio' && (
            <>
              {/* Hero Promocional & Buscador Principal */}
              <View
                style={[
                  styles.hero,
                  {
                    backgroundColor: colors.card,
                    borderColor: dark ? '#1E293B' : '#E2E8F0',
                  },
                ]}>
                <View
                  pointerEvents="none"
                  style={[
                    styles.glow,
                    {
                      backgroundColor: accent,
                      opacity: dark ? 0.08 : 0.06,
                    },
                  ]}
                />

                <View style={[styles.pill, { backgroundColor: accentSoft, borderColor: dark ? '#0284C7' : '#BAE6FD' }]}>
                  <Ionicons name="storefront" size={13} color={accent} />
                  <Text style={[styles.pillText, { color: accent }]}>Marketplace Digital de Paraguay</Text>
                </View>

                <Text style={[styles.h1, { color: colors.text }]}>
                  Encontrá productos de comercios{'\n'}
                  <Text style={{ color: palette.primary }}>en un solo lugar</Text>
                </Text>

                <Text style={[styles.lead, { color: colors.muted }]}>
                  Buscá repuestos, insumos y artículos. Compará precios en Guaraníes y contactá directo a cada tienda.
                </Text>

                {/* Estadísticas rápidas */}
                {(stat('stores') || stat('products')) && (
                  <View style={styles.stats}>
                    {stat('stores') ? (
                      <StatChip
                        icon="business"
                        value={stat('stores')!}
                        label="comercios"
                        accent={accent}
                        soft={accentSoft}
                        colors={colors}
                      />
                    ) : null}
                    {stat('products') ? (
                      <StatChip
                        icon="cube"
                        value={stat('products')!}
                        label="productos en línea"
                        accent={accent}
                        soft={accentSoft}
                        colors={colors}
                      />
                    ) : null}
                  </View>
                )}

                {/* Caja de Búsqueda Interactiva */}
                <View
                  style={[
                    styles.searchBox,
                    {
                      backgroundColor: colors.background,
                      borderColor: homeQuery ? palette.primary : colors.border,
                    },
                  ]}>
                  <Ionicons name="search-outline" size={20} color={homeQuery ? palette.primary : colors.muted} />
                  <TextInput
                    value={homeQuery}
                    onChangeText={setHomeQuery}
                    onSubmitEditing={() => {
                      if (homeQuery.trim()) {
                        setProductQuery(homeQuery.trim());
                        setProductPage(1);
                        setActiveTab('productos');
                      }
                    }}
                    placeholder="Buscar por producto, marca o repuesto…"
                    placeholderTextColor={colors.muted}
                    returnKeyType="search"
                    style={[styles.searchInput, { color: colors.text }]}
                  />
                  {homeQuery.length > 0 && (
                    <Pressable onPress={() => setHomeQuery('')} hitSlop={8} style={styles.searchClearBtn}>
                      <Ionicons name="close-circle" size={18} color={colors.muted} />
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => {
                      if (homeQuery.trim()) {
                        setProductQuery(homeQuery.trim());
                        setProductPage(1);
                        setActiveTab('productos');
                      }
                    }}
                    style={[styles.searchButton, { backgroundColor: palette.primary }]}>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
              </View>

              {/* Estado de carga */}
              {!data && !error && (
                <View style={styles.loading}>
                  <ActivityIndicator color={accent} size="large" />
                  <Text style={[styles.loadingText, { color: colors.muted }]}>Cargando marketplace…</Text>
                </View>
              )}

              {/* Estado de error */}
              {error && (
                <View style={[styles.errorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Ionicons name="alert-circle-outline" size={32} color={palette.danger} />
                  <Text style={[styles.errorTitle, { color: colors.text }]}>No se pudo cargar</Text>
                  <Text style={[styles.errorText, { color: colors.muted }]}>{error}</Text>
                  <Pressable onPress={reload} style={[styles.btn, { backgroundColor: palette.primary }]}>
                    <Text style={styles.btnTextLight}>Reintentar</Text>
                  </Pressable>
                </View>
              )}

              {data && (
                <>
                  {/* Categorías con selector rápido */}
                  {data.categories.length > 0 && (
                    <View style={[styles.band, { borderColor: colors.border }]}>
                      <View style={styles.categoriesBandHeader}>
                        <View style={styles.categoriesBandHeaderLeft}>
                          <Ionicons name="grid-outline" size={13} color={palette.primary} />
                          <Text style={[styles.categoriesBandTitle, { color: colors.muted }]}>
                            CATEGORÍAS POPULARES
                          </Text>
                        </View>
                        <Pressable
                          onPress={async () => {
                            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowCategoriesSheet(true);
                          }}
                          hitSlop={6}
                          style={styles.categoriesBandExploreBtn}>
                          <Text style={[styles.categoriesBandExploreText, { color: palette.primary }]}>
                            Ver todas ({data.categories.length})
                          </Text>
                          <Ionicons name="chevron-forward" size={12} color={palette.primary} />
                        </Pressable>
                      </View>
                      <FlatList
                        horizontal
                        data={data.categories}
                        keyExtractor={(item) => item.id}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.hList}
                        renderItem={({ item }) => (
                          <Pressable
                            onPress={async () => {
                              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setProductCategory(item.id);
                              setProductPage(1);
                              setActiveTab('productos');
                            }}
                            style={[
                              styles.chip,
                              {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                              },
                            ]}>
                            <Text style={[styles.chipText, { color: colors.text, fontWeight: '600' }]}>
                              {item.name}
                            </Text>
                            <View style={[styles.chipBadge, { backgroundColor: colors.background }]}>
                              <Text style={[styles.chipCount, { color: colors.muted }]}>
                                {item.count}
                              </Text>
                            </View>
                          </Pressable>
                        )}
                      />
                    </View>
                  )}

                  {/* Sección: Ofertas de la semana (Destacadas) */}
                  {data.offers.length > 0 && (
                    <Section
                      title="Ofertas de la semana"
                      icon="pricetag"
                      accent="#DC2626"
                      colors={colors}
                      subtitle="Descuentos activos en tiendas adheridas"
                      action={{ label: 'Ver todas', onPress: () => handleTabPress('ofertas') }}>
                      <FlatList
                        horizontal
                        data={data.offers}
                        keyExtractor={(item) => item.id}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.hList}
                        renderItem={({ item }) => (
                          <ProductCard
                            product={item}
                            colors={colors}
                            accent={palette.primary}
                            width={190}
                            onPress={() => setSelectedProduct(item)}
                            isFavorite={favorites.has(item.id)}
                            onToggleFavorite={() => toggleFavorite(item.id)}
                            onAddToCart={() => addToCart(item)}
                          />
                        )}
                      />
                    </Section>
                  )}

                  {/* Sección: Marcas oficiales */}
                  {data.brands.length > 0 && (
                    <Section
                      title="Marcas oficiales"
                      icon="shield-checkmark"
                      accent={palette.primary}
                      colors={colors}
                      subtitle="Productos originales por fabricante">
                      <FlatList
                        horizontal
                        data={data.brands}
                        keyExtractor={(item) => item.name}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.hList}
                        renderItem={({ item }) => (
                          <Pressable
                            onPress={async () => {
                              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setProductBrand(item.name);
                              setProductPage(1);
                              setActiveTab('productos');
                            }}
                            style={[
                              styles.brand,
                              {
                                backgroundColor: colors.card,
                                borderColor: colors.border,
                              },
                            ]}>
                            {item.logo ? (
                              <Image
                                source={item.logo}
                                style={styles.brandLogo}
                                contentFit="contain"
                                transition={150}
                              />
                            ) : (
                              <View style={[styles.brandInitialWrap, { backgroundColor: accentSoft }]}>
                                <Text style={[styles.brandInitial, { color: palette.primary }]}>
                                  {item.name.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                            <Text numberOfLines={1} style={[styles.brandName, { color: colors.text }]}>
                              {item.name}
                            </Text>
                            <Text style={[styles.brandCount, { color: colors.muted }]}>
                              {item.count} items
                            </Text>
                          </Pressable>
                        )}
                      />
                    </Section>
                  )}

                  {/* Sección: Catálogo de Productos */}
                  <Section
                    title={homeQuery ? `Resultados (${homeFilteredProducts.length})` : 'Catálogo de comercios'}
                    icon="sparkles"
                    accent={palette.primary}
                    colors={colors}
                    subtitle="Novedades publicadas por las empresas registradas"
                    action={{ label: 'Ver catálogo completo', onPress: () => handleTabPress('productos') }}>
                    {homeFilteredProducts.length === 0 ? (
                      <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name="search-outline" size={36} color={colors.muted} />
                        <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin coincidencias</Text>
                        <Text style={[styles.emptySub, { color: colors.muted }]}>
                          No encontramos productos con ese término en el inicio.
                        </Text>
                        <Pressable
                          onPress={() => setHomeQuery('')}
                          style={[styles.btn, { backgroundColor: palette.primary, marginTop: 6 }]}>
                          <Text style={styles.btnTextLight}>Limpiar búsqueda</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.grid}>
                        {homeFilteredProducts.slice(0, 8).map((product) => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            colors={colors}
                            accent={palette.primary}
                            onPress={() => setSelectedProduct(product)}
                            isFavorite={favorites.has(product.id)}
                            onToggleFavorite={() => toggleFavorite(product.id)}
                            onAddToCart={() => addToCart(product)}
                          />
                        ))}
                      </View>
                    )}
                  </Section>

                  {/* Banner SaaS / Comercios */}
                  <View style={styles.promo}>
                    <View
                      pointerEvents="none"
                      style={[styles.promoGlow, { left: -40, top: -40, backgroundColor: '#0284C7' }]}
                    />
                    <View
                      pointerEvents="none"
                      style={[styles.promoGlow, { right: -40, bottom: -40, backgroundColor: palette.primary }]}
                    />
                    <View style={styles.promoPill}>
                      <Ionicons name="rocket" size={13} color="#38BDF8" />
                      <Text style={styles.promoPillText}>Para Comercios & Talleres de Reparación</Text>
                    </View>
                    <Text style={styles.promoTitle}>¿Tenés un negocio o servicio técnico?</Text>
                    <Text style={styles.promoText}>
                      Sumá tu comercio a Mi tiendaPY.com. Controlá ventas, cobros, órdenes de taller e inventario en un solo sistema.
                    </Text>
                    <View style={styles.promoBenefits}>
                      {['Catálogo online integrado', 'Órdenes de servicio técnico', 'Facturación & POS móvil'].map(
                        (benefit) => (
                          <View key={benefit} style={styles.benefit}>
                            <Ionicons name="checkmark-circle" size={14} color="#38BDF8" />
                            <Text style={styles.benefitText}>{benefit}</Text>
                          </View>
                        )
                      )}
                    </View>
                    <View style={styles.promoActionsRow}>
                      <Pressable
                        onPress={async () => {
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                          router.push('/saas' as any);
                        }}
                        style={[styles.promoSaaSBtn, { backgroundColor: palette.primary }]}>
                        <Ionicons name="rocket" size={16} color="#FFFFFF" />
                        <Text style={styles.promoSaaSBtnText}>Ver Sistema SaaS & Planes</Text>
                        <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                      </Pressable>

                      <Pressable
                        onPress={async () => {
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          openWeb('/register');
                        }}
                        style={styles.promoRegisterBtn}>
                        <Text style={styles.promoRegisterBtnText}>Registrar gratis (20 días)</Text>
                      </Pressable>
                    </View>
                  </View>

                  {/* Tiendas oficiales preview */}
                  {data.stores.length > 0 && (
                    <Section
                      title="Tiendas oficiales"
                      icon="business"
                      accent={palette.primary}
                      colors={colors}
                      subtitle="Empresas con atención directa y catálogo verificado"
                      action={{ label: 'Ver directorio', onPress: () => handleTabPress('tiendas') }}>
                      <View style={styles.grid}>
                        {data.stores.slice(0, 4).map((store) => (
                          <StoreCard
                            key={store.id}
                            store={store}
                            colors={colors}
                            accent={palette.primary}
                            onPress={() => setSelectedStorePreview(store)}
                            onViewProducts={() => {
                              setProductStore(store.slug);
                              setProductPage(1);
                              setActiveTab('productos');
                              scrollRef.current?.scrollTo({ y: 0, animated: true });
                            }}
                          />
                        ))}
                      </View>
                    </Section>
                  )}
                </>
              )}
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════
              PESTAÑA 2: PRODUCTOS (CON BÚSQUEDA Y FILTRADO MEJORADO)
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'productos' && (
            <View style={styles.tabContent}>
              {/* Header Box de Productos con Buscador */}
              <View
                style={[
                  styles.heroBox,
                  {
                    backgroundColor: colors.card,
                    borderColor: dark ? '#1E293B' : '#E2E8F0',
                  },
                ]}>
                {/* Migas de pan / Breadcrumb */}
                <View style={styles.breadcrumbRow}>
                  <Pressable onPress={() => handleTabPress('inicio')} style={styles.breadcrumbLink}>
                    <Ionicons name="storefront-outline" size={12} color={colors.muted} />
                    <Text style={[styles.breadcrumbText, { color: colors.muted }]}>Marketplace</Text>
                  </Pressable>
                  <Ionicons name="chevron-forward" size={11} color={colors.muted} />
                  <View style={[styles.breadcrumbActivePill, { backgroundColor: dark ? '#1E293B' : '#F1F5F9' }]}>
                    <Text style={[styles.breadcrumbActiveText, { color: colors.text }]}>Productos</Text>
                  </View>
                </View>

                {/* Título de la sección y contador */}
                <View style={styles.heroHeaderRow}>
                  <View style={styles.heroTitleGroup}>
                    <View style={styles.packageIconBadge}>
                      <Ionicons name="cube" size={20} color="#FFFFFF" />
                    </View>
                    <View>
                      <Text style={[styles.heroTitle, { color: colors.text }]}>Catálogo de Productos</Text>
                      <Text style={[styles.heroSubtitle, { color: colors.muted }]}>
                        Artículos y repuestos de comercios paraguayos
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.totalBadge,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}>
                    <View style={styles.onlineDot} />
                    <Text style={[styles.totalBadgeText, { color: colors.text }]}>
                      {allCatalogProducts.length} producto{allCatalogProducts.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                {/* Buscador de Productos reactivo con botón limpiar */}
                <View
                  style={[
                    styles.searchContainer,
                    {
                      backgroundColor: colors.background,
                      borderColor: productQuery ? palette.primary : colors.border,
                    },
                  ]}>
                  <Ionicons
                    name="search-outline"
                    size={19}
                    color={productQuery ? palette.primary : colors.muted}
                  />
                  <TextInput
                    value={productQuery}
                    onChangeText={(text) => {
                      setProductQuery(text);
                      setProductPage(1);
                    }}
                    placeholder="Buscar por producto, marca o repuesto…"
                    placeholderTextColor={colors.muted}
                    returnKeyType="search"
                    style={[styles.searchInput, { color: colors.text }]}
                  />
                  {productQuery.length > 0 && (
                    <Pressable
                      onPress={() => {
                        setProductQuery('');
                        setProductPage(1);
                      }}
                      hitSlop={8}
                      style={styles.clearSearchBtn}>
                      <Ionicons name="close-circle" size={18} color={colors.muted} />
                    </Pressable>
                  )}
                </View>

                {/* ── Barra de Acciones y Filtros Rápidos (Carrusel Horizontal) ── */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickFilterBar}>
                  {/* Botón: Abrir Modal de Todos los Filtros */}
                  <Pressable
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowFilterModal(true);
                    }}
                    style={[
                      styles.filterChip,
                      activeFiltersCount > 0
                        ? { backgroundColor: palette.primary, borderColor: palette.primary }
                        : { backgroundColor: colors.background, borderColor: colors.border },
                    ]}>
                    <Ionicons
                      name="options-outline"
                      size={15}
                      color={activeFiltersCount > 0 ? '#FFFFFF' : colors.text}
                    />
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: activeFiltersCount > 0 ? '#FFFFFF' : colors.text, fontWeight: '800' },
                      ]}>
                      Filtros {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
                    </Text>
                  </Pressable>

                  {/* Toggle: Solo Ofertas */}
                  <Pressable
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setOnlyOffers((prev) => !prev);
                      setProductPage(1);
                    }}
                    style={[
                      styles.filterChip,
                      onlyOffers
                        ? { backgroundColor: '#DC2626', borderColor: '#DC2626' }
                        : { backgroundColor: colors.background, borderColor: colors.border },
                    ]}>
                    <Ionicons
                      name={onlyOffers ? 'flame' : 'flame-outline'}
                      size={14}
                      color={onlyOffers ? '#FFFFFF' : '#DC2626'}
                    />
                    <Text style={[styles.filterChipText, { color: onlyOffers ? '#FFFFFF' : colors.text }]}>
                      Solo ofertas
                    </Text>
                  </Pressable>

                  {/* Toggle: Solo En Stock */}
                  <Pressable
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setOnlyInStock((prev) => !prev);
                      setProductPage(1);
                    }}
                    style={[
                      styles.filterChip,
                      onlyInStock
                        ? { backgroundColor: '#059669', borderColor: '#059669' }
                        : { backgroundColor: colors.background, borderColor: colors.border },
                    ]}>
                    <Ionicons
                      name={onlyInStock ? 'checkmark-circle' : 'cube-outline'}
                      size={14}
                      color={onlyInStock ? '#FFFFFF' : '#059669'}
                    />
                    <Text style={[styles.filterChipText, { color: onlyInStock ? '#FFFFFF' : colors.text }]}>
                      En stock
                    </Text>
                  </Pressable>

                  {/* Toggle: Solo Favoritos */}
                  <Pressable
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setOnlyFavorites((prev) => !prev);
                      setProductPage(1);
                    }}
                    style={[
                      styles.filterChip,
                      onlyFavorites
                        ? { backgroundColor: '#EF4444', borderColor: '#EF4444' }
                        : { backgroundColor: colors.background, borderColor: colors.border },
                    ]}>
                    <Ionicons
                      name={onlyFavorites ? 'heart' : 'heart-outline'}
                      size={14}
                      color={onlyFavorites ? '#FFFFFF' : '#EF4444'}
                    />
                    <Text style={[styles.filterChipText, { color: onlyFavorites ? '#FFFFFF' : colors.text }]}>
                      Favoritos {favorites.size > 0 ? `(${favorites.size})` : ''}
                    </Text>
                  </Pressable>

                  {/* Botón: Selector de Ordenamiento */}
                  <Pressable
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setShowSortModal(true);
                    }}
                    style={[
                      styles.filterChip,
                      sortBy !== 'default'
                        ? { backgroundColor: dark ? 'rgba(37,99,235,0.2)' : '#EFF6FF', borderColor: palette.primary }
                        : { backgroundColor: colors.background, borderColor: colors.border },
                    ]}>
                    <Ionicons name="swap-vertical-outline" size={14} color={palette.primary} />
                    <Text style={[styles.filterChipText, { color: colors.text }]}>
                      {SORT_LABELS[sortBy]}
                    </Text>
                    <Ionicons name="chevron-down" size={12} color={colors.muted} />
                  </Pressable>

                  {/* Selector rápido de precio */}
                  <Pressable
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setPriceRange(NEXT_PRICE_RANGE[priceRange]);
                      setProductPage(1);
                    }}
                    style={[
                      styles.filterChip,
                      priceRange !== 'all'
                        ? { backgroundColor: dark ? 'rgba(37,99,235,0.2)' : '#EFF6FF', borderColor: palette.primary }
                        : { backgroundColor: colors.background, borderColor: colors.border },
                    ]}>
                    <Ionicons name="cash-outline" size={14} color={priceRange !== 'all' ? palette.primary : colors.muted} />
                    <Text style={[styles.filterChipText, { color: priceRange !== 'all' ? palette.primary : colors.text }]}>
                      {PRICE_RANGE_LABELS[priceRange]}
                    </Text>
                  </Pressable>
                </ScrollView>
              </View>

              {/* ── Tira de Filtros Activos con eliminación individual ('✕') ── */}
              {hasProductFilters && (
                <View style={styles.activeStripContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeFilterChips}>
                    {productQuery.trim().length > 0 && (
                      <Pressable
                        onPress={() => {
                          setProductQuery('');
                          setProductPage(1);
                        }}
                        style={[styles.activeTagPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[styles.activeTagText, { color: colors.text }]}>
                          {'“' + productQuery.trim() + '”'}
                        </Text>
                        <Ionicons name="close-circle" size={14} color={colors.muted} />
                      </Pressable>
                    )}

                    {productCategory && (
                      <Pressable
                        onPress={() => {
                          setProductCategory(null);
                          setProductPage(1);
                        }}
                        style={[styles.activeTagPill, { backgroundColor: colors.card, borderColor: palette.primary }]}>
                        <Ionicons name="folder-outline" size={12} color={palette.primary} />
                        <Text style={[styles.activeTagText, { color: palette.primary }]}>
                          {activeCategoryName}
                        </Text>
                        <Ionicons name="close-circle" size={14} color={palette.primary} />
                      </Pressable>
                    )}

                    {productBrand && (
                      <Pressable
                        onPress={() => {
                          setProductBrand(null);
                          setProductPage(1);
                        }}
                        style={[styles.activeTagPill, { backgroundColor: colors.card, borderColor: palette.primary }]}>
                        <Ionicons name="shield-checkmark-outline" size={12} color={palette.primary} />
                        <Text style={[styles.activeTagText, { color: palette.primary }]}>
                          {productBrand}
                        </Text>
                        <Ionicons name="close-circle" size={14} color={palette.primary} />
                      </Pressable>
                    )}

                    {productStore && (
                      <Pressable
                        onPress={() => {
                          setProductStore(null);
                          setProductPage(1);
                        }}
                        style={[styles.activeTagPill, { backgroundColor: colors.card, borderColor: palette.primary }]}>
                        <Ionicons name="storefront-outline" size={12} color={palette.primary} />
                        <Text style={[styles.activeTagText, { color: palette.primary }]}>
                          {activeStoreName}
                        </Text>
                        <Ionicons name="close-circle" size={14} color={palette.primary} />
                      </Pressable>
                    )}

                    {onlyOffers && (
                      <Pressable
                        onPress={() => {
                          setOnlyOffers(false);
                          setProductPage(1);
                        }}
                        style={[styles.activeTagPill, { backgroundColor: 'rgba(220,38,38,0.1)', borderColor: '#DC2626' }]}>
                        <Ionicons name="flame" size={12} color="#DC2626" />
                        <Text style={[styles.activeTagText, { color: '#DC2626' }]}>Ofertas</Text>
                        <Ionicons name="close-circle" size={14} color="#DC2626" />
                      </Pressable>
                    )}

                    {onlyInStock && (
                      <Pressable
                        onPress={() => {
                          setOnlyInStock(false);
                          setProductPage(1);
                        }}
                        style={[styles.activeTagPill, { backgroundColor: 'rgba(5,150,105,0.1)', borderColor: '#059669' }]}>
                        <Ionicons name="checkmark-circle" size={12} color="#059669" />
                        <Text style={[styles.activeTagText, { color: '#059669' }]}>En stock</Text>
                        <Ionicons name="close-circle" size={14} color="#059669" />
                      </Pressable>
                    )}

                    {onlyFavorites && (
                      <Pressable
                        onPress={() => {
                          setOnlyFavorites(false);
                          setProductPage(1);
                        }}
                        style={[styles.activeTagPill, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: '#EF4444' }]}>
                        <Ionicons name="heart" size={12} color="#EF4444" />
                        <Text style={[styles.activeTagText, { color: '#EF4444' }]}>Favoritos</Text>
                        <Ionicons name="close-circle" size={14} color="#EF4444" />
                      </Pressable>
                    )}

                    {priceRange !== 'all' && (
                      <Pressable
                        onPress={() => {
                          setPriceRange('all');
                          setProductPage(1);
                        }}
                        style={[styles.activeTagPill, { backgroundColor: colors.card, borderColor: palette.primary }]}>
                        <Text style={[styles.activeTagText, { color: palette.primary }]}>
                          {PRICE_RANGE_LABELS[priceRange]}
                        </Text>
                        <Ionicons name="close-circle" size={14} color={palette.primary} />
                      </Pressable>
                    )}

                    <Pressable onPress={clearProductFilters} style={styles.clearAllTextBtn}>
                      <Ionicons name="trash-outline" size={13} color={palette.danger} />
                      <Text style={styles.clearAllText}>Borrar filtros</Text>
                    </Pressable>
                  </ScrollView>
                </View>
              )}

              {/* ── Segmented Control: Explorador de Facetas (Categorías | Marcas | Tiendas) ── */}
              <View style={styles.facetExplorerWrap}>
                <View style={[styles.segmentedBar, { backgroundColor: dark ? '#1E293B' : '#F1F5F9' }]}>
                  {[
                    { key: 'categorias', label: 'Categorías', icon: 'folder-outline' },
                    { key: 'marcas', label: 'Marcas', icon: 'shield-checkmark-outline' },
                    { key: 'tiendas', label: 'Comercios', icon: 'storefront-outline' },
                  ].map((tab) => {
                    const isActive = facetTab === tab.key;
                    return (
                      <Pressable
                        key={tab.key}
                        onPress={async () => {
                          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setFacetTab(tab.key as FacetTab);
                        }}
                        style={[
                          styles.segmentButton,
                          isActive && [styles.segmentButtonActive, { backgroundColor: colors.card }],
                        ]}>
                        <Ionicons
                          name={tab.icon as any}
                          size={13}
                          color={isActive ? palette.primary : colors.muted}
                        />
                        <Text
                          style={[
                            styles.segmentButtonText,
                            { color: isActive ? colors.text : colors.muted, fontWeight: isActive ? '800' : '600' },
                          ]}>
                          {tab.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Sub-carrusel correspondiente al segmento seleccionado */}
                {facetTab === 'categorias' && data?.categories && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>
                    <Pressable
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setProductCategory(null);
                        setProductPage(1);
                      }}
                      style={[
                        styles.facetPill,
                        productCategory === null
                          ? { backgroundColor: palette.primary, borderColor: palette.primary }
                          : { backgroundColor: colors.card, borderColor: colors.border },
                      ]}>
                      <Text style={[styles.facetPillText, { color: productCategory === null ? '#FFFFFF' : colors.text }]}>
                        Todas
                      </Text>
                    </Pressable>
                    {data.categories.map((cat) => {
                      const isSelected = productCategory === cat.id;
                      return (
                        <Pressable
                          key={cat.id}
                          onPress={async () => {
                            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setProductCategory(isSelected ? null : cat.id);
                            setProductPage(1);
                          }}
                          style={[
                            styles.facetPill,
                            isSelected
                              ? { backgroundColor: palette.primary, borderColor: palette.primary }
                              : { backgroundColor: colors.card, borderColor: colors.border },
                          ]}>
                          <Text style={[styles.facetPillText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                            {cat.name}
                          </Text>
                          <View
                            style={[
                              styles.catCountBadge,
                              { backgroundColor: isSelected ? 'rgba(255,255,255,0.25)' : colors.background },
                            ]}>
                            <Text style={[styles.catCountText, { color: isSelected ? '#FFFFFF' : colors.muted }]}>
                              {cat.count}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}

                {facetTab === 'marcas' && data?.brands && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>
                    <Pressable
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setProductBrand(null);
                        setProductPage(1);
                      }}
                      style={[
                        styles.facetPill,
                        productBrand === null
                          ? { backgroundColor: palette.primary, borderColor: palette.primary }
                          : { backgroundColor: colors.card, borderColor: colors.border },
                      ]}>
                      <Text style={[styles.facetPillText, { color: productBrand === null ? '#FFFFFF' : colors.text }]}>
                        Todas
                      </Text>
                    </Pressable>
                    {data.brands.map((brand) => {
                      const isSelected = productBrand?.toLowerCase() === brand.name.toLowerCase();
                      return (
                        <Pressable
                          key={brand.name}
                          onPress={async () => {
                            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setProductBrand(isSelected ? null : brand.name);
                            setProductPage(1);
                          }}
                          style={[
                            styles.facetPill,
                            isSelected
                              ? { backgroundColor: palette.primary, borderColor: palette.primary }
                              : { backgroundColor: colors.card, borderColor: colors.border },
                          ]}>
                          <Text style={[styles.facetPillText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                            {brand.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}

                {facetTab === 'tiendas' && data?.stores && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>
                    <Pressable
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setProductStore(null);
                        setProductPage(1);
                      }}
                      style={[
                        styles.facetPill,
                        productStore === null
                          ? { backgroundColor: palette.primary, borderColor: palette.primary }
                          : { backgroundColor: colors.card, borderColor: colors.border },
                      ]}>
                      <Text style={[styles.facetPillText, { color: productStore === null ? '#FFFFFF' : colors.text }]}>
                        Todos
                      </Text>
                    </Pressable>
                    {data.stores.map((store) => {
                      const isSelected = productStore === store.slug;
                      return (
                        <Pressable
                          key={store.id}
                          onPress={async () => {
                            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setProductStore(isSelected ? null : store.slug);
                            setProductPage(1);
                          }}
                          style={[
                            styles.facetPill,
                            isSelected
                              ? { backgroundColor: palette.primary, borderColor: palette.primary }
                              : { backgroundColor: colors.card, borderColor: colors.border },
                          ]}>
                          <Text style={[styles.facetPillText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                            {store.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              {/* ── Grilla de Productos Paginada ── */}
              <View style={styles.productsArea}>
                {allCatalogProducts.length === 0 ? (
                  <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="search-outline" size={40} color={colors.muted} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin productos con esos filtros</Text>
                    <Text style={[styles.emptySub, { color: colors.muted }]}>
                      Probá quitando algunos filtros o buscando un término más general.
                    </Text>
                    <Pressable
                      onPress={clearProductFilters}
                      style={[styles.btn, { backgroundColor: palette.primary, marginTop: 8 }]}>
                      <Ionicons name="refresh" size={15} color="#FFFFFF" />
                      <Text style={styles.btnTextLight}>Restablecer todos los filtros</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={styles.grid}>
                      {paginatedProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          colors={colors}
                          accent={palette.primary}
                          onPress={() => setSelectedProduct(product)}
                          isFavorite={favorites.has(product.id)}
                          onToggleFavorite={() => toggleFavorite(product.id)}
                          onAddToCart={() => addToCart(product)}
                        />
                      ))}
                    </View>

                    {/* Controles de Paginación */}
                    <PaginationControl
                      currentPage={safeProductPage}
                      totalPages={totalProductPages}
                      totalItems={allCatalogProducts.length}
                      pageSize={PRODUCTS_PAGE_SIZE}
                      onPageChange={handleProductPageChange}
                      colors={colors}
                      accent={palette.primary}
                    />
                  </>
                )}
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════
              PESTAÑA 3: OFERTAS (CON PAGINACIÓN Y CARDS MODERNOS)
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'ofertas' && (
            <View style={styles.tabContent}>
              <View
                style={[
                  styles.heroBox,
                  {
                    backgroundColor: colors.card,
                    borderColor: dark ? '#1E293B' : '#E2E8F0',
                  },
                ]}>
                <View style={styles.breadcrumbRow}>
                  <Pressable onPress={() => handleTabPress('inicio')} style={styles.breadcrumbLink}>
                    <Ionicons name="storefront-outline" size={12} color={colors.muted} />
                    <Text style={[styles.breadcrumbText, { color: colors.muted }]}>Marketplace</Text>
                  </Pressable>
                  <Ionicons name="chevron-forward" size={11} color={colors.muted} />
                  <View style={[styles.breadcrumbActivePill, { backgroundColor: 'rgba(220,38,38,0.12)' }]}>
                    <Text style={[styles.breadcrumbActiveText, { color: '#DC2626' }]}>Ofertas</Text>
                  </View>
                </View>

                <View style={styles.heroHeaderRow}>
                  <View style={styles.heroTitleGroup}>
                    <View style={[styles.packageIconBadge, { backgroundColor: '#DC2626' }]}>
                      <Ionicons name="flame" size={20} color="#FFFFFF" />
                    </View>
                    <View>
                      <Text style={[styles.heroTitle, { color: colors.text }]}>Ofertas de la Semana</Text>
                      <Text style={[styles.heroSubtitle, { color: colors.muted }]}>
                        Precios especiales y descuentos de tiendas
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.totalBadge, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={[styles.onlineDot, { backgroundColor: '#DC2626' }]} />
                    <Text style={[styles.totalBadgeText, { color: colors.text }]}>
                      {allOfferProducts.length} oferta{allOfferProducts.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.searchContainer,
                    {
                      backgroundColor: colors.background,
                      borderColor: offerQuery ? '#DC2626' : colors.border,
                    },
                  ]}>
                  <Ionicons name="search-outline" size={19} color={offerQuery ? '#DC2626' : colors.muted} />
                  <TextInput
                    value={offerQuery}
                    onChangeText={(text) => {
                      setOfferQuery(text);
                      setOfferPage(1);
                    }}
                    placeholder="Buscar entre ofertas y descuentos…"
                    placeholderTextColor={colors.muted}
                    returnKeyType="search"
                    style={[styles.searchInput, { color: colors.text }]}
                  />
                  {offerQuery.length > 0 && (
                    <Pressable
                      onPress={() => {
                        setOfferQuery('');
                        setOfferPage(1);
                      }}
                      hitSlop={8}
                      style={styles.clearSearchBtn}>
                      <Ionicons name="close-circle" size={17} color={colors.muted} />
                    </Pressable>
                  )}
                </View>

                <View style={styles.quickFilterBar}>
                  {[
                    { key: 'discount', label: 'Mayor %' },
                    { key: 'price_asc', label: 'Menor precio' },
                    { key: 'price_desc', label: 'Mayor precio' },
                  ].map((s) => (
                    <Pressable
                      key={s.key}
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setOfferSort(s.key as any);
                        setOfferPage(1);
                      }}
                      style={[
                        styles.filterChip,
                        offerSort === s.key
                          ? { backgroundColor: '#DC2626', borderColor: '#DC2626' }
                          : { backgroundColor: colors.background, borderColor: colors.border },
                      ]}>
                      <Text style={[styles.filterChipText, { color: offerSort === s.key ? '#FFFFFF' : colors.text }]}>
                        {s.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View style={styles.productsArea}>
                {allOfferProducts.length === 0 ? (
                  <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="pricetag-outline" size={38} color={colors.muted} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin ofertas</Text>
                    <Text style={[styles.emptySub, { color: colors.muted }]}>
                      No hay ofertas que coincidan con la búsqueda.
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.grid}>
                      {paginatedOffers.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          colors={colors}
                          accent={palette.primary}
                          onPress={() => setSelectedProduct(product)}
                          isFavorite={favorites.has(product.id)}
                          onToggleFavorite={() => toggleFavorite(product.id)}
                          onAddToCart={() => addToCart(product)}
                        />
                      ))}
                    </View>

                    {/* Controles de Paginación */}
                    <PaginationControl
                      currentPage={safeOfferPage}
                      totalPages={totalOfferPages}
                      totalItems={allOfferProducts.length}
                      pageSize={OFFERS_PAGE_SIZE}
                      onPageChange={handleOfferPageChange}
                      colors={colors}
                      accent="#DC2626"
                    />
                  </>
                )}
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════
              PESTAÑA 4: TIENDAS (CON PAGINACIÓN Y CARDS MODERNOS)
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'tiendas' && (
            <View style={styles.tabContent}>
              <View
                style={[
                  styles.heroBox,
                  {
                    backgroundColor: colors.card,
                    borderColor: dark ? '#1E293B' : '#E2E8F0',
                  },
                ]}>
                <View style={styles.breadcrumbRow}>
                  <Pressable onPress={() => handleTabPress('inicio')} style={styles.breadcrumbLink}>
                    <Ionicons name="storefront-outline" size={12} color={colors.muted} />
                    <Text style={[styles.breadcrumbText, { color: colors.muted }]}>Marketplace</Text>
                  </Pressable>
                  <Ionicons name="chevron-forward" size={11} color={colors.muted} />
                  <View style={[styles.breadcrumbActivePill, { backgroundColor: dark ? '#1E293B' : '#F1F5F9' }]}>
                    <Text style={[styles.breadcrumbActiveText, { color: colors.text }]}>Tiendas</Text>
                  </View>
                </View>

                <View style={styles.heroHeaderRow}>
                  <View style={styles.heroTitleGroup}>
                    <View style={[styles.packageIconBadge, { backgroundColor: accent }]}>
                      <Ionicons name="business" size={20} color="#FFFFFF" />
                    </View>
                    <View>
                      <Text style={[styles.heroTitle, { color: colors.text }]}>Directorio de Comercios</Text>
                      <Text style={[styles.heroSubtitle, { color: colors.muted }]}>
                        Tiendas y talleres con atención directa
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.totalBadge, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <View style={styles.onlineDot} />
                    <Text style={[styles.totalBadgeText, { color: colors.text }]}>
                      {allFilteredStores.length} tienda{allFilteredStores.length !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.searchContainer,
                    {
                      backgroundColor: colors.background,
                      borderColor: storeQuery ? palette.primary : colors.border,
                    },
                  ]}>
                  <Ionicons name="search-outline" size={19} color={storeQuery ? palette.primary : colors.muted} />
                  <TextInput
                    value={storeQuery}
                    onChangeText={(text) => {
                      setStoreQuery(text);
                      setStorePage(1);
                    }}
                    placeholder="Buscar comercio por nombre o rubro…"
                    placeholderTextColor={colors.muted}
                    returnKeyType="search"
                    style={[styles.searchInput, { color: colors.text }]}
                  />
                  {storeQuery.length > 0 && (
                    <Pressable
                      onPress={() => {
                        setStoreQuery('');
                        setStorePage(1);
                      }}
                      hitSlop={8}
                      style={styles.clearSearchBtn}>
                      <Ionicons name="close-circle" size={17} color={colors.muted} />
                    </Pressable>
                  )}
                </View>

                {allStoreCities.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>
                    <Pressable
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setStoreCity(null);
                        setStorePage(1);
                      }}
                      style={[
                        styles.facetPill,
                        storeCity === null
                          ? { backgroundColor: palette.primary, borderColor: palette.primary }
                          : { backgroundColor: colors.card, borderColor: colors.border },
                      ]}>
                      <Text style={[styles.facetPillText, { color: storeCity === null ? '#FFFFFF' : colors.text }]}>
                        Todas
                      </Text>
                    </Pressable>
                    {allStoreCities.map((city) => {
                      const isSelected = storeCity === city.key;
                      return (
                        <Pressable
                          key={city.key}
                          accessibilityLabel={`${city.display}, ${city.count} ${city.count === 1 ? 'tienda' : 'tiendas'}`}
                          onPress={async () => {
                            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setStoreCity(isSelected ? null : city.key);
                            setStorePage(1);
                          }}
                          style={[
                            styles.facetPill,
                            isSelected
                              ? { backgroundColor: palette.primary, borderColor: palette.primary }
                              : { backgroundColor: colors.card, borderColor: colors.border },
                          ]}>
                          <Text style={[styles.facetPillText, { color: isSelected ? '#FFFFFF' : colors.text }]}>
                            {city.display} · {city.count}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>

              <View style={styles.productsArea}>
                {allFilteredStores.length === 0 ? (
                  <View style={[styles.emptyContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="business-outline" size={38} color={colors.muted} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin tiendas</Text>
                    <Text style={[styles.emptySub, { color: colors.muted }]}>
                      No hay comercios que coincidan con la búsqueda o ciudad.
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.grid}>
                      {paginatedStores.map((store) => (
                        <StoreCard
                          key={store.id}
                          store={store}
                          colors={colors}
                          accent={palette.primary}
                          onPress={() => setSelectedStorePreview(store)}
                          onViewProducts={() => {
                            setProductStore(store.slug);
                            setProductPage(1);
                            setActiveTab('productos');
                            scrollRef.current?.scrollTo({ y: 0, animated: true });
                          }}
                        />
                      ))}
                    </View>

                    {/* Controles de Paginación */}
                    <PaginationControl
                      currentPage={safeStorePage}
                      totalPages={totalStorePages}
                      totalItems={allFilteredStores.length}
                      pageSize={STORES_PAGE_SIZE}
                      onPageChange={handleStorePageChange}
                      colors={colors}
                      accent={palette.primary}
                    />
                  </>
                )}
              </View>
            </View>
          )}

          {/* ══════════════════════════════════════════════════════════════
              PESTAÑA 5: PERFIL (SECCIÓN IDÉNTICA O PARECIDA A LA WEB)
             ══════════════════════════════════════════════════════════════ */}
          {activeTab === 'perfil' && (
            <View style={styles.tabContent}>
              {/* Migas de pan / Breadcrumb */}
              <View style={styles.profileBreadcrumbRow}>
                <Pressable onPress={() => handleTabPress('inicio')} style={styles.breadcrumbLink}>
                  <Ionicons name="storefront-outline" size={12} color={colors.muted} />
                  <Text style={[styles.breadcrumbText, { color: colors.muted }]}>Marketplace</Text>
                </Pressable>
                <Ionicons name="chevron-forward" size={11} color={colors.muted} />
                <View style={[styles.breadcrumbActivePill, { backgroundColor: dark ? '#1E293B' : '#F1F5F9' }]}>
                  <Text style={[styles.breadcrumbActiveText, { color: colors.text }]}>Mi Perfil</Text>
                </View>
              </View>

              {/* ── Tarjeta de Identidad de Usuario (Estilo Web) ── */}
              <View style={[styles.profileHeroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.profileHeroRow}>
                  <View style={[styles.profileBigAvatar, { backgroundColor: session ? palette.primary : accentSoft }]}>
                    {session ? (
                      <Text style={styles.profileBigAvatarText}>{userInitial}</Text>
                    ) : (
                      <Ionicons name="person-outline" size={32} color={palette.primary} />
                    )}
                  </View>
                  <View style={styles.profileHeroInfo}>
                    <Text numberOfLines={1} style={[styles.profileDisplayName, { color: colors.text }]}>
                      {session?.user.email ? session.user.email.split('@')[0] : 'Invitado'}
                    </Text>
                    <Text numberOfLines={1} style={[styles.profileEmailText, { color: colors.muted }]}>
                      {session?.user.email ?? 'Sin sesión iniciada'}
                    </Text>
                    <View style={styles.profileBadgeGroup}>
                      {session ? (
                        <View style={[styles.roleBadge, { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: '#10B981' }]}>
                          <Ionicons name="checkmark-circle" size={11} color="#10B981" />
                          <Text style={[styles.roleBadgeText, { color: '#10B981' }]}>Cuenta activa</Text>
                        </View>
                      ) : (
                        <View style={[styles.roleBadge, { backgroundColor: accentSoft, borderColor: accent }]}>
                          <Text style={[styles.roleBadgeText, { color: accent }]}>Modo visitante</Text>
                        </View>
                      )}
                      {org && (
                        <View style={[styles.roleBadge, { backgroundColor: 'rgba(37,99,235,0.12)', borderColor: palette.primary }]}>
                          <Ionicons name="business" size={11} color={palette.primary} />
                          <Text style={[styles.roleBadgeText, { color: palette.primary }]}>
                            {ROLE_LABELS[org.role] ?? org.role}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>

                {/* Si no ha iniciado sesión, botón para iniciar */}
                {!session && (
                  <Pressable
                    onPress={() => router.push('/sign-in' as any)}
                    style={[styles.profileSignInBtn, { backgroundColor: palette.primary }]}>
                    <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.profileSignInBtnText}>Iniciar sesión con mi cuenta</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </Pressable>
                )}
              </View>

              {/* ── Banner de Tipo de Cuenta / Negocio (ProfileAccountTypeBanner de la Web) ── */}
              {session && org ? (
                <View style={[styles.orgCard, { backgroundColor: colors.card, borderColor: palette.primary }]}>
                  <View style={styles.orgCardHeader}>
                    <View style={[styles.orgIconWrap, { backgroundColor: 'rgba(37,99,235,0.14)' }]}>
                      <Ionicons name="business" size={24} color={palette.primary} />
                    </View>
                    <View style={styles.orgDetailsText}>
                      <View style={styles.verifiedStoreRow}>
                        <Text style={[styles.orgCardTitle, { color: colors.text }]}>{org.name}</Text>
                        <Ionicons name="shield-checkmark" size={17} color={palette.primary} />
                      </View>
                      <Text style={[styles.orgCardSubtitle, { color: colors.muted }]}>
                        Tu comercio vinculado · Rol: <Text style={{ color: colors.text, fontWeight: '700' }}>{ROLE_LABELS[org.role] ?? org.role}</Text>
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    onPress={() => router.push('/panel' as any)}
                    style={[styles.orgCtaBtn, { backgroundColor: palette.primary }]}>
                    <Ionicons name="grid" size={16} color="#FFFFFF" />
                    <Text style={styles.orgCtaBtnText}>Ir al Panel de Control de mi Negocio</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              ) : (
                /* Banner para usuarios que aún no registraron su comercio */
                <View style={[styles.leadBusinessCard, { backgroundColor: '#0F172A' }]}>
                  <View style={styles.leadPill}>
                    <Ionicons name="rocket" size={13} color="#38BDF8" />
                    <Text style={styles.leadPillText}>Para Comercios & Talleres</Text>
                  </View>
                  <Text style={styles.leadTitle}>¿Tenés un negocio o taller de reparación?</Text>
                  <Text style={styles.leadDescription}>
                    Sumá tu comercio a Mi tiendaPY.com. Controlá ventas, cobros, órdenes de taller e inventario en un solo sistema integrado.
                  </Text>
                  <View style={styles.leadBenefitsList}>
                    {['Catálogo online sincronizado en el Marketplace', 'Órdenes de servicio técnico y reparación', 'Facturación & POS móvil'].map((benefit) => (
                      <View key={benefit} style={styles.leadBenefitItem}>
                        <Ionicons name="checkmark-circle" size={14} color="#38BDF8" />
                        <Text style={styles.leadBenefitText}>{benefit}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.leadCtaRow}>
                    <Pressable
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        router.push('/saas' as any);
                      }}
                      style={[styles.leadCtaBtn, { backgroundColor: palette.primary }]}>
                      <Ionicons name="rocket" size={16} color="#FFFFFF" />
                      <Text style={styles.leadCtaText}>Ver Sistema SaaS & Planes</Text>
                      <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
                    </Pressable>

                    <Pressable
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        openWeb('/register');
                      }}
                      style={styles.leadSecondaryBtn}>
                      <Text style={styles.leadSecondaryBtnText}>Registrar gratis (20 días)</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* ── Resumen de Actividad & Accesos Rápidos (Estilo Web) ── */}
              <View style={styles.profileSectionBlock}>
                <Text style={[styles.profileSectionTitle, { color: colors.text }]}>Actividad y Gestiones</Text>
                <View style={styles.quickGrid}>
                  {/* Mis Pedidos */}
                  <Pressable
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (!session) {
                        router.push('/sign-in' as any);
                      } else {
                        openWeb('/marketplace/perfil#pedidos');
                      }
                    }}
                    style={[styles.quickCardItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.quickCardIconWrap, { backgroundColor: dark ? 'rgba(37,99,235,0.18)' : '#EFF6FF' }]}>
                      <Ionicons name="cube-outline" size={20} color={palette.primary} />
                    </View>
                    <Text style={[styles.quickCardTitle, { color: colors.text }]}>Mis Pedidos</Text>
                    <Text style={[styles.quickCardSub, { color: colors.muted }]}>Compras en tiendas</Text>
                  </Pressable>

                  {/* Mis Reparaciones (con modal interactivo en vivo) */}
                  <Pressable
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setShowRepairTracker(true);
                    }}
                    style={[styles.quickCardItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.quickCardIconWrap, { backgroundColor: dark ? 'rgba(37,99,235,0.18)' : '#EFF6FF' }]}>
                      <Ionicons name="construct-outline" size={20} color={palette.primary} />
                    </View>
                    <Text style={[styles.quickCardTitle, { color: colors.text }]}>Mis Reparaciones</Text>
                    <Text style={[styles.quickCardSub, { color: colors.muted }]}>Rastreo en taller en vivo</Text>
                  </Pressable>

                  {/* Créditos en Tiendas */}
                  <Pressable
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (!session) {
                        router.push('/sign-in' as any);
                      } else {
                        openWeb('/marketplace/perfil/creditos');
                      }
                    }}
                    style={[styles.quickCardItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.quickCardIconWrap, { backgroundColor: dark ? 'rgba(37,99,235,0.18)' : '#EFF6FF' }]}>
                      <Ionicons name="wallet-outline" size={20} color={palette.primary} />
                    </View>
                    <Text style={[styles.quickCardTitle, { color: colors.text }]}>Créditos en Tiendas</Text>
                    <Text style={[styles.quickCardSub, { color: colors.muted }]}>Cuentas corrientes</Text>
                  </Pressable>

                  {/* Mis Favoritos (con filtro en vivo en app) */}
                  <Pressable
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setOnlyFavorites(true);
                      setProductPage(1);
                      setActiveTab('productos');
                      scrollRef.current?.scrollTo({ y: 0, animated: true });
                    }}
                    style={[styles.quickCardItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.quickCardIconWrap, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                      <Ionicons name="heart" size={20} color="#EF4444" />
                    </View>
                    <Text style={[styles.quickCardTitle, { color: colors.text }]}>Mis Favoritos</Text>
                    <Text style={[styles.quickCardSub, { color: colors.muted }]}>
                      {favorites.size} guardado{favorites.size !== 1 ? 's' : ''}
                    </Text>
                  </Pressable>

                  {/* Mi Carrito de Compras */}
                  <Pressable
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      setShowCartSheet(true);
                    }}
                    style={[styles.quickCardItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.quickCardIconWrap, { backgroundColor: dark ? 'rgba(37,99,235,0.18)' : '#EFF6FF' }]}>
                      <Ionicons name="cart-outline" size={20} color={palette.primary} />
                    </View>
                    <Text style={[styles.quickCardTitle, { color: colors.text }]}>Mi Carrito</Text>
                    <Text style={[styles.quickCardSub, { color: colors.muted }]}>
                      {totalCartCount} item{totalCartCount !== 1 ? 's' : ''} agregado{totalCartCount !== 1 ? 's' : ''}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* ── Ajustes y Seguridad (Estilo Web) ── */}
              <View style={styles.profileSectionBlock}>
                <Text style={[styles.profileSectionTitle, { color: colors.text }]}>Configuración</Text>
                <View style={[styles.profileSettingsList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {/* Fila: Apariencia */}
                  <View style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.settingRowLeft}>
                      <Ionicons name={dark ? 'moon' : 'sunny'} size={18} color={palette.primary} />
                      <Text style={[styles.settingLabel, { color: colors.text }]}>Apariencia</Text>
                    </View>
                    <Text style={[styles.settingValue, { color: colors.muted }]}>
                      {dark ? 'Modo Oscuro' : 'Modo Claro'}
                    </Text>
                  </View>

                  {/* Fila: Sitio Oficial */}
                  <Pressable
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      openWeb('/');
                    }}
                    style={[styles.settingRow, { borderBottomColor: colors.border }]}>
                    <View style={styles.settingRowLeft}>
                      <Ionicons name="globe-outline" size={18} color={palette.primary} />
                      <Text style={[styles.settingLabel, { color: colors.text }]}>Sitio Web Oficial</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </Pressable>

                  {/* Fila: Políticas de Privacidad */}
                  <Pressable
                    onPress={async () => {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      openWeb('/politica-de-privacidad');
                    }}
                    style={styles.settingRow}>
                    <View style={styles.settingRowLeft}>
                      <Ionicons name="shield-outline" size={18} color={colors.muted} />
                      <Text style={[styles.settingLabel, { color: colors.text }]}>Privacidad y Términos</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </Pressable>
                </View>
              </View>

              {/* Botón de Cerrar Sesión */}
              {session && (
                <View style={styles.profileLogoutWrap}>
                  <Pressable
                    onPress={handleSignOutConfirm}
                    style={[styles.profileLogoutBtn, { borderColor: palette.danger, backgroundColor: dark ? 'rgba(239,68,68,0.1)' : '#FEF2F2' }]}>
                    <Ionicons name="log-out-outline" size={18} color={palette.danger} />
                    <Text style={[styles.profileLogoutBtnText, { color: palette.danger }]}>
                      Cerrar sesión de mi cuenta
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

        </ScrollView>

        {/* ── Modal Avanzado de Todos los Filtros ("Bottom Sheet") ── */}
        <Modal
          visible={showFilterModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowFilterModal(false)}>
          <View style={styles.modalBackdrop}>
            <Pressable style={styles.modalDismissArea} onPress={() => setShowFilterModal(false)} />
            <View style={[styles.filterSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Barra superior del Modal */}
              <View style={styles.sheetHeader}>
                <View style={styles.sheetHeaderLeft}>
                  <Ionicons name="options" size={20} color={palette.primary} />
                  <Text style={[styles.sheetTitle, { color: colors.text }]}>Filtros de Productos</Text>
                  {activeFiltersCount > 0 && (
                    <View style={[styles.filterCountBadge, { backgroundColor: palette.primary }]}>
                      <Text style={styles.filterCountBadgeText}>{activeFiltersCount}</Text>
                    </View>
                  )}
                </View>
                <Pressable onPress={() => setShowFilterModal(false)} hitSlop={10} style={styles.sheetCloseBtn}>
                  <Ionicons name="close" size={22} color={colors.muted} />
                </Pressable>
              </View>

              {/* Contenido scrolleable de Filtros */}
              <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
                {/* 1. Disponibilidad */}
                <View style={styles.sheetSection}>
                  <Text style={[styles.sheetSectionTitle, { color: colors.text }]}>Disponibilidad</Text>
                  <View style={styles.sheetOptionsRow}>
                    <Pressable
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setOnlyOffers((prev) => !prev);
                        setProductPage(1);
                      }}
                      style={[
                        styles.sheetOptionChip,
                        onlyOffers
                          ? { backgroundColor: '#DC2626', borderColor: '#DC2626' }
                          : { backgroundColor: colors.background, borderColor: colors.border },
                      ]}>
                      <Ionicons name="flame" size={15} color={onlyOffers ? '#FFFFFF' : '#DC2626'} />
                      <Text style={[styles.sheetOptionChipText, { color: onlyOffers ? '#FFFFFF' : colors.text }]}>
                        Solo ofertas
                      </Text>
                    </Pressable>

                    <Pressable
                      onPress={async () => {
                        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setOnlyInStock((prev) => !prev);
                        setProductPage(1);
                      }}
                      style={[
                        styles.sheetOptionChip,
                        onlyInStock
                          ? { backgroundColor: '#059669', borderColor: '#059669' }
                          : { backgroundColor: colors.background, borderColor: colors.border },
                      ]}>
                      <Ionicons name="checkmark-circle" size={15} color={onlyInStock ? '#FFFFFF' : '#059669'} />
                      <Text style={[styles.sheetOptionChipText, { color: onlyInStock ? '#FFFFFF' : colors.text }]}>
                        Solo en stock
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* 2. Rango de Precios */}
                <View style={styles.sheetSection}>
                  <Text style={[styles.sheetSectionTitle, { color: colors.text }]}>Rango de Precio</Text>
                  <View style={styles.sheetOptionsGrid}>
                    {(['all', 'under_100k', '100k_500k', 'over_500k'] as PriceRange[]).map((range) => {
                      const isSel = priceRange === range;
                      return (
                        <Pressable
                          key={range}
                          onPress={async () => {
                            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setPriceRange(range);
                            setProductPage(1);
                          }}
                          style={[
                            styles.sheetGridOption,
                            isSel
                              ? { backgroundColor: palette.primary, borderColor: palette.primary }
                              : { backgroundColor: colors.background, borderColor: colors.border },
                          ]}>
                          <Text style={[styles.sheetGridOptionText, { color: isSel ? '#FFFFFF' : colors.text }]}>
                            {PRICE_RANGE_LABELS[range]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* 3. Ordenar por */}
                <View style={styles.sheetSection}>
                  <Text style={[styles.sheetSectionTitle, { color: colors.text }]}>Ordenar por</Text>
                  <View style={styles.sheetOptionsGrid}>
                    {(['default', 'price_asc', 'price_desc', 'name_asc'] as SortOption[]).map((option) => {
                      const isSel = sortBy === option;
                      return (
                        <Pressable
                          key={option}
                          onPress={async () => {
                            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSortBy(option);
                            setProductPage(1);
                          }}
                          style={[
                            styles.sheetGridOption,
                            isSel
                              ? { backgroundColor: palette.primary, borderColor: palette.primary }
                              : { backgroundColor: colors.background, borderColor: colors.border },
                          ]}>
                          <Text style={[styles.sheetGridOptionText, { color: isSel ? '#FFFFFF' : colors.text }]}>
                            {SORT_LABELS[option]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* 4. Categoría */}
                {data?.categories && data.categories.length > 0 && (
                  <View style={styles.sheetSection}>
                    <View style={styles.sheetSectionHeaderRow}>
                      <Text style={[styles.sheetSectionTitle, { color: colors.text }]}>Categoría</Text>
                      {productCategory && (
                        <Pressable onPress={() => setProductCategory(null)}>
                          <Text style={{ color: palette.danger, fontSize: 12, fontWeight: '700' }}>Quitar</Text>
                        </Pressable>
                      )}
                    </View>
                    <View style={styles.sheetOptionsWrap}>
                      {data.categories.slice(0, 10).map((cat) => {
                        const isSel = productCategory === cat.id;
                        return (
                          <Pressable
                            key={cat.id}
                            onPress={async () => {
                              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setProductCategory(isSel ? null : cat.id);
                              setProductPage(1);
                            }}
                            style={[
                              styles.sheetSmallChip,
                              isSel
                                ? { backgroundColor: palette.primary, borderColor: palette.primary }
                                : { backgroundColor: colors.background, borderColor: colors.border },
                            ]}>
                            <Text style={[styles.sheetSmallChipText, { color: isSel ? '#FFFFFF' : colors.text }]}>
                              {cat.name} ({cat.count})
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 5. Marca Oficial */}
                {data?.brands && data.brands.length > 0 && (
                  <View style={styles.sheetSection}>
                    <View style={styles.sheetSectionHeaderRow}>
                      <Text style={[styles.sheetSectionTitle, { color: colors.text }]}>Marca</Text>
                      {productBrand && (
                        <Pressable onPress={() => setProductBrand(null)}>
                          <Text style={{ color: palette.danger, fontSize: 12, fontWeight: '700' }}>Quitar</Text>
                        </Pressable>
                      )}
                    </View>
                    <View style={styles.sheetOptionsWrap}>
                      {data.brands.slice(0, 10).map((b) => {
                        const isSel = productBrand?.toLowerCase() === b.name.toLowerCase();
                        return (
                          <Pressable
                            key={b.name}
                            onPress={async () => {
                              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              setProductBrand(isSel ? null : b.name);
                              setProductPage(1);
                            }}
                            style={[
                              styles.sheetSmallChip,
                              isSel
                                ? { backgroundColor: palette.primary, borderColor: palette.primary }
                                : { backgroundColor: colors.background, borderColor: colors.border },
                            ]}>
                            <Text style={[styles.sheetSmallChipText, { color: isSel ? '#FFFFFF' : colors.text }]}>
                              {b.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Barra de Acciones del Modal */}
              <View style={[styles.sheetFooter, { borderTopColor: colors.border }]}>
                {hasProductFilters ? (
                  <Pressable onPress={clearProductFilters} style={styles.sheetResetBtn}>
                    <Text style={[styles.sheetResetBtnText, { color: colors.muted }]}>Restablecer</Text>
                  </Pressable>
                ) : <View style={{ width: 80 }} />}

                <Pressable
                  onPress={() => setShowFilterModal(false)}
                  style={[styles.sheetApplyBtn, { backgroundColor: palette.primary }]}>
                  <Text style={styles.sheetApplyBtnText}>
                    Ver {allCatalogProducts.length} producto{allCatalogProducts.length !== 1 ? 's' : ''}
                  </Text>
                  <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Modal de Ordenamiento Rápido ── */}
        <Modal
          visible={showSortModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSortModal(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowSortModal(false)}>
            <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Ordenar productos por</Text>
                <Pressable onPress={() => setShowSortModal(false)} hitSlop={8}>
                  <Ionicons name="close" size={20} color={colors.muted} />
                </Pressable>
              </View>

              {(['default', 'price_asc', 'price_desc', 'name_asc'] as SortOption[]).map((option) => (
                <Pressable
                  key={option}
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSortBy(option);
                    setProductPage(1);
                    setShowSortModal(false);
                  }}
                  style={[
                    styles.modalOption,
                    sortBy === option && { backgroundColor: dark ? 'rgba(37,99,235,0.18)' : '#EFF6FF' },
                  ]}>
                  <Text
                    style={[
                      styles.modalOptionText,
                      { color: sortBy === option ? palette.primary : colors.text },
                      sortBy === option && { fontWeight: '800' },
                    ]}>
                    {SORT_LABELS[option]}
                  </Text>
                  {sortBy === option && <Ionicons name="checkmark" size={18} color={palette.primary} />}
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Modal>

        {/* ── Barra de Navegación Inferior Flotante (Menú Rediseñado Ultra Moderno) ── */}
        <View
          style={[
            styles.floatingBarContainer,
            { bottom: Math.max(14, insets.bottom + 6) },
          ]}>
          <View
            style={[
              styles.floatingBar,
              {
                backgroundColor: dark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                borderColor: dark ? 'rgba(51, 65, 85, 0.85)' : 'rgba(226, 232, 240, 0.95)',
              },
            ]}>
            
            {/* Tab: Inicio */}
            <Pressable
              onPress={() => handleTabPress('inicio')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'inicio' }}
              style={styles.tabButton}>
              <View
                style={[
                  styles.tabIconWrap,
                  activeTab === 'inicio' && {
                    backgroundColor: dark ? 'rgba(37,99,235,0.25)' : 'rgba(37,99,235,0.12)',
                  },
                ]}>
                <Ionicons
                  name={activeTab === 'inicio' ? 'storefront' : 'storefront-outline'}
                  size={20}
                  color={activeTab === 'inicio' ? palette.primary : colors.muted}
                />
              </View>
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'inicio' ? palette.primary : colors.muted, fontWeight: activeTab === 'inicio' ? '800' : '600' },
                ]}>
                Inicio
              </Text>
              {activeTab === 'inicio' && <View style={[styles.activeTabDot, { backgroundColor: palette.primary }]} />}
            </Pressable>

            {/* Tab: Productos */}
            <Pressable
              onPress={() => handleTabPress('productos')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'productos' }}
              style={styles.tabButton}>
              <View
                style={[
                  styles.tabIconWrap,
                  activeTab === 'productos' && {
                    backgroundColor: dark ? 'rgba(37,99,235,0.25)' : 'rgba(37,99,235,0.12)',
                  },
                ]}>
                <Ionicons
                  name={activeTab === 'productos' ? 'cube' : 'cube-outline'}
                  size={20}
                  color={activeTab === 'productos' ? palette.primary : colors.muted}
                />
              </View>
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'productos' ? palette.primary : colors.muted, fontWeight: activeTab === 'productos' ? '800' : '600' },
                ]}>
                Productos
              </Text>
              {activeTab === 'productos' && <View style={[styles.activeTabDot, { backgroundColor: palette.primary }]} />}
            </Pressable>

            {/* Tab: Ofertas */}
            <Pressable
              onPress={() => handleTabPress('ofertas')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'ofertas' }}
              style={styles.tabButton}>
              <View
                style={[
                  styles.tabIconWrap,
                  activeTab === 'ofertas' && {
                    backgroundColor: 'rgba(220,38,38,0.15)',
                  },
                ]}>
                <Ionicons
                  name={activeTab === 'ofertas' ? 'pricetag' : 'pricetag-outline'}
                  size={20}
                  color={activeTab === 'ofertas' ? '#DC2626' : colors.muted}
                />
              </View>
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'ofertas' ? '#DC2626' : colors.muted, fontWeight: activeTab === 'ofertas' ? '800' : '600' },
                ]}>
                Ofertas
              </Text>
              {activeTab === 'ofertas' && <View style={[styles.activeTabDot, { backgroundColor: '#DC2626' }]} />}
            </Pressable>

            {/* Tab: Tiendas */}
            <Pressable
              onPress={() => handleTabPress('tiendas')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'tiendas' }}
              style={styles.tabButton}>
              <View
                style={[
                  styles.tabIconWrap,
                  activeTab === 'tiendas' && {
                    backgroundColor: dark ? 'rgba(37,99,235,0.25)' : 'rgba(37,99,235,0.12)',
                  },
                ]}>
                <Ionicons
                  name={activeTab === 'tiendas' ? 'business' : 'business-outline'}
                  size={20}
                  color={activeTab === 'tiendas' ? palette.primary : colors.muted}
                />
              </View>
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'tiendas' ? palette.primary : colors.muted, fontWeight: activeTab === 'tiendas' ? '800' : '600' },
                ]}>
                Tiendas
              </Text>
              {activeTab === 'tiendas' && <View style={[styles.activeTabDot, { backgroundColor: palette.primary }]} />}
            </Pressable>

            {/* Tab: Mi Perfil (Estilo Web) */}
            <Pressable
              onPress={() => handleTabPress('perfil')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'perfil' }}
              style={styles.tabButton}>
              <View
                style={[
                  styles.tabIconWrap,
                  activeTab === 'perfil' && {
                    backgroundColor: dark ? 'rgba(37,99,235,0.25)' : 'rgba(37,99,235,0.12)',
                  },
                ]}>
                <Ionicons
                  name={activeTab === 'perfil' ? 'person' : 'person-outline'}
                  size={20}
                  color={activeTab === 'perfil' ? palette.primary : colors.muted}
                />
              </View>
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === 'perfil' ? palette.primary : colors.muted, fontWeight: activeTab === 'perfil' ? '800' : '600' },
                ]}>
                Mi Perfil
              </Text>
              {activeTab === 'perfil' && <View style={[styles.activeTabDot, { backgroundColor: palette.primary }]} />}
            </Pressable>
          </View>
        </View>

        {/* Botón Flotante de Carrito de Compras si hay items */}
        {cartItems.length > 0 && (
          <View
            style={[
              styles.floatingCartContainer,
              { bottom: Math.max(14, insets.bottom + 6) + 74 },
            ]}>
            <Pressable
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setShowCartSheet(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Ver carrito de compras"
              style={({ pressed }) => [
                styles.floatingCartPill,
                {
                  backgroundColor: dark ? '#0F172A' : '#1E293B',
                  borderColor: dark ? '#334155' : '#0F172A',
                  opacity: pressed ? 0.9 : 1,
                },
              ]}>
              <View style={styles.floatingCartLeft}>
                <View style={styles.floatingCartBadgeIcon}>
                  <Ionicons name="cart" size={16} color="#FFFFFF" />
                  <View style={styles.floatingCartBadgeNum}>
                    <Text style={styles.floatingCartBadgeNumText}>{totalCartCount}</Text>
                  </View>
                </View>
                <Text style={styles.floatingCartText}>Ver carrito</Text>
              </View>

              <View style={styles.floatingCartRight}>
                <Text style={styles.floatingCartTotalText}>
                  {formatGs(
                    cartItems.reduce((acc, i) => acc + i.price * i.quantity, 0)
                  )}
                </Text>
                <Ionicons name="chevron-forward" size={15} color="#38BDF8" />
              </View>
            </Pressable>
          </View>
        )}

        {/* Modal de Detalle Rápido de Producto */}
        <ProductDetailSheet
          product={selectedProduct}
          visible={selectedProduct !== null}
          onClose={() => setSelectedProduct(null)}
          isFavorite={selectedProduct ? favorites.has(selectedProduct.id) : false}
          onToggleFavorite={() => selectedProduct && toggleFavorite(selectedProduct.id)}
          store={selectedProduct ? (data?.stores.find((s) => s.slug === selectedProduct.store.slug) ?? null) : null}
          onAddToCart={addToCart}
          onSelectStore={(slug) => {
            setSelectedProduct(null);
            setProductStore(slug);
            setProductPage(1);
            setActiveTab('productos');
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
          onSelectBrand={(brand) => {
            setSelectedProduct(null);
            setProductBrand(brand);
            setProductPage(1);
            setActiveTab('productos');
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
          onSelectCategory={(catId) => {
            setSelectedProduct(null);
            setProductCategory(catId);
            setProductPage(1);
            setActiveTab('productos');
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
        />

        {/* Modal de Carrito de Compras (Agrupado por Tienda y WhatsApp) */}
        <CartSheet
          visible={showCartSheet}
          onClose={() => setShowCartSheet(false)}
          items={cartItems}
          onUpdateQuantity={updateCartQuantity}
          onRemoveItem={removeFromCart}
          onClearCart={clearCart}
        />

        {/* Modal Explorador Completo de Categorías */}
        <CategoriesSheet
          visible={showCategoriesSheet}
          onClose={() => setShowCategoriesSheet(false)}
          categories={data?.categories ?? []}
          selectedCategoryId={productCategory}
          onSelectCategory={(id) => {
            setProductCategory(id);
            setProductPage(1);
            setActiveTab('productos');
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
        />

        {/* Modal Vista Rápida de Tienda Oficial */}
        <StoreDetailSheet
          store={selectedStorePreview}
          visible={selectedStorePreview !== null}
          onClose={() => setSelectedStorePreview(null)}
          onViewProducts={(slug) => {
            setSelectedStorePreview(null);
            setProductStore(slug);
            setProductPage(1);
            setActiveTab('productos');
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          }}
        />

        {/* Modal de Rastreo de Reparaciones / Servicio Técnico en Vivo */}
        <RepairTrackerModal
          visible={showRepairTracker}
          onClose={() => setShowRepairTracker(false)}
        />
      </View>
    </SafeAreaView>
  );
}

type Colors = ReturnType<typeof usePalette>;

// ── Componente de Paginación Reutilizable ──
function PaginationControl({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  colors,
  accent,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  colors: Colors;
  accent: string;
}) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPages = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const pages = getPages();

  return (
    <View style={styles.paginationWrapper}>
      <Text style={[styles.paginationSummary, { color: colors.muted }]}>
        Mostrando <Text style={{ color: colors.text, fontWeight: '800' }}>{startItem} – {endItem}</Text> de{' '}
        <Text style={{ color: colors.text, fontWeight: '800' }}>{totalItems}</Text> resultados
      </Text>

      <View style={styles.paginationControlsRow}>
        <Pressable
          disabled={currentPage === 1}
          onPress={() => onPageChange(currentPage - 1)}
          style={({ pressed }) => [
            styles.pageNavBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: currentPage === 1 ? 0.35 : pressed ? 0.7 : 1,
            },
          ]}>
          <Ionicons name="chevron-back" size={15} color={currentPage === 1 ? colors.muted : colors.text} />
          <Text style={[styles.pageNavBtnText, { color: currentPage === 1 ? colors.muted : colors.text }]}>
            Ant
          </Text>
        </Pressable>

        <View style={styles.pageNumbersRow}>
          {pages.map((p) => {
            const isActive = p === currentPage;
            return (
              <Pressable
                key={p}
                onPress={() => onPageChange(p)}
                style={({ pressed }) => [
                  styles.pageNumberBtn,
                  {
                    backgroundColor: isActive ? accent : colors.card,
                    borderColor: isActive ? accent : colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}>
                <Text
                  style={[
                    styles.pageNumberText,
                    { color: isActive ? '#FFFFFF' : colors.text, fontWeight: isActive ? '900' : '600' },
                  ]}>
                  {p}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          disabled={currentPage === totalPages}
          onPress={() => onPageChange(currentPage + 1)}
          style={({ pressed }) => [
            styles.pageNavBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: currentPage === totalPages ? 0.35 : pressed ? 0.7 : 1,
            },
          ]}>
          <Text
            style={[
              styles.pageNavBtnText,
              { color: currentPage === totalPages ? colors.muted : colors.text },
            ]}>
            Sig
          </Text>
          <Ionicons name="chevron-forward" size={15} color={currentPage === totalPages ? colors.muted : colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

function Section({
  title,
  subtitle,
  icon,
  accent,
  colors,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
  colors: Colors;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.flex}>
          <View style={styles.sectionTitleRow}>
            <View style={[styles.sectionIconBadge, { backgroundColor: 'rgba(37,99,235,0.09)' }]}>
              <Ionicons name={icon} size={16} color={accent} />
            </View>
            <Text style={[styles.h2, { color: colors.text }]}>{title}</Text>
          </View>
          {subtitle && <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>{subtitle}</Text>}
        </View>
        {action && (
          <Pressable
            onPress={action.onPress}
            style={({ pressed }) => [
              styles.smallBtn,
              { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
            ]}>
            <Text style={[styles.smallBtnText, { color: colors.text }]}>{action.label}</Text>
            <Ionicons name="arrow-forward" size={13} color={colors.text} />
          </Pressable>
        )}
      </View>
      {children}
    </View>
  );
}

function StatChip({
  icon,
  value,
  label,
  accent,
  soft,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  accent: string;
  soft: string;
  colors: Colors;
}) {
  return (
    <View style={styles.statChip}>
      <View style={[styles.statIcon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={13} color={accent} />
      </View>
      <Text style={{ color: colors.muted, fontSize: 13 }}>
        <Text style={{ color: colors.text, fontWeight: '800' }}>{value.toLocaleString('es-PY')}</Text> {label}
      </Text>
    </View>
  );
}

// ── Card de Producto Rediseñado y Modernizado ──
function ProductCard({
  product,
  colors,
  accent,
  width,
  onPress,
  isFavorite,
  onToggleFavorite,
  onAddToCart,
}: {
  product: MarketProduct;
  colors: Colors;
  accent: string;
  width?: number;
  onPress?: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onAddToCart?: () => void;
}) {
  const discount =
    product.offerPrice && product.price && product.price > product.offerPrice
      ? Math.round((1 - product.offerPrice / product.price) * 100)
      : null;

  const savings =
    product.offerPrice && product.price && product.price > product.offerPrice
      ? product.price - product.offerPrice
      : null;

  return (
    <Pressable
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onPress) {
          onPress();
        } else {
          openWeb(productPath(product));
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={product.name}
      style={({ pressed }) => [
        styles.productCard,
        width ? { width } : styles.gridItem,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}>
      {/* ── Contenedor de Imagen y Badges Flotantes ── */}
      <View style={[styles.productImageWrap, { backgroundColor: colors.background }]}>
        {product.image ? (
          <Image
            source={product.image}
            style={styles.productImage}
            contentFit="contain"
            transition={200}
          />
        ) : (
          <View style={styles.imageFallbackWrap}>
            <Ionicons name="cube-outline" size={34} color={colors.muted} />
          </View>
        )}

        {/* Badge Descuento (Top-Left) */}
        {discount ? (
          <View style={styles.discountBadge}>
            <Ionicons name="flame" size={10} color="#FFFFFF" />
            <Text style={styles.discountText}>-{discount}%</Text>
          </View>
        ) : null}

        {/* Botón Favorito (Top-Right) */}
        {onToggleFavorite && (
          <Pressable
            onPress={async (e) => {
              e.stopPropagation?.();
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onToggleFavorite();
            }}
            hitSlop={8}
            style={[
              styles.productFavBtn,
              isFavorite
                ? { backgroundColor: 'rgba(239,68,68,0.18)' }
                : { backgroundColor: 'rgba(15,23,42,0.45)' },
            ]}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={14}
              color={isFavorite ? '#EF4444' : '#FFFFFF'}
            />
          </Pressable>
        )}

        {/* Overlay Agotado */}
        {!product.inStock && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockOverlayText}>Agotado</Text>
          </View>
        )}
      </View>

      {/* ── Cuerpo del Card ── */}
      <View style={styles.productBody}>
        {/* Fila Tienda & Marca */}
        <View style={styles.storeBadgeRow}>
          <View style={styles.storeBadgeWrap}>
            <Ionicons name="storefront" size={11} color={accent} />
            <Text numberOfLines={1} style={[styles.productStore, { color: accent }]}>
              {product.store.name}
            </Text>
          </View>
          {product.brand ? (
            <View style={[styles.brandPill, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Text numberOfLines={1} style={[styles.brandPillText, { color: colors.muted }]}>
                {product.brand}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Título de Producto */}
        <Text numberOfLines={2} style={[styles.productName, { color: colors.text }]}>
          {product.name}
        </Text>

        {/* Bloque de Precios en Guaraníes */}
        <View style={styles.priceContainer}>
          {product.price === null ? (
            <View style={[styles.askPriceWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="chatbubble-ellipses-outline" size={11} color={colors.muted} />
              <Text style={[styles.askPriceText, { color: colors.muted }]}>Consultar precio</Text>
            </View>
          ) : product.offerPrice ? (
            <View style={styles.offerPriceBlock}>
              <View style={styles.priceOldRow}>
                <Text style={[styles.productOld, { color: colors.muted }]}>
                  {formatGs(product.price)}
                </Text>
                {savings ? (
                  <Text style={styles.savingsLabel}>
                    Ahorro {formatGs(savings)}
                  </Text>
                ) : null}
              </View>
              <Text style={[styles.productPrice, { color: '#DC2626' }]}>
                {formatGs(product.offerPrice)}
              </Text>
            </View>
          ) : (
            <Text style={[styles.productPrice, { color: colors.text }]}>
              {formatGs(product.price)}
            </Text>
          )}
        </View>

        {/* Pie de Card con disponibilidad y acciones */}
        <View style={[styles.cardFooterBar, { borderTopColor: colors.border }]}>
          <View style={styles.stockStatusRow}>
            <View
              style={[
                styles.stockDot,
                { backgroundColor: product.inStock ? '#10B981' : '#DC2626' },
              ]}
            />
            <Text
              style={[
                styles.stockStatusText,
                { color: product.inStock ? colors.muted : '#DC2626' },
              ]}>
              {product.inStock ? 'En stock' : 'Sin stock'}
            </Text>
          </View>

          <View style={styles.cardFooterActions}>
            {onAddToCart && product.inStock && (
              <Pressable
                onPress={async (e) => {
                  e.stopPropagation?.();
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onAddToCart();
                }}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Agregar ${product.name} al carrito`}
                style={[styles.quickAddCartBtn, { backgroundColor: palette.primary }]}>
                <Ionicons name="cart" size={13} color="#FFFFFF" />
              </Pressable>
            )}
            <View style={[styles.viewProductPill, { backgroundColor: accent }]}>
              <Text style={styles.viewProductText}>Ver</Text>
              <Ionicons name="arrow-forward" size={10} color="#FFFFFF" />
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function StoreCard({
  store,
  colors,
  accent,
  onPress,
  onViewProducts,
}: {
  store: MarketStore;
  colors: Colors;
  accent: string;
  onPress?: () => void;
  onViewProducts?: () => void;
}) {
  return (
    <Pressable
      onPress={async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (onPress) {
          onPress();
        } else if (onViewProducts) {
          onViewProducts();
        } else {
          openWeb(storePath(store));
        }
      }}
      accessibilityRole="button"
      accessibilityLabel={store.name}
      style={({ pressed }) => [
        styles.storeCard,
        styles.gridItem,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}>
      <View style={styles.storeHeader}>
        <View style={[styles.storeLogo, { backgroundColor: colors.background, borderColor: colors.border }]}>
          {store.logo ? (
            <Image source={store.logo} style={styles.storeLogoImg} contentFit="cover" />
          ) : (
            <Text style={[styles.storeInitial, { color: accent }]}>
              {store.name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        {store.rating ? (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={11} color="#F59E0B" />
            <Text style={styles.ratingText}>{store.rating.toFixed(1)}</Text>
          </View>
        ) : null}
      </View>

      <Text numberOfLines={1} style={[styles.storeName, { color: colors.text }]}>
        {store.name}
      </Text>

      {(store.rubro || store.city) && (
        <View style={styles.storeLocationRow}>
          <Ionicons name="location-outline" size={12} color={colors.muted} />
          <Text numberOfLines={1} style={[styles.storeMeta, { color: colors.muted }]}>
            {[store.city, store.rubro].filter(Boolean).join(' · ')}
          </Text>
        </View>
      )}

      <View style={[styles.storeFooter, { borderColor: colors.border }]}>
        <Text style={[styles.storeProductsCount, { color: accent }]}>
          {store.products} productos
        </Text>
        <Ionicons name="chevron-forward" size={14} color={colors.muted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { paddingBottom: 50 },
  tabContent: { flex: 1 },

  hero: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: 'center',
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  glow: {
    position: 'absolute',
    top: -140,
    width: 480,
    height: 280,
    borderRadius: 240,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  pillText: { fontSize: 12, fontWeight: '700' },
  h1: {
    fontSize: 27,
    lineHeight: 33,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  lead: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 420,
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginTop: 14,
  },
  statChip: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statIcon: { width: 22, height: 22, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },

  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingLeft: 14,
    paddingRight: 6,
    height: 52,
    marginTop: 18,
    width: '100%',
    maxWidth: 520,
  },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  searchClearBtn: { padding: 6 },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  btnTextLight: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  loading: { alignItems: 'center', gap: 10, paddingVertical: 48 },
  loadingText: { fontSize: 14, fontWeight: '500' },
  errorCard: {
    margin: 20,
    borderWidth: 1,
    borderRadius: 18,
    padding: 22,
    alignItems: 'center',
    gap: 8,
  },
  errorTitle: { fontSize: 16, fontWeight: '800' },
  errorText: { textAlign: 'center', fontSize: 13, marginBottom: 4 },

  categoriesBandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  categoriesBandHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoriesBandTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  categoriesBandExploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  categoriesBandExploreText: {
    fontSize: 12,
    fontWeight: '700',
  },

  band: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  hList: { paddingHorizontal: 16, gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipText: { fontSize: 13 },
  chipBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  chipCount: { fontSize: 11, fontWeight: '700' },

  section: { paddingTop: 26, gap: 14 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  h2: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  sectionSubtitle: { fontSize: 12, marginTop: 2 },
  smallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  smallBtnText: { fontSize: 12, fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 16 },
  gridItem: { width: '48%', flexGrow: 1 },

  emptyContainer: {
    marginHorizontal: 16,
    padding: 28,
    borderWidth: 1,
    borderRadius: 20,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', textAlign: 'center' },
  emptySub: { fontSize: 13, textAlign: 'center', maxWidth: 290 },

  /* ── Estilos del Card de Producto Modernizado ── */
  productCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  productImageWrap: {
    aspectRatio: 1.08,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    position: 'relative',
    overflow: 'hidden',
  },
  productImage: { width: '84%', height: '84%' },
  imageFallbackWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    shadowColor: '#DC2626',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  discountText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: -0.2 },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  featuredText: { color: '#B45309', fontSize: 10, fontWeight: '800' },
  productFavBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  outOfStockOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  outOfStockOverlayText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },

  productBody: { padding: 11, gap: 5 },
  storeBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  storeBadgeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flex: 1,
  },
  productStore: {
    fontSize: 10.5,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  brandPill: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    maxWidth: 65,
  },
  brandPillText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  productName: {
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 18,
    minHeight: 36,
  },
  priceContainer: {
    marginTop: 2,
  },
  offerPriceBlock: {
    gap: 1,
  },
  priceOldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
  },
  productOld: {
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  savingsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  productPrice: {
    fontSize: 15.5,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  askPriceWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  askPriceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardFooterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 3,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  stockStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  stockStatusText: {
    fontSize: 10.5,
    fontWeight: '600',
  },
  viewProductPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  viewProductText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardFooterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quickAddCartBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },

  brand: {
    width: 108,
    borderWidth: 1,
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
    gap: 6,
  },
  brandLogo: { width: 68, height: 38 },
  brandInitialWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandInitial: { fontSize: 22, fontWeight: '900' },
  brandName: { fontSize: 12, fontWeight: '700' },
  brandCount: { fontSize: 11 },

  promo: {
    marginTop: 32,
    marginHorizontal: 16,
    borderRadius: 22,
    padding: 22,
    backgroundColor: '#0F172A',
    overflow: 'hidden',
    gap: 12,
  },
  promoGlow: { position: 'absolute', width: 220, height: 220, borderRadius: 110, opacity: 0.22 },
  promoPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.3)',
    backgroundColor: 'rgba(56,189,248,0.1)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  promoPillText: { color: '#38BDF8', fontSize: 11, fontWeight: '700' },
  promoTitle: { color: '#FFFFFF', fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.5 },
  promoText: { color: '#CBD5E1', fontSize: 13, lineHeight: 19 },
  promoBenefits: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  benefitText: { color: '#F1F5F9', fontSize: 11, fontWeight: '600' },
  promoActionsRow: {
    gap: 8,
    marginTop: 6,
  },
  promoSaaSBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 14,
  },
  promoSaaSBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  promoRegisterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  promoRegisterBtnText: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '700',
  },

  storeCard: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 5 },
  storeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  storeLogo: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeLogoImg: { width: '100%', height: '100%' },
  storeInitial: { fontSize: 20, fontWeight: '900' },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245,158,11,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  ratingText: { fontSize: 12, fontWeight: '800', color: '#D97706' },
  storeName: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  storeLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  storeMeta: { fontSize: 12, fontWeight: '500' },
  storeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  storeProductsCount: { fontSize: 12, fontWeight: '700' },

  /* ── Estilos específicos para la sección Productos ── */
  heroBox: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breadcrumbLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  breadcrumbText: {
    fontSize: 12,
    fontWeight: '600',
  },
  breadcrumbActivePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  breadcrumbActiveText: {
    fontSize: 12,
    fontWeight: '800',
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  packageIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  totalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  totalBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
  },
  clearSearchBtn: {
    padding: 4,
  },

  /* ── Barra de Filtros Rápidos (Horizontal Scroll) ── */
  quickFilterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
  },

  /* ── Tira de Filtros Activos ── */
  activeStripContainer: {
    marginTop: 10,
  },
  activeFilterChips: {
    paddingHorizontal: 16,
    gap: 6,
    alignItems: 'center',
  },
  activeTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  activeTagText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  clearAllTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  clearAllText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: palette.danger,
  },

  /* ── Explorador de Facetas con Segmented Control ── */
  facetExplorerWrap: {
    marginTop: 12,
    gap: 8,
  },
  segmentedBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 9,
  },
  segmentButtonActive: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentButtonText: {
    fontSize: 12,
  },

  horizontalChips: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 2,
  },
  facetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  facetPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  catCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
  },
  catCountText: {
    fontSize: 10,
    fontWeight: '800',
  },

  productsArea: {
    marginTop: 14,
    gap: 16,
  },

  /* ── Controles de Paginación ── */
  paginationWrapper: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 16,
    alignItems: 'center',
    gap: 12,
  },
  paginationSummary: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  paginationControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pageNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pageNavBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pageNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  pageNumberBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumberText: {
    fontSize: 13,
  },

  /* ── Modal de Filtros Avanzados (Bottom Sheet) ── */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  filterSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    maxHeight: '85%',
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  sheetHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  filterCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterCountBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  sheetCloseBtn: {
    padding: 4,
  },
  sheetBody: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  sheetSection: {
    marginBottom: 20,
    gap: 10,
  },
  sheetSectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sheetOptionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetOptionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  sheetOptionChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sheetOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sheetGridOption: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetGridOptionText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  sheetOptionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  sheetSmallChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  sheetSmallChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sheetFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetResetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sheetResetBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  sheetApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  sheetApplyBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  /* ── Modal de Ordenamiento Rápido ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 6,
    maxWidth: 380,
    alignSelf: 'center',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },

  /* ── Estilos para la nueva Sección de Mi Perfil (Estilo Web) ── */
  profileBreadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
  },
  profileHeroCard: {
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 16,
  },
  profileHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileBigAvatar: {
    width: 62,
    height: 62,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  profileBigAvatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '900',
  },
  profileHeroInfo: {
    flex: 1,
    gap: 3,
  },
  profileDisplayName: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  profileEmailText: {
    fontSize: 13,
  },
  profileBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  profileSignInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    height: 48,
  },
  profileSignInBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  /* Tarjeta de Organización / Comercio */
  orgCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 18,
    gap: 14,
  },
  orgCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  orgIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orgDetailsText: {
    flex: 1,
    gap: 2,
  },
  verifiedStoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orgCardTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  orgCardSubtitle: {
    fontSize: 12,
  },
  orgCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
  },
  orgCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },

  /* Tarjeta para quienes no tienen comercio */
  leadBusinessCard: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 22,
    padding: 20,
    gap: 12,
  },
  leadPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(56,189,248,0.35)',
    backgroundColor: 'rgba(56,189,248,0.1)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  leadPillText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  leadTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '900',
    lineHeight: 24,
    letterSpacing: -0.4,
  },
  leadDescription: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
  },
  leadBenefitsList: {
    gap: 6,
  },
  leadBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  leadBenefitText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '600',
  },
  leadCtaRow: {
    gap: 8,
    marginTop: 6,
  },
  leadCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 46,
    borderRadius: 12,
  },
  leadCtaText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  leadSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  leadSecondaryBtnText: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Bloque de secciones de Perfil */
  profileSectionBlock: {
    marginHorizontal: 16,
    marginTop: 20,
    gap: 10,
  },
  profileSectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
    paddingHorizontal: 4,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCardItem: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  quickCardIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickCardTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    marginTop: 2,
  },
  quickCardSub: {
    fontSize: 11,
  },

  profileSettingsList: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingLabel: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  settingValue: {
    fontSize: 12.5,
    fontWeight: '500',
  },

  profileLogoutWrap: {
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 10,
  },
  profileLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    height: 48,
  },
  profileLogoutBtnText: {
    fontSize: 13.5,
    fontWeight: '800',
  },

  /* ── Botón Flotante de Carrito de Compras ── */
  floatingCartContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 98,
  },
  floatingCartPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 420,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  floatingCartLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  floatingCartBadgeIcon: {
    position: 'relative',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingCartBadgeNum: {
    position: 'absolute',
    top: -5,
    right: -7,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingCartBadgeNumText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
  floatingCartText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  floatingCartRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  floatingCartTotalText: {
    color: '#38BDF8',
    fontSize: 13.5,
    fontWeight: '900',
    letterSpacing: -0.2,
  },

  /* ── Barra de Navegación Inferior Flotante (Menú Rediseñado) ── */
  floatingBarContainer: {
    position: 'absolute',
    left: 14,
    right: 14,
    alignItems: 'center',
    zIndex: 99,
  },
  floatingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 460,
    height: 66,
    borderRadius: 33,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    shadowColor: '#0F172A',
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 5,
    position: 'relative',
  },
  tabIconWrap: {
    width: 38,
    height: 30,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 10,
    letterSpacing: 0.1,
  },
  activeTabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 2,
  },
});
