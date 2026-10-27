import { getPrivateCacheContext, isPrivateCacheSnapshotCompatible, isPrivateIdentityTransition, isSameOrganizationIdentity, subscribePrivateCacheContext } from '@/lib/private-cache-context';
import { usePanel } from '@/lib/panel';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import {
  cachedProduct,
  deleteProduct,
  fetchProduct,
  hasActiveOffer,
  isService,
  margin,
  notifyProduct,
  productImages,
  stockState,
  updateProduct,
  VISIBILITY,
  type Product,
} from '@/lib/products';

type Colors = ReturnType<typeof usePalette>;

export default function ProductDetail() {
  const colors = usePalette();
  const { can } = usePanel();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [product, setProduct] = useState<Product | undefined>(() => (id ? cachedProduct(id) : undefined));
  const [error, setError] = useState<string | null>(null);
  const [slide, setSlide] = useState(0);
  const [stockDraft, setStockDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Siempre se pide el producto actualizado (stock de la sucursal, costo según permisos).
  useEffect(() => {
    if (!id) return;
    let active = true;
    const privateScope = getPrivateCacheContext();
    fetchProduct(id)
      .then((fresh) => {
        if (!active || !isPrivateCacheSnapshotCompatible(privateScope)) return;
        setProduct(fresh);
        notifyProduct(fresh, privateScope);
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'No se pudo cargar el producto.'));
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => subscribePrivateCacheContext((next, previous) => {
    if (!isPrivateIdentityTransition(next, previous)) return;
    setProduct(undefined); setError('El contexto cambió. Volvé a abrir el producto.');
  }), []);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/panel/products' as never));

  if (!product) {
    return (
      <View style={styles.center}>
        {error ? (
          <>
            <Ionicons name="search-outline" size={30} color={colors.muted} />
            <Text style={[styles.h2, { color: colors.text }]}>No encontramos el producto</Text>
            <Text style={[styles.small, { color: colors.muted }]}>{error}</Text>
            <Pressable onPress={back} style={[styles.outline, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>Volver</Text>
            </Pressable>
          </>
        ) : (
          <ActivityIndicator color={palette.primary} />
        )}
      </View>
    );
  }

  const images = productImages(product);
  const stock = stockState(product);
  const service = isService(product);
  const profit = margin(product);
  const canSeeCost = product.purchase_price !== undefined && product.purchase_price !== null;
  const visibility = VISIBILITY[product.visibility ?? 'public'];
  const draft = stockDraft === null ? null : Number(stockDraft.replace(/\D/g, '')) || 0;
  const stockChanged = draft !== null && draft !== Number(product.stock_quantity);

  const mutationScope = getPrivateCacheContext();
  const apply = (updated: Product, message: string) => {
    if (!isSameOrganizationIdentity(mutationScope)) return;
    const merged = { ...product, ...updated };
    setProduct(merged);
    notifyProduct(merged, mutationScope);
    setNotice(message);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      Alert.alert('No se pudo completar', err instanceof Error ? err.message : 'Probá de nuevo.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(null);
    }
  };

  const saveStock = () =>
    run('stock', async () => {
      const updated = await updateProduct(product.id, { stock_quantity: draft! });
      setStockDraft(null);
      apply(updated, `Stock actualizado a ${draft}.`);
    });

  const toggleActive = () =>
    run('active', async () => {
      const updated = await updateProduct(product.id, { is_active: !product.is_active });
      apply(updated, product.is_active ? 'Producto desactivado: ya no aparece en ventas ni en la tienda.' : 'Producto activado.');
    });

  const confirmDelete = () =>
    Alert.alert('Eliminar producto', `¿Eliminar «${product.name}»? Si tiene ventas, el sistema lo conserva en el historial.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () =>
          run('delete', async () => {
            await deleteProduct(product.id);
            notifyProduct({ id: product.id, deleted: true }, mutationScope);
            back();
          }),
      },
    ]);

  const share = () =>
    Share.share({
      message: `${product.name}\n${hasActiveOffer(product) ? `Oferta: ${formatGs(product.offer_price!)} (antes ${formatGs(product.sale_price)})` : formatGs(product.sale_price)}${product.sku ? `\nCódigo: ${product.sku}` : ''}`,
    });

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Pressable onPress={back} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Volver">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text numberOfLines={1} style={[styles.topTitle, { color: colors.text }]}>{product.name}</Text>
        <Pressable onPress={share} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Compartir">
          <Ionicons name="share-outline" size={21} color={colors.text} />
        </Pressable>
        <Pressable disabled={!can('products.update')} onPress={() => router.push(`/panel/products/form?id=${product.id}` as never)} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Editar">
          <Ionicons name="create-outline" size={22} color={palette.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Fotos */}
        <View style={[styles.gallery, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {images.length > 0 ? (
            <>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(event) => setSlide(Math.round(event.nativeEvent.contentOffset.x / (width - 32)))}>
                {images.map((uri) => (
                  <Image key={uri} source={uri} style={{ width: width - 32, height: width - 32 }} contentFit="contain" transition={150} />
                ))}
              </ScrollView>
              {images.length > 1 && (
                <View style={styles.dots}>
                  {images.map((uri, index) => (
                    <View key={uri} style={[styles.dot, { backgroundColor: index === slide ? palette.primary : colors.border }]} />
                  ))}
                </View>
              )}
            </>
          ) : (
            <Pressable disabled={!can('products.update')} onPress={() => router.push(`/panel/products/form?id=${product.id}` as never)} style={[styles.noImage, { height: (width - 32) * 0.6 }]}>
              <Ionicons name="camera-outline" size={34} color={colors.muted} />
              <Text style={[styles.small, { color: colors.muted }]}>Sin fotos · tocá para agregar</Text>
            </Pressable>
          )}
        </View>

        {notice && (
          <View style={[styles.notice, { borderColor: '#16A34A55', backgroundColor: '#16A34A12' }]}>
            <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
            <Text style={[styles.noticeText, { color: '#16A34A' }]}>{notice}</Text>
          </View>
        )}

        {/* Nombre y etiquetas */}
        <View style={styles.head}>
          <Text style={[styles.name, { color: colors.text }]}>{product.name}</Text>
          <View style={styles.badges}>
            <Badge label={product.is_active ? 'Activo' : 'Inactivo'} color={product.is_active ? '#16A34A' : '#64748B'} />
            {service && <Badge label="Servicio" color="#0891B2" />}
            {hasActiveOffer(product) && <Badge label="En oferta" color="#DC2626" />}
            <Badge label={visibility.label} color="#7C3AED" />
          </View>
        </View>

        {/* Precios */}
        <Card title="Precios" icon="cash-outline" colors={colors}>
          <View style={styles.priceRow}>
            <View style={styles.flex}>
              <Text style={[styles.small, { color: colors.muted }]}>Precio de venta</Text>
              {hasActiveOffer(product) ? (
                <>
                  <Text style={[styles.oldPrice, { color: colors.muted }]}>{formatGs(product.sale_price)}</Text>
                  <Text style={[styles.bigPrice, { color: '#DC2626' }]}>{formatGs(product.offer_price!)}</Text>
                </>
              ) : (
                <Text style={[styles.bigPrice, { color: colors.text }]}>{formatGs(product.sale_price)}</Text>
              )}
            </View>
            {product.wholesale_price ? (
              <View style={styles.alignEnd}>
                <Text style={[styles.small, { color: colors.muted }]}>Mayorista</Text>
                <Text style={[styles.midPrice, { color: colors.text }]}>{formatGs(product.wholesale_price)}</Text>
              </View>
            ) : null}
          </View>
          {canSeeCost && (
            <View style={[styles.costRow, { borderColor: colors.border }]}>
              <Field label="Costo" value={formatGs(Number(product.purchase_price) || 0)} colors={colors} />
              <Field label="Ganancia por unidad" value={formatGs(Math.max(0, product.sale_price - Number(product.purchase_price)))} colors={colors} />
              {profit !== null && <Field label="Margen" value={`${profit}%`} colors={colors} tone={profit < 15 ? palette.danger : profit < 30 ? '#D97706' : palette.success} />}
            </View>
          )}
        </Card>

        {/* Stock */}
        {!service && (
          <Card title="Stock" icon="cube-outline" colors={colors}>
            {product.variant_stock_summary && product.variant_stock_summary.variant_count > 0 && (
              <View style={[styles.variantStockSummary, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[styles.small, { color: colors.muted }]}>Estado individual de cada variante</Text>
                {product.variants?.filter((variant) => variant.is_active !== false).map((variant) => {
                  const variantStatus = variant.stock_status ?? 'in_stock';
                  const label = variantStatus === 'out_of_stock' ? 'Agotado' : variantStatus === 'low_stock' ? 'Stock bajo' : 'Disponible';
                  const color = variantStatus === 'out_of_stock' ? '#DC2626' : variantStatus === 'low_stock' ? '#D97706' : '#16A34A';
                  return (
                    <View key={variant.id} style={styles.variantStockLine}>
                      <Text numberOfLines={1} style={[styles.small, styles.flex, { color: colors.text }]}>{variant.variant_name ?? variant.name ?? 'Variante'}</Text>
                      <Text style={[styles.small, { color }]}>{label} · {variant.current_stock ?? (Number(variant.stock_quantity) || 0)}</Text>
                    </View>
                  );
                })}
                <Text style={[styles.small, { color: colors.muted }]}>
                  {product.variant_stock_summary.out_of_stock_variant_count} agotada{product.variant_stock_summary.out_of_stock_variant_count === 1 ? '' : 's'} · {product.variant_stock_summary.low_stock_variant_count} con stock bajo
                </Text>
              </View>
            )}
            <View style={styles.stockRow}>
              <View style={[styles.stockBadge, { backgroundColor: `${stock.color}1A` }]}>
                <Text style={[styles.stockValue, { color: stock.color }]}>{Number(product.stock_quantity) || 0}</Text>
                <Text style={[styles.small, { color: stock.color }]}>{stock.tone === 'out' ? 'sin stock' : stock.tone === 'low' ? 'stock bajo' : 'en stock'}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={[styles.small, { color: colors.muted }]}>Ajustar a</Text>
                <View style={[styles.stepper, { borderColor: colors.border, backgroundColor: colors.background }]}>
                  <Pressable disabled={!can('inventory.stock.manage')} onPress={() => setStockDraft(String(Math.max(0, (draft ?? Number(product.stock_quantity)) - 1)))} hitSlop={8} accessibilityLabel="Restar uno">
                    <Ionicons name="remove" size={20} color={colors.text} />
                  </Pressable>
                  <TextInput
                    editable={can('inventory.stock.manage')} value={stockDraft ?? String(Number(product.stock_quantity) || 0)}
                    onChangeText={(value) => setStockDraft(value.replace(/\D/g, ''))}
                    keyboardType="number-pad"
                    accessibilityLabel="Stock"
                    style={[styles.stockInput, { color: colors.text }]}
                  />
                  <Pressable disabled={!can('inventory.stock.manage')} onPress={() => setStockDraft(String((draft ?? Number(product.stock_quantity)) + 1))} hitSlop={8} accessibilityLabel="Sumar uno">
                    <Ionicons name="add" size={20} color={colors.text} />
                  </Pressable>
                </View>
              </View>
            </View>
            {stockChanged && (
              <View style={styles.stockActions}>
                <Pressable disabled={!can('inventory.stock.manage')} onPress={() => setStockDraft(null)} style={[styles.smallBtn, { borderColor: colors.border }]}>
                  <Text style={[styles.smallBtnText, { color: colors.text }]}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={saveStock} disabled={busy === 'stock' || !can('inventory.stock.manage')} style={[styles.smallBtn, { backgroundColor: palette.primary, borderColor: palette.primary }]}>
                  {busy === 'stock' ? <ActivityIndicator color="#fff" size="small" /> : <Text style={[styles.smallBtnText, { color: '#fff' }]}>Guardar stock ({draft! - Number(product.stock_quantity) > 0 ? '+' : ''}{draft! - Number(product.stock_quantity)})</Text>}
                </Pressable>
              </View>
            )}
            <Text style={[styles.small, { color: colors.muted }]}>
              Mínimo: {Number(product.min_stock) || 0}
              {product.max_stock ? ` · Máximo: ${product.max_stock}` : ''} · El ajuste queda registrado como movimiento de stock.
            </Text>
          </Card>
        )}

        {/* Datos */}
        <Card title="Datos" icon="information-circle-outline" colors={colors}>
          <Field label="SKU" value={product.sku} colors={colors} mono />
          {product.barcode ? <Field label="Código de barras" value={product.barcode} colors={colors} mono /> : null}
          <Field label="Categoría" value={product.category?.name ?? 'Sin categoría'} colors={colors} />
          {product.brand ? <Field label="Marca" value={product.brand} colors={colors} /> : null}
          <Field label="Unidad" value={product.unit_measure ?? 'unidad'} colors={colors} />
          <Field label="Visibilidad" value={visibility.help} colors={colors} />
          {product.warranty_months ? <Field label="Garantía" value={`${product.warranty_months} ${product.warranty_months === 1 ? 'mes' : 'meses'}`} colors={colors} /> : null}
        </Card>

        {product.description ? (
          <Card title="Descripción" icon="document-text-outline" colors={colors}>
            <Text style={[styles.body, { color: colors.text }]} selectable>{product.description}</Text>
          </Card>
        ) : null}

        {/* Acciones */}
        <View style={styles.actions}>
          <Pressable disabled={!can('products.update')} onPress={() => router.push(`/panel/products/form?id=${product.id}` as never)} style={[styles.action, styles.primary]}>
            <Ionicons name="create-outline" size={18} color="#fff" />
            <Text style={styles.primaryText}>Editar producto</Text>
          </Pressable>
          <Pressable onPress={toggleActive} disabled={busy === 'active' || !can('products.update')} style={[styles.action, { borderColor: colors.border, backgroundColor: colors.card }]}>
            {busy === 'active' ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Ionicons name={product.is_active ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.text} />
            )}
            <Text style={[styles.actionText, { color: colors.text }]}>{product.is_active ? 'Desactivar' : 'Activar'}</Text>
          </Pressable>
          <Pressable onPress={confirmDelete} disabled={busy === 'delete' || !can('products.delete')} style={[styles.action, { borderColor: '#DC262655', backgroundColor: colors.card }]}>
            {busy === 'delete' ? <ActivityIndicator color={palette.danger} /> : <Ionicons name="trash-outline" size={18} color={palette.danger} />}
            <Text style={[styles.actionText, { color: palette.danger }]}>Eliminar</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Card({ title, icon, colors, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; colors: Colors; children: React.ReactNode }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.cardHead}>
        <Ionicons name={icon} size={16} color={palette.primary} />
        <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Field({ label, value, colors, mono, tone }: { label: string; value: string; colors: Colors; mono?: boolean; tone?: string }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.small, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: tone ?? colors.text }, mono && styles.mono]} selectable>{value}</Text>
    </View>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A` }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  alignEnd: { alignItems: 'flex-end' },
  mono: { fontVariant: ['tabular-nums'], letterSpacing: 0.3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 6 },
  h2: { fontSize: 18, fontWeight: '800' },
  small: { fontSize: 12 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, fontSize: 16, fontWeight: '800' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  gallery: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  noImage: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '700' },
  head: { gap: 8 },
  name: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  bigPrice: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  midPrice: { fontSize: 17, fontWeight: '800' },
  oldPrice: { fontSize: 13, textDecorationLine: 'line-through' },
  costRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 6 },
  field: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  fieldValue: { fontSize: 14, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  variantStockSummary: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 6 },
  variantStockLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stockBadge: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', minWidth: 96 },
  stockValue: { fontSize: 28, fontWeight: '900' },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 48, marginTop: 4 },
  stockInput: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  stockActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end' },
  smallBtn: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, minWidth: 90, justifyContent: 'center' },
  smallBtnText: { fontSize: 13, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 21 },
  actions: { gap: 10, marginTop: 4 },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 14, minHeight: 50 },
  primary: { backgroundColor: palette.primary, borderColor: palette.primary },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  actionText: { fontSize: 15, fontWeight: '700' },
});
