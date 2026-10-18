import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatGs, openWeb, productPath, type MarketProduct, type MarketStore } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';

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
}

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
}: ProductDetailSheetProps) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();

  if (!product) return null;

  const discount =
    product.offerPrice && product.price && product.price > product.offerPrice
      ? Math.round((1 - product.offerPrice / product.price) * 100)
      : null;

  const savings =
    product.offerPrice && product.price && product.price > product.offerPrice
      ? product.price - product.offerPrice
      : null;

  const handleShare = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const url = `https://www.mitiendapy.com${productPath(product)}`;
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
    const priceText = product.offerPrice ? formatGs(product.offerPrice) : product.price ? formatGs(product.price) : '';
    const message = encodeURIComponent(
      `¡Hola! Vi en Mi tiendaPY su producto *${product.name}*${priceText ? ` (${priceText})` : ''} en ${product.store.name}. ¿Tienen disponibilidad?`
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar detalle" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}>
          {/* Indicador de arrastre superior */}
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Barra superior de acciones rápidas */}
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              <View
                style={[
                  styles.stockBadge,
                  product.inStock
                    ? { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'rgba(16,185,129,0.25)' }
                    : { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.25)' },
                ]}>
                <View
                  style={[
                    styles.stockDot,
                    { backgroundColor: product.inStock ? '#10B981' : '#EF4444' },
                  ]}
                />
                <Text
                  style={[
                    styles.stockText,
                    { color: product.inStock ? '#10B981' : '#EF4444' },
                  ]}>
                  {product.inStock ? 'Stock Disponible' : 'Sin Stock'}
                </Text>
              </View>
            </View>

            <View style={styles.topBarActions}>
              <Pressable onPress={handleShare} hitSlop={8} style={[styles.circleBtn, { backgroundColor: colors.background }]}>
                <Ionicons name="share-outline" size={19} color={colors.text} />
              </Pressable>

              <Pressable
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onToggleFavorite();
                }}
                hitSlop={8}
                style={[
                  styles.circleBtn,
                  { backgroundColor: colors.background },
                  isFavorite && { backgroundColor: 'rgba(239,68,68,0.14)' },
                ]}>
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isFavorite ? '#EF4444' : colors.text}
                />
              </Pressable>

              <Pressable onPress={onClose} hitSlop={8} style={[styles.circleBtn, { backgroundColor: colors.background }]}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* ── Imagen Destacada ── */}
            <View style={[styles.imageContainer, { backgroundColor: colors.background }]}>
              {product.image ? (
                <Image source={product.image} style={styles.productImage} contentFit="contain" transition={200} />
              ) : (
                <View style={styles.imageFallback}>
                  <Ionicons name="cube-outline" size={60} color={colors.muted} />
                  <Text style={[styles.imageFallbackText, { color: colors.muted }]}>Sin fotografía</Text>
                </View>
              )}

              {discount ? (
                <View style={styles.discountFloatingPill}>
                  <Ionicons name="flame" size={13} color="#FFFFFF" />
                  <Text style={styles.discountFloatingText}>-{discount}% OFF</Text>
                </View>
              ) : null}

              {product.featured ? (
                <View style={styles.featuredFloatingPill}>
                  <Ionicons name="star" size={12} color="#FFFFFF" />
                  <Text style={styles.featuredFloatingText}>Destacado</Text>
                </View>
              ) : null}
            </View>

            {/* ── Tienda Vendedora ── */}
            <Pressable
              onPress={() => {
                onClose();
                if (onSelectStore) {
                  onSelectStore(product.store.slug);
                }
              }}
              style={[styles.storeRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <View style={[styles.storeIconWrap, { backgroundColor: 'rgba(37,99,235,0.12)' }]}>
                <Ionicons name="business" size={18} color={palette.primary} />
              </View>
              <View style={styles.storeTextCol}>
                <View style={styles.storeTitleLine}>
                  <Text numberOfLines={1} style={[styles.storeName, { color: colors.text }]}>
                    {product.store.name}
                  </Text>
                  <Ionicons name="shield-checkmark" size={14} color={palette.primary} />
                </View>
                <Text style={[styles.storeHint, { color: colors.muted }]}>
                  {store?.city ? `${store.city} · ` : ''}Tocar para ver sus productos
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>

            {/* ── Título del Producto ── */}
            <Text style={[styles.productTitle, { color: colors.text }]}>{product.name}</Text>

            {/* ── Chips de Marca y Categoría ── */}
            <View style={styles.tagsRow}>
              {product.brand ? (
                <Pressable
                  onPress={() => {
                    onClose();
                    if (onSelectBrand) onSelectBrand(product.brand!);
                  }}
                  style={[styles.tagPill, { backgroundColor: colors.background, borderColor: colors.border }]}>
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
                  style={[styles.tagPill, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Ionicons name="grid-outline" size={13} color={palette.primary} />
                  <Text style={[styles.tagPillText, { color: colors.text }]}>{product.category.name}</Text>
                </Pressable>
              ) : null}
            </View>

            {/* ── Precio y Ahorro ── */}
            <View style={[styles.priceBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
              {product.offerPrice ? (
                <>
                  <View style={styles.priceOfferRow}>
                    <Text style={[styles.mainPrice, { color: '#10B981' }]}>
                      {formatGs(product.offerPrice)}
                    </Text>
                    {product.price && (
                      <Text style={[styles.strikePrice, { color: colors.muted }]}>
                        {formatGs(product.price)}
                      </Text>
                    )}
                  </View>
                  {savings && savings > 0 ? (
                    <Text style={styles.savingsText}>
                      Ahorrás {formatGs(savings)} comprando en oferta
                    </Text>
                  ) : null}
                </>
              ) : product.price ? (
                <Text style={[styles.mainPrice, { color: colors.text }]}>
                  {formatGs(product.price)}
                </Text>
              ) : (
                <Text style={[styles.mainPrice, { color: colors.muted, fontSize: 18 }]}>
                  Consultar precio con la tienda
                </Text>
              )}
            </View>
          </ScrollView>

          {/* ── Botones de Acción Fijos Inferiores ── */}
          <View style={[styles.footerActions, { borderTopColor: colors.border }]}>
            {onAddToCart && (product.price || product.offerPrice) ? (
              <Pressable
                onPress={async () => {
                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onAddToCart(product);
                  onClose();
                }}
                style={[styles.primaryActionBtn, { backgroundColor: palette.primary }]}>
                <Ionicons name="cart-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryActionBtnText}>Agregar al Carrito</Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={handleWhatsApp}
              style={[styles.primaryActionBtn, { backgroundColor: '#10B981' }]}>
              <Ionicons name="logo-whatsapp" size={20} color="#FFFFFF" />
              <Text style={styles.primaryActionBtnText}>Consultar por WhatsApp</Text>
            </Pressable>

            <Pressable
              onPress={async () => {
                await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                openWeb(productPath(product));
              }}
              style={[styles.secondaryActionBtn, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="open-outline" size={18} color={palette.primary} />
              <Text style={[styles.secondaryActionBtnText, { color: palette.primary }]}>Ver en Tienda Web</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  topBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  stockDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '700',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingHorizontal: 18,
    paddingBottom: 16,
    gap: 14,
  },
  imageContainer: {
    width: '100%',
    height: 250,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  imageFallbackText: {
    fontSize: 13,
    fontWeight: '500',
  },
  discountFloatingPill: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#EF4444',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  discountFloatingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  featuredFloatingPill: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featuredFloatingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  storeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeTextCol: {
    flex: 1,
  },
  storeTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  storeName: {
    fontSize: 14,
    fontWeight: '700',
  },
  storeHint: {
    fontSize: 11,
    marginTop: 2,
  },
  productTitle: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  tagPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  priceBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  priceOfferRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  mainPrice: {
    fontSize: 24,
    fontWeight: '900',
  },
  strikePrice: {
    fontSize: 16,
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  savingsText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  footerActions: {
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  secondaryActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
