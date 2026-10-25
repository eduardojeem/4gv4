import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { apiFetch } from '@/lib/api';
import { formatGs, openWeb, productPath, SITE_URL, type MarketProduct, type MarketStore } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { availabilityLabel, toProductDetail, whatsappProductLine, type ProductDetail } from '@/lib/product-detail-model';
import { imageUrl } from '@/lib/products';

interface ProductDetailSheetProps {
  product: MarketProduct | null;
  visible: boolean;
  onClose: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  store?: MarketStore | null;
  onAddToCart?: (product: MarketProduct) => void;
  onSelectStore?: (slug: string) => void;
  onSelectBrand?: (brand: string) => void;
  onSelectCategory?: (id: string) => void;
  /** Otros productos de la misma tienda, para seguir mirando sin salir. */
  related?: MarketProduct[];
  onSelectProduct?: (product: MarketProduct) => void;
}

/** La pantalla completa de un producto del marketplace. */
export function ProductDetailSheet({
  product,
  visible,
  onClose,
  isFavorite,
  onToggleFavorite,
  store,
  onAddToCart,
  onSelectStore,
  onSelectBrand,
  onSelectCategory,
  related = [],
  onSelectProduct,
}: ProductDetailSheetProps) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  // El detalle completo (fotos, descripción, stock, opciones) se pide al abrir el producto.
  const [loaded, setLoaded] = useState<{ id: string; detail: ProductDetail | null } | null>(null);
  const [selected, setSelected] = useState<{ productId: string; variantId: string } | null>(null);
  const [page, setPage] = useState<{ productId: string; index: number } | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [needsOption, setNeedsOption] = useState<string | null>(null);
  const productId = product?.id ?? null;
  const storeSlug = product?.store.slug ?? null;

  useEffect(() => {
    if (!visible || !productId || !storeSlug) return;
    let alive = true;
    // Al pasar a otro producto de la tienda se vuelve arriba.
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    apiFetch<{ data?: Record<string, unknown> }>(`/api/public/products/${encodeURIComponent(productId)}?org=${encodeURIComponent(storeSlug)}`, { auth: false })
      .then((res) => {
        if (alive) setLoaded({ id: productId, detail: toProductDetail(res.data, imageUrl) });
      })
      .catch(() => {
        // Sin el detalle, la pantalla muestra lo que ya trajo la lista.
        if (alive) setLoaded({ id: productId, detail: null });
      });
    return () => {
      alive = false;
    };
  }, [visible, productId, storeSlug]);

  if (!product) return null;

  const detail = loaded?.id === product.id ? loaded.detail : null;
  const loadingDetail = loaded?.id !== product.id;
  const variant = detail?.variants.find((option) => selected?.productId === product.id && option.id === selected.variantId) ?? null;
  const hasOptions = Boolean(detail?.variants.length);
  // La lista ya trae el precio en null cuando la tienda lo esconde: el detalle no lo destapa.
  const hidePrice = Boolean(detail?.hidePrice) || (!product.price && !product.offerPrice);
  const basePrice = hidePrice ? null : (variant?.price ?? detail?.price ?? product.price);
  const offerPrice = hidePrice || variant ? null : detail ? detail.offerPrice : product.offerPrice;
  const finalPrice = offerPrice ?? basePrice;
  const images = detail?.images.length ? detail.images : product.image ? [product.image] : [];
  const inStock = variant ? variant.inStock : detail ? detail.inStock : product.inStock;
  const stockCount = variant ? variant.stock : detail ? detail.stock : null;
  const pageIndex = page?.productId === product.id ? page.index : 0;
  const descriptionOpen = expanded === product.id;
  const askOption = needsOption === product.id && !variant;
  const moreFromStore = related.filter((item) => item.id !== product.id && item.store.slug === product.store.slug).slice(0, 10);
  const galleryHeight = Math.min(screenWidth, 420);

  const discount =
    offerPrice && basePrice && basePrice > offerPrice
      ? Math.round((1 - offerPrice / basePrice) * 100)
      : null;

  const savings =
    offerPrice && basePrice && basePrice > offerPrice
      ? basePrice - offerPrice
      : null;

  const handleShare = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const url = `${SITE_URL}${productPath(product)}`;
      await Share.share({
        title: product.name,
        message: `Mirá este producto en Mi tiendaPY: ${product.name} - ${url}`,
        url,
      });
    } catch {
      // Ignore share errors
    }
  };

  const handleWhatsApp = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const priceText = finalPrice ? formatGs(finalPrice) : '';
    const message = encodeURIComponent(
      `¡Hola! Vi en Mi tiendaPY su producto *${whatsappProductLine(product.name, variant)}*${priceText ? ` (${priceText})` : ''} en ${product.store.name}. ¿Tienen disponibilidad?`
    );

    // Si la tienda tiene WhatsApp registrado, abrimos directo a su chat
    const rawNumber = store?.whatsapp ? store.whatsapp.replace(/\D/g, '') : null;
    if (rawNumber && rawNumber.length >= 8) {
      // Si el número no tiene código de país (Paraguay 595), lo agregamos si arranca con 09
      let phoneWithCountry = rawNumber;
      if (rawNumber.startsWith('09')) {
        phoneWithCountry = `595${rawNumber.slice(1)}`;
      } else if (rawNumber.startsWith('9')) {
        phoneWithCountry = `595${rawNumber}`;
      }
      await Linking.openURL(`https://wa.me/${phoneWithCountry}?text=${message}`);
    } else {
      // Si no tiene número registrado, abrimos el producto en la web oficial
      await openWeb(productPath(product));
    }
  };

  const handleAddToCart = async () => {
    if (!onAddToCart) return;
    // Con talles o colores hay que elegir uno: cada opción va como su propio renglón del carrito.
    if (hasOptions && !variant) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setNeedsOption(product.id);
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onAddToCart(
      variant
        ? { ...product, id: `${product.id}:${variant.id}`, name: whatsappProductLine(product.name, variant), price: basePrice, offerPrice: null, image: images[0] ?? product.image }
        : { ...product, price: basePrice, offerPrice }
    );
    onClose();
  };

  const canBuy = Boolean(onAddToCart && finalPrice && inStock);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          {/* ── Fotos ── */}
          <View style={[styles.gallery, { height: galleryHeight + insets.top, paddingTop: insets.top, backgroundColor: colors.card }]}>
            {images.length > 1 ? (
              <ScrollView
                key={product.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => setPage({ productId: product.id, index: Math.round(event.nativeEvent.contentOffset.x / screenWidth) })}
                accessibilityLabel={`Fotos de ${product.name}`}>
                {images.map((uri, index) => (
                  <Image
                    key={uri}
                    source={uri}
                    style={{ width: screenWidth, height: galleryHeight }}
                    contentFit="contain"
                    transition={200}
                    accessibilityLabel={`Foto ${index + 1} de ${images.length}`}
                  />
                ))}
              </ScrollView>
            ) : images[0] ? (
              <Image source={images[0]} style={{ width: screenWidth, height: galleryHeight }} contentFit="contain" transition={200} />
            ) : (
              <View style={[styles.imageFallback, { height: galleryHeight }]}>
                <Ionicons name="cube-outline" size={60} color={colors.muted} />
                <Text style={[styles.imageFallbackText, { color: colors.muted }]}>Sin fotografía</Text>
              </View>
            )}

            {images.length > 1 ? (
              <View style={styles.galleryDots} pointerEvents="none">
                {images.map((uri, index) => (
                  <View key={uri} style={[styles.galleryDot, { backgroundColor: index === pageIndex ? palette.primary : 'rgba(148,163,184,0.6)' }]} />
                ))}
              </View>
            ) : null}

            {/* Botones sobre la foto */}
            <View style={[styles.floatingBar, { top: insets.top + 8 }]}>
              <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Volver" style={styles.floatingBtn}>
                <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
              </Pressable>
              <View style={styles.floatingRight}>
                <Pressable onPress={handleShare} hitSlop={8} accessibilityRole="button" accessibilityLabel="Compartir" style={styles.floatingBtn}>
                  <Ionicons name="share-outline" size={19} color="#FFFFFF" />
                </Pressable>
                <Pressable
                  onPress={async () => {
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    onToggleFavorite();
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  style={styles.floatingBtn}>
                  <Ionicons name={isFavorite ? 'heart' : 'heart-outline'} size={20} color={isFavorite ? '#EF4444' : '#FFFFFF'} />
                </Pressable>
              </View>
            </View>

            <View style={styles.galleryPills} pointerEvents="none">
              {discount ? (
                <View style={styles.discountFloatingPill}>
                  <Ionicons name="flame" size={13} color="#FFFFFF" />
                  <Text style={styles.floatingPillText}>-{discount}% OFF</Text>
                </View>
              ) : null}
              {product.featured ? (
                <View style={styles.featuredFloatingPill}>
                  <Ionicons name="star" size={12} color="#FFFFFF" />
                  <Text style={styles.floatingPillText}>Destacado</Text>
                </View>
              ) : null}
            </View>
            {images.length > 1 ? (
              <View style={styles.galleryCounter} pointerEvents="none">
                <Text style={styles.galleryCounterText}>{pageIndex + 1}/{images.length}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.body}>
            {/* ── Nombre, marca y categoría ── */}
            <View style={styles.titleBlock}>
              <View
                style={[
                  styles.stockBadge,
                  inStock
                    ? { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.25)' }
                    : { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.25)' },
                ]}>
                <View style={[styles.stockDot, { backgroundColor: inStock ? '#10B981' : '#EF4444' }]} />
                <Text style={[styles.stockText, { color: inStock ? '#10B981' : '#EF4444' }]}>{availabilityLabel(inStock, stockCount)}</Text>
              </View>
              <Text style={[styles.productTitle, { color: colors.text }]}>{product.name}</Text>
              <View style={styles.tagsRow}>
                {product.brand ? (
                  <Pressable
                    onPress={() => {
                      onClose();
                      if (onSelectBrand) onSelectBrand(product.brand!);
                    }}
                    style={[styles.tagPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="pricetag-outline" size={13} color={palette.primary} />
                    <Text style={[styles.tagPillText, { color: colors.text }]}>{product.brand}</Text>
                  </Pressable>
                ) : null}
                {product.category ? (
                  <Pressable
                    onPress={() => {
                      onClose();
                      if (onSelectCategory) onSelectCategory(product.category!.id);
                    }}
                    style={[styles.tagPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="grid-outline" size={13} color={palette.primary} />
                    <Text style={[styles.tagPillText, { color: colors.text }]}>{product.category.name}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* ── Precio ── */}
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {offerPrice ? (
                <>
                  <View style={styles.priceOfferRow}>
                    <Text style={[styles.mainPrice, { color: '#10B981' }]}>{formatGs(offerPrice)}</Text>
                    {basePrice ? <Text style={[styles.strikePrice, { color: colors.muted }]}>{formatGs(basePrice)}</Text> : null}
                  </View>
                  {savings && savings > 0 ? <Text style={styles.savingsText}>Ahorrás {formatGs(savings)} comprando en oferta</Text> : null}
                </>
              ) : basePrice ? (
                <Text style={[styles.mainPrice, { color: colors.text }]}>{formatGs(basePrice)}</Text>
              ) : (
                <Text style={[styles.mainPrice, { color: colors.muted, fontSize: 18 }]}>Consultar precio con la tienda</Text>
              )}
              {detail?.promotionName && offerPrice ? (
                <Text style={[styles.promoText, { color: '#10B981' }]}>Promoción: {detail.promotionName}</Text>
              ) : null}
              {detail?.unit && !['unidad', 'servicio'].includes(detail.unit.toLowerCase()) && basePrice ? (
                <Text style={[styles.detailMuted, { color: colors.muted }]}>Precio por {detail.unit}</Text>
              ) : null}
            </View>

            {loadingDetail ? (
              <View style={styles.detailLoading}>
                <ActivityIndicator size="small" color={palette.primary} />
                <Text style={[styles.detailMuted, { color: colors.muted }]}>Cargando fotos y detalles…</Text>
              </View>
            ) : null}

            {/* ── Opciones (talle, color…) ── */}
            {detail && hasOptions ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: askOption ? '#F59E0B' : colors.border }]}>
                <Text style={[styles.detailTitle, { color: colors.text }]}>Opciones disponibles</Text>
                <View style={styles.variantGrid}>
                  {detail.variants.map((option) => {
                    const active = variant?.id === option.id;
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => {
                          void Haptics.selectionAsync();
                          setSelected(active ? null : { productId: product.id, variantId: option.id });
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={`${option.name}${option.price ? `, ${formatGs(option.price)}` : ''}, ${option.inStock ? 'disponible' : 'sin stock'}`}
                        style={[
                          styles.variantChip,
                          { borderColor: active ? palette.primary : colors.border, backgroundColor: active ? 'rgba(37,99,235,0.10)' : colors.background },
                          !option.inStock && styles.variantChipOff,
                        ]}>
                        <Text style={[styles.variantName, { color: active ? palette.primary : colors.text }]}>{option.name}</Text>
                        <Text style={[styles.detailMuted, { color: colors.muted }]}>
                          {option.inStock ? (option.price ? formatGs(option.price) : 'Disponible') : 'Sin stock'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[styles.detailMuted, { color: askOption ? '#B45309' : colors.muted }]}>
                  {variant
                    ? `Elegiste ${variant.name}.`
                    : askOption
                      ? 'Elegí una opción para agregarlo al carrito.'
                      : 'Elegí una opción para ver su precio y disponibilidad.'}
                </Text>
              </View>
            ) : null}

            {/* ── Descripción ── */}
            {detail?.description ? (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.detailTitle, { color: colors.text }]}>Descripción</Text>
                <Text style={[styles.descriptionText, { color: colors.text }]} numberOfLines={descriptionOpen ? undefined : 5}>
                  {detail.description}
                </Text>
                {detail.description.length > 220 ? (
                  <Pressable onPress={() => setExpanded(descriptionOpen ? null : product.id)} hitSlop={8} accessibilityRole="button">
                    <Text style={[styles.moreText, { color: palette.primary }]}>{descriptionOpen ? 'Ver menos' : 'Ver más'}</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* ── Tienda ── */}
            <Pressable
              onPress={() => {
                onClose();
                if (onSelectStore) onSelectStore(product.store.slug);
              }}
              style={[styles.storeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.storeIconWrap, { backgroundColor: 'rgba(37,99,235,0.12)' }]}>
                {store?.logo ? (
                  <Image source={store.logo} style={styles.storeLogo} contentFit="cover" />
                ) : (
                  <Ionicons name="business" size={18} color={palette.primary} />
                )}
              </View>
              <View style={styles.storeTextCol}>
                <View style={styles.storeTitleLine}>
                  <Text numberOfLines={1} style={[styles.storeName, { color: colors.text }]}>{product.store.name}</Text>
                  <Ionicons name="shield-checkmark" size={14} color={palette.primary} />
                </View>
                <Text style={[styles.storeHint, { color: colors.muted }]}>
                  {store?.city ? `${store.city} · ` : ''}Ver todos sus productos
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>

            {/* ── Más de esta tienda ── */}
            {moreFromStore.length > 0 && onSelectProduct ? (
              <View style={styles.relatedBlock}>
                <Text style={[styles.detailTitle, { color: colors.text }]}>Más de {product.store.name}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedList}>
                  {moreFromStore.map((item) => {
                    const itemPrice = item.offerPrice ?? item.price;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => {
                          void Haptics.selectionAsync();
                          onSelectProduct(item);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Ver ${item.name}`}
                        style={({ pressed }) => [styles.relatedCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}>
                        <View style={[styles.relatedImageWrap, { backgroundColor: colors.background }]}>
                          {item.image ? (
                            <Image source={item.image} style={styles.relatedImage} contentFit="contain" transition={150} />
                          ) : (
                            <Ionicons name="cube-outline" size={26} color={colors.muted} />
                          )}
                        </View>
                        <Text numberOfLines={2} style={[styles.relatedName, { color: colors.text }]}>{item.name}</Text>
                        <Text style={[styles.relatedPrice, { color: item.offerPrice ? '#DC2626' : colors.text }]}>
                          {itemPrice ? formatGs(itemPrice) : 'Consultar'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <Pressable
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                openWeb(productPath(product));
              }}
              style={styles.webLink}>
              <Ionicons name="open-outline" size={16} color={palette.primary} />
              <Text style={[styles.webLinkText, { color: palette.primary }]}>Ver en la tienda web</Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* ── Barra fija de compra ── */}
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={handleWhatsApp}
            accessibilityRole="button"
            accessibilityLabel="Consultar por WhatsApp"
            style={[styles.whatsappBtn, !canBuy && styles.whatsappBtnWide]}>
            <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
            {!canBuy ? <Text style={styles.primaryActionBtnText}>Consultar por WhatsApp</Text> : null}
          </Pressable>
          {canBuy ? (
            <Pressable onPress={handleAddToCart} style={[styles.cartBtn, { backgroundColor: palette.primary }]}>
              <Ionicons name="cart-outline" size={20} color="#FFFFFF" />
              <View>
                <Text style={styles.primaryActionBtnText}>Agregar al carrito</Text>
                <Text style={styles.cartBtnPrice}>{formatGs(finalPrice!)}</Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  gallery: { width: '100%', position: 'relative' },
  imageFallback: { alignItems: 'center', justifyContent: 'center', gap: 6 },
  imageFallbackText: { fontSize: 13, fontWeight: '500' },
  galleryDots: { position: 'absolute', bottom: 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  galleryDot: { width: 7, height: 7, borderRadius: 4 },
  galleryCounter: { position: 'absolute', bottom: 10, right: 14, backgroundColor: 'rgba(2,6,23,0.6)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  galleryCounterText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  floatingBar: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between' },
  floatingRight: { flexDirection: 'row', gap: 10 },
  floatingBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15,23,42,0.55)' },
  galleryPills: { position: 'absolute', bottom: 12, left: 14, gap: 6 },
  discountFloatingPill: { alignSelf: 'flex-start', backgroundColor: '#EF4444', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
  featuredFloatingPill: { alignSelf: 'flex-start', backgroundColor: '#F59E0B', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 4 },
  floatingPillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  body: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  titleBlock: { gap: 8 },
  stockBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  stockDot: { width: 7, height: 7, borderRadius: 3.5 },
  stockText: { fontSize: 12, fontWeight: '700' },
  productTitle: { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1 },
  tagPillText: { fontSize: 13, fontWeight: '600' },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, gap: 8 },
  priceOfferRow: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 10 },
  mainPrice: { fontSize: 26, fontWeight: '900' },
  strikePrice: { fontSize: 16, textDecorationLine: 'line-through', fontWeight: '500' },
  savingsText: { color: '#10B981', fontSize: 12, fontWeight: '700' },
  promoText: { fontSize: 13, fontWeight: '700' },
  detailLoading: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  detailTitle: { fontSize: 16, fontWeight: '800' },
  detailMuted: { fontSize: 12 },
  variantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  variantChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, minWidth: 90, gap: 2 },
  variantChipOff: { opacity: 0.5 },
  variantName: { fontSize: 14, fontWeight: '800' },
  descriptionText: { fontSize: 14, lineHeight: 21 },
  moreText: { fontSize: 13, fontWeight: '800' },
  storeRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, gap: 10 },
  storeIconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  storeLogo: { width: 40, height: 40 },
  storeTextCol: { flex: 1 },
  storeTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  storeName: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  storeHint: { fontSize: 11, marginTop: 2 },
  relatedBlock: { gap: 10 },
  relatedList: { gap: 10, paddingRight: 4 },
  relatedCard: { width: 140, borderRadius: 14, borderWidth: 1, padding: 8, gap: 6 },
  relatedImageWrap: { height: 110, borderRadius: 10, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  relatedImage: { width: '100%', height: '100%' },
  relatedName: { fontSize: 13, fontWeight: '600', minHeight: 34 },
  relatedPrice: { fontSize: 14, fontWeight: '800' },
  webLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  webLinkText: { fontSize: 14, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  whatsappBtn: { width: 56, height: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981' },
  whatsappBtnWide: { flex: 1, width: undefined, flexDirection: 'row', gap: 8 },
  cartBtn: { flex: 1, height: 56, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  primaryActionBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  cartBtnPrice: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
});
