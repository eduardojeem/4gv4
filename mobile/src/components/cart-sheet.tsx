import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatGs, openWeb, storePath } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';

export interface CartItem {
  id: string;
  name: string;
  price: number;
  image: string | null;
  store: { name: string; slug: string; whatsapp?: string | null };
  quantity: number;
}

interface CartSheetProps {
  visible: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
}

export function CartSheet({
  visible,
  onClose,
  items,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
}: CartSheetProps) {
  const colors = usePalette();
  const insets = useSafeAreaInsets();

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Agrupar productos por comercio para checkout individual por WhatsApp
  const storesMap = new Map<string, { store: CartItem['store']; items: CartItem[] }>();
  for (const item of items) {
    const existing = storesMap.get(item.store.slug) ?? { store: item.store, items: [] };
    existing.items.push(item);
    storesMap.set(item.store.slug, existing);
  }
  const storeGroups = Array.from(storesMap.values());

  const handleSendOrder = async (group: { store: CartItem['store']; items: CartItem[] }) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const subtotal = group.items.reduce((s, it) => s + it.price * it.quantity, 0);
    const itemLines = group.items.map(
      (it) => `• ${it.quantity}x ${it.name} (${formatGs(it.price * it.quantity)})`
    );

    const message = encodeURIComponent(
      `¡Hola ${group.store.name}! Quiero realizar el siguiente pedido desde Mi tiendaPY.com:\n\n` +
      itemLines.join('\n') +
      `\n\n*Total estimado: ${formatGs(subtotal)}*\n\n¿Tienen disponibilidad para coordinar el pago y entrega?`
    );

    const rawNumber = group.store.whatsapp ? group.store.whatsapp.replace(/\D/g, '') : null;
    if (rawNumber && rawNumber.length >= 8) {
      let phoneWithCountry = rawNumber;
      if (rawNumber.startsWith('09')) {
        phoneWithCountry = `595${rawNumber.slice(1)}`;
      } else if (rawNumber.startsWith('9')) {
        phoneWithCountry = `595${rawNumber}`;
      }
      await Linking.openURL(`https://wa.me/${phoneWithCountry}?text=${message}`);
    } else {
      await openWeb(storePath(group.store));
    }
  };

  const handleConfirmClear = () => {
    Alert.alert('Vaciar Carrito', '¿Estás seguro de que deseás eliminar todos los artículos?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Vaciar',
        style: 'destructive',
        onPress: async () => {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          onClearCart();
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Cerrar carrito" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: Math.max(insets.bottom, 16) + 10,
            },
          ]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Encabezado */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <View style={[styles.cartIconBadge, { backgroundColor: 'rgba(37,99,235,0.12)' }]}>
                <Ionicons name="cart" size={20} color={palette.primary} />
              </View>
              <View>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Mi Carrito</Text>
                <Text style={[styles.headerSubtitle, { color: colors.muted }]}>
                  {totalCount} artículo{totalCount !== 1 ? 's' : ''} en {storeGroups.length} tienda{storeGroups.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              {items.length > 0 && (
                <Pressable onPress={handleConfirmClear} hitSlop={8} style={styles.clearBtn}>
                  <Ionicons name="trash-outline" size={17} color={colors.muted} />
                  <Text style={[styles.clearBtnText, { color: colors.muted }]}>Vaciar</Text>
                </Pressable>
              )}
              <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
          </View>

          {/* Contenido desplazable */}
          {items.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.background }]}>
                <Ionicons name="cart-outline" size={48} color={colors.muted} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Tu carrito está vacío</Text>
              <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                Explorá los productos del marketplace y sumá artículos para realizar tu pedido.
              </Text>
              <Pressable
                onPress={onClose}
                style={[styles.continueShoppingBtn, { backgroundColor: palette.primary }]}>
                <Ionicons name="bag-handle-outline" size={16} color="#FFFFFF" />
                <Text style={styles.continueShoppingText}>Explorar Productos</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
                {storeGroups.map((group) => {
                  const groupSubtotal = group.items.reduce((s, it) => s + it.price * it.quantity, 0);
                  return (
                    <View
                      key={group.store.slug}
                      style={[styles.storeBlock, { backgroundColor: colors.background, borderColor: colors.border }]}>
                      {/* Cabecera del comercio */}
                      <View style={styles.storeBlockHeader}>
                        <View style={styles.storeNameLine}>
                          <Ionicons name="storefront" size={15} color={palette.primary} />
                          <Text numberOfLines={1} style={[styles.storeBlockName, { color: colors.text }]}>
                            {group.store.name}
                          </Text>
                        </View>
                        <Text style={[styles.storeBlockSubtotal, { color: palette.primary }]}>
                          {formatGs(groupSubtotal)}
                        </Text>
                      </View>

                      {/* Lista de productos de este comercio */}
                      <View style={styles.itemsList}>
                        {group.items.map((item) => (
                          <View
                            key={item.id}
                            style={[styles.itemRow, { borderBottomColor: colors.border }]}>
                            {/* Imagen */}
                            <View style={[styles.itemImgWrap, { backgroundColor: colors.card }]}>
                              {item.image ? (
                                <Image source={item.image} style={styles.itemImg} contentFit="contain" />
                              ) : (
                                <Ionicons name="cube-outline" size={24} color={colors.muted} />
                              )}
                            </View>

                            {/* Info */}
                            <View style={styles.itemInfo}>
                              <Text numberOfLines={2} style={[styles.itemName, { color: colors.text }]}>
                                {item.name}
                              </Text>
                              <Text style={[styles.itemPrice, { color: colors.muted }]}>
                                {formatGs(item.price)} c/u
                              </Text>
                            </View>

                            {/* Controles de cantidad */}
                            <View style={styles.itemQuantityControls}>
                              <Pressable
                                onPress={async () => {
                                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  onUpdateQuantity(item.id, -1);
                                }}
                                hitSlop={6}
                                style={[styles.qtyBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Ionicons name="remove" size={14} color={colors.text} />
                              </Pressable>

                              <Text style={[styles.qtyText, { color: colors.text }]}>
                                {item.quantity}
                              </Text>

                              <Pressable
                                onPress={async () => {
                                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  onUpdateQuantity(item.id, 1);
                                }}
                                hitSlop={6}
                                style={[styles.qtyBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                <Ionicons name="add" size={14} color={colors.text} />
                              </Pressable>

                              <Pressable
                                onPress={async () => {
                                  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                  onRemoveItem(item.id);
                                }}
                                hitSlop={8}
                                style={styles.trashBtn}>
                                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                              </Pressable>
                            </View>
                          </View>
                        ))}
                      </View>

                      {/* Botón para enviar pedido por WhatsApp al comercio */}
                      <Pressable
                        onPress={() => handleSendOrder(group)}
                        style={[styles.sendStoreOrderBtn, { backgroundColor: '#10B981' }]}>
                        <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                        <Text style={styles.sendStoreOrderText}>
                          Pedir a {group.store.name} ({formatGs(groupSubtotal)})
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Pie de carrito con total global */}
              <View style={[styles.footerBar, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
                <View style={styles.footerTotalRow}>
                  <View>
                    <Text style={[styles.footerTotalLabel, { color: colors.muted }]}>Total General</Text>
                    <Text style={[styles.footerItemCount, { color: colors.muted }]}>
                      {totalCount} producto{totalCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.footerTotalValue, { color: colors.text }]}>
                    {formatGs(total)}
                  </Text>
                </View>
              </View>
            </>
          )}
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
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  cartIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  clearBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 28,
    gap: 12,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  continueShoppingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
    marginTop: 8,
  },
  continueShoppingText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 14,
  },
  storeBlock: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  storeBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(148,163,184,0.2)',
  },
  storeNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  storeBlockName: {
    fontSize: 14,
    fontWeight: '800',
  },
  storeBlockSubtotal: {
    fontSize: 14,
    fontWeight: '800',
  },
  itemsList: {
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemImgWrap: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  itemImg: {
    width: '100%',
    height: '100%',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  itemPrice: {
    fontSize: 12,
    marginTop: 2,
  },
  itemQuantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '800',
    minWidth: 18,
    textAlign: 'center',
  },
  trashBtn: {
    padding: 4,
    marginLeft: 4,
  },
  sendStoreOrderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  sendStoreOrderText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  footerBar: {
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerTotalLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerItemCount: {
    fontSize: 11,
    marginTop: 1,
  },
  footerTotalValue: {
    fontSize: 22,
    fontWeight: '900',
  },
});
