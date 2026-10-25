import { loadPosPrivateCatalog } from '@/lib/pos-private-catalog';
import { getPrivateCacheContext, isPrivateCacheContextCurrent, setPrivateCacheBranch, subscribePrivateCacheContext } from '@/lib/private-cache-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { BottomSheet } from '@/components/bottom-sheet';
import { PosCheckout } from '@/components/pos-checkout';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import {
  cartTotals,
  fetchPosSession,
  isWholesaleCustomer,
  lineTotal,
  newSaleKey,
  openCashRegister,
  processSale,
  unitPrice,
  type CartLine,
  type PaymentInput,
  type PosCustomer,
  type PosSession,
  type PriceMode,
} from '@/lib/pos';
import { fetchCategories, fetchProducts, productImages, type Category, type Product } from '@/lib/products';
import { DEFAULT_POS_SHELF, emptyShelfMessage, isPosService, sameShelf, type PosShelf } from '@/lib/pos-catalog';
import { fetchPosCatalog } from '@/lib/pos-catalog-api';
import { frequentProducts, recordSold } from '@/lib/pos-frequent';
import { CashSheet, SalesSheet } from '@/components/pos-cash';
import { PosCustomerSheet } from '@/components/pos-customer';
import { PosSaleDone } from '@/components/pos-sale-done';
import { buildCreditPlan, persistedPlan, type CreditTerms } from '@/lib/pos-credit';
import type { SaleReceipt } from '@/lib/pos-receipt';
import { secureStorage } from '@/lib/secure-storage';

type Colors = ReturnType<typeof usePalette>;

const digits = (value: string) => Number(value.replace(/\D/g, '')) || 0;
const pretty = (value: string | number) => {
  const only = String(value).replace(/\D/g, '');
  return only ? Number(only).toLocaleString('es-PY') : '';
};

const AUTO_PRINT_KEY = 'pos.receipt.auto';

/**
 * POS en la app, con las mismas reglas que /dashboard/pos: caja abierta,
 * stock de la sucursal, precio minorista o mayorista, descuentos, cliente,
 * cobro (efectivo con vuelto, tarjeta, transferencia o mixto) y comprobante.
 */
export default function PosScreen() {
  const colors = usePalette();
  const { data: panel, findItem, loading: panelLoading } = usePanel();
  const [session, setSession] = useState<PosSession | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [sessionAttempt, setSessionAttempt] = useState(0);

  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  // Qué pedido trajo la lista que se ve: mientras no coincide con el actual, está cargando.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  // Qué estante se ve: productos (por defecto), servicios, los más vendidos desde este teléfono o una categoría.
  const [shelf, setShelf] = useState<PosShelf>(DEFAULT_POS_SHELF);
  const [frequent, setFrequent] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cashOpen, setCashOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [priceMode, setPriceMode] = useState<PriceMode>('retail');
  const [orderDiscount, setOrderDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  const [cartOpen, setCartOpen] = useState(false);
  // Desde dónde se abrió el buscador de clientes: al volver se reabre el cobro.
  const [customerOpen, setCustomerOpen] = useState<'bar' | 'checkout' | null>(null);
  const [autoPrint, setAutoPrint] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [saleKey, setSaleKey] = useState(newSaleKey);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [done, setDone] = useState<SaleReceipt | null>(null);

  useEffect(() => {
    let active = true;
    fetchPosSession()
      .then((data) => {
        if (!active) return;
        setPrivateCacheBranch(data.branch.id);
        setSession(data);
        setSessionError(null);
      })
      .catch((err) => active && setSessionError(err instanceof Error ? err.message : 'No se pudo leer la caja.'))
      .finally(() => active && setLoadingSession(false));
    return () => {
      active = false;
    };
  }, [sessionAttempt]);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    secureStorage
      .getItem(AUTO_PRINT_KEY)
      .then((value) => setAutoPrint(value === '1'))
      .catch(() => undefined);
  }, []);

  useEffect(() => loadPosPrivateCatalog(session?.branch.id, {
    loadFrequent: frequentProducts,
    loadCategories: fetchCategories,
    onFrequent: setFrequent,
    onCategories: rows => setCategories(rows.filter(row => !row.parent_id && (row.products_count ?? 0) > 0).sort((a, b) => (b.products_count ?? 0) - (a.products_count ?? 0))),
  }), [session?.branch.id]);

  // Un texto estable por estante: el objeto de categoría cambia en cada render.
  const shelfKey = typeof shelf === 'string' ? shelf : `category:${shelf.categoryId}`;
  const requestKey = `${shelfKey}|${search}|${session?.branch.id ?? ''}`;
  const loadingProducts = loadedKey !== requestKey;

  useEffect(() => {
    let active = true;
    fetchPosCatalog(shelf, search)
      .then((list) => active && setProducts(list))
      .catch(() => active && setProducts([]))
      .finally(() => active && setLoadedKey(requestKey));
    return () => {
      active = false;
    };
    // requestKey resume shelf, búsqueda y sucursal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  useEffect(() => subscribePrivateCacheContext(() => {
    setFrequent([]); setCategories([]); setShelf(DEFAULT_POS_SHELF); setProducts([]); setCart([]); setCustomer(null); setDone(null); setCheckoutOpen(false); setSession(null);
  }), []);

  // Los frecuentes con el stock y precio que acaba de traer el servidor, si están en la página.
  const fresh = new Map(products.map((product) => [product.id, product]));
  // Al cambiar de estante no queda a la vista la lista anterior: se ve «cargando».
  const shown = !search && shelf === 'frequent' ? frequent.map((product) => fresh.get(product.id) ?? product) : loadingProducts ? [] : products;

  const flash = useCallback((text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 1800);
  }, []);

  const quantityOf = (id: string) => cart.find((line) => line.product.id === id)?.quantity ?? 0;

  const add = (product: Product, amount = 1) => {
    const inCart = quantityOf(product.id);
    if (!isPosService(product) && inCart + amount > Number(product.stock_quantity)) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      flash(Number(product.stock_quantity) <= 0 ? `«${product.name}» no tiene stock.` : `Solo hay ${product.stock_quantity} de «${product.name}».`);
      return;
    }
    void Haptics.selectionAsync();
    setCart((list) =>
      list.some((line) => line.product.id === product.id)
        ? list.map((line) => (line.product.id === product.id ? { ...line, quantity: line.quantity + amount } : line))
        : [...list, { product, quantity: amount, discount: 0 }]
    );
  };

  const setQuantity = (id: string, quantity: number) =>
    setCart((list) => (quantity <= 0 ? list.filter((line) => line.product.id !== id) : list.map((line) => (line.product.id === id ? { ...line, quantity } : line))));

  const onScanned = async (code: string) => {
    setScanning(false);
    const local = products.find((product) => product.barcode === code || product.sku === code);
    if (local) return add(local);
    try {
      const page = await fetchProducts({ query: code, page: 1 });
      const found = page.products.find((product) => product.barcode === code || product.sku === code);
      if (found) add(found);
      else flash(`No hay producto con el código ${code}.`);
    } catch {
      flash('No se pudo buscar el código.');
    }
  };

  const toggleAutoPrint = (value: boolean) => {
    setAutoPrint(value);
    void secureStorage.setItem(AUTO_PRINT_KEY, value ? '1' : '0').catch(() => undefined);
  };

  const openCheckout = () => {
    setPayError(null);
    setCheckoutOpen(true);
  };

  // Desde el cobro: se cierra un momento (no se apilan dos hojas) y vuelve solo.
  const customerFromCheckout = () => {
    setCheckoutOpen(false);
    setCustomerOpen('checkout');
  };

  const closeCustomer = () => {
    if (customerOpen === 'checkout') setCheckoutOpen(true);
    setCustomerOpen(null);
  };

  const pickCustomer = (next: PosCustomer | null) => {
    setCustomer(next);
    closeCustomer();
    // Un cliente mayorista vende a precio mayorista, como en la web.
    if (isWholesaleCustomer(next)) setPriceMode('wholesale');
    else if (!next) setPriceMode('retail');
  };

  const totals = session ? cartTotals(cart, priceMode, orderDiscount, session.pricing) : null;

  const pay = async (payments: PaymentInput[], change: number, credit: CreditTerms | null) => {
    if (!session || !totals) return;
    const privateScope = getPrivateCacheContext();
    setPaying(true);
    setPayError(null);
    try {
      const result = await processSale({
        session,
        lines: cart,
        priceMode,
        orderDiscountRate: orderDiscount,
        customerId: customer?.id ?? null,
        payments,
        notes,
        idempotencyKey: saleKey,
        credit,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void recordSold(cart, privateScope).then(() => frequentProducts(privateScope).then(list => { if (isPrivateCacheContextCurrent(privateScope)) setFrequent(list); }));
      setDone({
        business: session.business?.name ? session.business : { name: panel?.organization.name ?? 'Mi Tienda', ruc: '', phone: '', address: '', email: '' },
        saleId: result.id,
        date: new Date(),
        branchName: session.branch.name,
        registerName: session.session?.registerName,
        customer: customer ? { name: customer.name, ruc: customer.ruc, phone: customer.phone } : null,
        lines: cart,
        priceMode,
        totals: { ...totals, total: result.total ?? totals.total },
        pricing: session.pricing,
        payments,
        change,
        points: result.loyaltyPoints ?? 0,
        notes,
        // El calendario que guardó el servidor; si no vino, el que se mostró al cobrar.
        credit: credit
          ? {
              terms: credit,
              plan: persistedPlan(result.creditSchedule, buildCreditPlan(payments.find((payment) => payment.method === 'credit')?.amount ?? 0, credit)),
            }
          : null,
      });
      setCheckoutOpen(false);
      setCartOpen(false);
    } catch (err) {
      setPayError(err instanceof Error ? err.message : 'No se pudo cobrar.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPaying(false);
    }
  };

  const newSale = () => {
    setCart([]);
    setCustomer(null);
    setPriceMode('retail');
    setOrderDiscount(0);
    setNotes('');
    setDone(null);
    setPayError(null);
    setSaleKey(newSaleKey());
    setSessionAttempt((n) => n + 1);
  };

  if (!panelLoading && !findItem('pos')) {
    return (
      <View style={styles.center}>
        <Ionicons name="lock-closed-outline" size={32} color={colors.muted} />
        <Text style={[styles.h1, { color: colors.text }]}>Punto de venta no disponible</Text>
        <Text style={[styles.muted, { color: colors.muted }]}>Tu usuario o tu plan no incluyen el POS.</Text>
      </View>
    );
  }

  if (loadingSession) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.primary} />
      </View>
    );
  }

  if (sessionError || !session) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={32} color={colors.muted} />
        <Text style={[styles.muted, { color: colors.muted }]}>{sessionError ?? 'No se pudo leer la caja.'}</Text>
        <Pressable onPress={() => setSessionAttempt((n) => n + 1)} style={[styles.outline, { borderColor: colors.border }]}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Reintentar</Text>
        </Pressable>
      </View>
    );
  }

  if (!session.session) {
    return <OpenRegister session={session} colors={colors} onOpened={() => setSessionAttempt((n) => n + 1)} />;
  }

  if (done) {
    return <PosSaleDone receipt={done} autoPrint={autoPrint} onNewSale={newSale} />;
  }

  return (
    <View style={styles.flex}>
      {/* Turno de caja: cuánto se vendió y accesos rápidos */}
      {!query && (
        <View style={styles.hero}>
          <Pressable onPress={() => setCashOpen(true)} accessibilityRole="button" accessibilityLabel="Caja: resumen, movimientos y cierre" style={styles.heroMain}>
            <View style={styles.heroTop}>
              <View style={styles.dot} />
              <Text numberOfLines={1} style={styles.heroRegister}>
                {session.session.registerName} · {session.branch.name}
              </Text>
              <Ionicons name="chevron-down" size={13} color="rgba(255,255,255,0.85)" />
            </View>
            <Text style={styles.heroTotal}>{formatGs(session.summary?.salesTotal ?? 0)}</Text>
            <Text style={styles.heroSub}>
              {session.summary?.salesCount ?? 0} {session.summary?.salesCount === 1 ? 'venta' : 'ventas'} en este turno · caja {formatGs(session.summary?.expectedCash ?? session.session.openingBalance)}
            </Text>
          </Pressable>
          <View style={styles.quick}>
            <Quick icon="receipt-outline" label="Ventas" onPress={() => setSalesOpen(true)} />
            <Quick icon="wallet-outline" label="Caja" onPress={() => setCashOpen(true)} />
            {findItem('orders') ? <Quick icon="bag-handle-outline" label="Pedidos" onPress={() => router.push('/panel/orders' as never)} /> : null}
          </View>
        </View>
      )}

      {/* Cliente y lista de precios */}
      <View style={styles.bar}>
        <Pressable onPress={() => setCustomerOpen('bar')} style={[styles.customerBtn, { borderColor: customer ? palette.primary : colors.border, backgroundColor: customer ? 'rgba(37,99,235,0.06)' : colors.card }]}>
          <Ionicons name={customer ? 'person' : 'person-add-outline'} size={16} color={customer ? palette.primary : colors.muted} />
          <Text numberOfLines={1} style={[styles.customerText, { color: customer ? colors.text : colors.muted }]}>{customer?.name ?? 'Agregar cliente'}</Text>
          {customer ? (
            <Pressable onPress={() => pickCustomer(null)} hitSlop={10} accessibilityLabel="Quitar cliente">
              <Ionicons name="close-circle" size={16} color={colors.muted} />
            </Pressable>
          ) : null}
        </Pressable>
        <View style={[styles.segment, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {(['retail', 'wholesale'] as const).map((mode) => {
            const selected = priceMode === mode;
            const tone = mode === 'wholesale' ? '#7C3AED' : palette.primary;
            return (
              <Pressable key={mode} onPress={() => setPriceMode(mode)} accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.segmentItem, selected && { backgroundColor: tone }]}>
                <Text style={[styles.modeText, { color: selected ? '#fff' : colors.muted }]}>{mode === 'retail' ? 'Minorista' : 'Mayorista'}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Buscar / escanear */}
      <View style={styles.searchRow}>
        <View style={[styles.search, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={17} color={colors.muted} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Buscar producto, SKU o código" placeholderTextColor={colors.muted} autoCorrect={false} style={[styles.searchInput, { color: colors.text }]} />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <Pressable onPress={() => setScanning(true)} style={[styles.scanBtn, { backgroundColor: palette.primary }]} accessibilityLabel="Escanear producto">
          <Ionicons name="scan-outline" size={22} color="#fff" />
        </Pressable>
      </View>

      {/* Estantes */}
      {!search && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shelves} style={styles.shelvesWrap}>
          <Shelf label="Productos" icon="cube-outline" selected={shelf === 'products'} onPress={() => setShelf('products')} colors={colors} />
          <Shelf label="Servicios" icon="construct-outline" selected={shelf === 'services'} onPress={() => setShelf('services')} colors={colors} />
          {frequent.length > 0 && (
            <Shelf label="Más vendidos" icon="flame-outline" selected={shelf === 'frequent'} onPress={() => setShelf('frequent')} colors={colors} />
          )}
          {categories.map((category) => (
            <Shelf
              key={category.id}
              label={category.name}
              selected={sameShelf(shelf, { categoryId: category.id })}
              onPress={() => setShelf({ categoryId: category.id })}
              colors={colors}
            />
          ))}
        </ScrollView>
      )}

      {/* Catálogo */}
      <FlatList
        data={shown}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={[styles.grid, cart.length > 0 && { paddingBottom: 110 }]}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loadingProducts ? (
            <ActivityIndicator style={styles.loading} color={palette.primary} />
          ) : (
            <Text style={[styles.muted, styles.loading, { color: colors.muted }]}>{emptyShelfMessage(shelf, search)}</Text>
          )
        }
        renderItem={({ item }) => <ProductTile product={item} mode={priceMode} inCart={quantityOf(item.id)} colors={colors} onPress={() => add(item)} />}
      />

      {toast && (
        <View style={[styles.toast, { backgroundColor: colors.text }]}>
          <Text style={[styles.toastText, { color: colors.background }]}>{toast}</Text>
        </View>
      )}

      {/* Resumen del carrito */}
      {cart.length > 0 && totals && (
        <Pressable onPress={() => setCartOpen(true)} style={[styles.cartBar, { backgroundColor: palette.primary }]}>
          <View style={styles.cartCount}>
            <Text style={styles.cartCountText}>{totals.items}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.cartLabel}>Ver carrito</Text>
            <Text style={styles.cartTotal}>{formatGs(totals.total)}</Text>
          </View>
          <Pressable onPress={openCheckout} style={styles.payBtn}>
            <Text style={styles.payText}>Cobrar</Text>
            <Ionicons name="arrow-forward" size={18} color={palette.primary} />
          </Pressable>
        </Pressable>
      )}

      {/* Carrito */}
      <BottomSheet
        visible={cartOpen}
        title={`Carrito (${totals?.items ?? 0})`}
        onClose={() => setCartOpen(false)}
        footer={
          totals ? (
            <View style={styles.cartFooter}>
              <Row label="Subtotal" value={formatGs(totals.subtotal)} colors={colors} />
              {totals.discount > 0 && <Row label="Descuentos" value={`− ${formatGs(totals.discount)}`} colors={colors} tone={palette.danger} />}
              {!session.pricing.pricesIncludeTax && totals.tax > 0 && <Row label={`IVA ${session.pricing.taxRate}%`} value={formatGs(totals.tax)} colors={colors} />}
              <Row label="Total" value={formatGs(totals.total)} colors={colors} big />
              <Pressable
                onPress={openCheckout}
                disabled={cart.length === 0 || totals.total <= 0}
                style={[styles.checkoutBtn, { opacity: cart.length === 0 ? 0.5 : 1 }]}>
                <Text style={styles.checkoutText}>Cobrar {formatGs(totals.total)}</Text>
              </Pressable>
            </View>
          ) : null
        }>
        {cart.map((line) => (
          <CartRow
            key={line.product.id}
            line={line}
            mode={priceMode}
            colors={colors}
            onQuantity={(quantity) => {
              if (!isPosService(line.product) && quantity > Number(line.product.stock_quantity)) return flash(`Solo hay ${line.product.stock_quantity}.`);
              setQuantity(line.product.id, quantity);
            }}
            onDiscount={(discount) => setCart((list) => list.map((item) => (item.product.id === line.product.id ? { ...item, discount } : item)))}
          />
        ))}
        {cart.length === 0 && <Text style={[styles.muted, { color: colors.muted }]}>El carrito está vacío.</Text>}
        <Text style={[styles.label, { color: colors.text }]}>Descuento general</Text>
        <View style={styles.discounts}>
          {[0, 5, 10, 15, 20].map((rate) => (
            <Pressable key={rate} onPress={() => setOrderDiscount(rate)} style={[styles.discountChip, { borderColor: orderDiscount === rate ? palette.primary : colors.border, backgroundColor: orderDiscount === rate ? 'rgba(37,99,235,0.1)' : colors.background }]}>
              <Text style={[styles.discountText, { color: orderDiscount === rate ? palette.primary : colors.text }]}>{rate === 0 ? 'Sin descuento' : `${rate}%`}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Nota de la venta (opcional)" placeholderTextColor={colors.muted} maxLength={2000} style={[styles.notes, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]} />
        {cart.length > 0 && (
          <Pressable onPress={() => setCart([])} style={styles.clear}>
            <Ionicons name="trash-outline" size={16} color={palette.danger} />
            <Text style={[styles.small, { color: palette.danger, fontWeight: '700' }]}>Vaciar carrito</Text>
          </Pressable>
        )}
      </BottomSheet>

      {totals && (
        <PosCheckout
          visible={checkoutOpen}
          total={totals.total}
          saving={paying}
          error={payError}
          customer={customer}
          creditEnabled={Boolean(findItem('credits'))}
          autoPrint={autoPrint}
          onAutoPrint={toggleAutoPrint}
          onCustomer={customerFromCheckout}
          onClearCustomer={() => pickCustomer(null)}
          onClose={() => setCheckoutOpen(false)}
          onConfirm={pay}
        />
      )}

      {customerOpen && <PosCustomerSheet selected={customer} onClose={closeCustomer} onPick={pickCustomer} />}
      {cashOpen && (
        <CashSheet
          session={session}
          onClose={() => setCashOpen(false)}
          onChanged={() => setSessionAttempt((n) => n + 1)}
          onClosed={() => {
            setCashOpen(false);
            setCart([]);
            setSessionAttempt((n) => n + 1);
          }}
        />
      )}
      {salesOpen && <SalesSheet onClose={() => setSalesOpen(false)} />}

      <BarcodeScanner visible={scanning} onClose={() => setScanning(false)} onScanned={onScanned} title="Escaneá el producto" />
    </View>
  );
}

function Quick({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.quickBtn, { opacity: pressed ? 0.75 : 1 }]}>
      <Ionicons name={icon} size={19} color="#fff" />
      <Text style={styles.quickText}>{label}</Text>
    </Pressable>
  );
}

function Shelf({ label, icon, selected, onPress, colors }: { label: string; icon?: keyof typeof Ionicons.glyphMap; selected: boolean; onPress: () => void; colors: Colors }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected }} style={[styles.shelf, { borderColor: selected ? palette.primary : colors.border, backgroundColor: selected ? palette.primary : colors.card }]}>
      {icon ? <Ionicons name={icon} size={14} color={selected ? '#fff' : colors.muted} /> : null}
      <Text numberOfLines={1} style={[styles.shelfText, { color: selected ? '#fff' : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function ProductTile({ product, mode, inCart, colors, onPress }: { product: Product; mode: PriceMode; inCart: number; colors: Colors; onPress: () => void }) {
  const image = productImages(product)[0];
  const service = isPosService(product);
  const stock = Number(product.stock_quantity) || 0;
  const out = !service && stock <= 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Agregar ${product.name}, ${formatGs(unitPrice(product, mode))}`}
      style={({ pressed }) => [styles.tile, { backgroundColor: colors.card, borderColor: inCart ? palette.primary : colors.border, opacity: out ? 0.45 : pressed ? 0.8 : 1 }]}>
      <View style={[styles.tileImage, { backgroundColor: colors.background }]}>
        {image ? <Image source={image} style={styles.fill} contentFit="cover" /> : <Ionicons name={service ? 'construct-outline' : 'cube-outline'} size={26} color={colors.muted} />}
        {inCart > 0 && (
          <View style={styles.inCart}>
            <Text style={styles.inCartText}>{inCart}</Text>
          </View>
        )}
        <View style={[styles.stockBadge, { backgroundColor: out ? palette.danger : stock <= 3 && !service ? '#D97706' : 'rgba(15,23,42,0.6)' }]}>
          <Text style={styles.stockText}>{service ? 'Servicio' : out ? 'Sin stock' : `${stock} u.`}</Text>
        </View>
      </View>
      <View style={styles.tileBody}>
        <Text numberOfLines={2} style={[styles.tileName, { color: colors.text }]}>{product.name}</Text>
        <View style={styles.tileFoot}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.tilePrice, { color: mode === 'wholesale' ? '#7C3AED' : colors.text }]}>{formatGs(unitPrice(product, mode))}</Text>
          {!out && (
            <View style={[styles.addBtn, { backgroundColor: inCart ? palette.primary : 'rgba(37,99,235,0.1)' }]}>
              <Ionicons name="add" size={18} color={inCart ? '#fff' : palette.primary} />
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function CartRow({ line, mode, colors, onQuantity, onDiscount }: { line: CartLine; mode: PriceMode; colors: Colors; onQuantity: (quantity: number) => void; onDiscount: (discount: number) => void }) {
  const [showDiscount, setShowDiscount] = useState(line.discount > 0);
  return (
    <View style={[styles.cartRow, { borderColor: colors.border }]}>
      <View style={styles.cartRowTop}>
        <View style={styles.flex}>
          <Text numberOfLines={2} style={[styles.cartName, { color: colors.text }]}>{line.product.name}</Text>
          <Text style={[styles.small, { color: colors.muted }]}>{formatGs(unitPrice(line.product, mode))} c/u</Text>
        </View>
        <Text style={[styles.cartLine, { color: colors.text }]}>{formatGs(lineTotal(line, mode))}</Text>
      </View>
      <View style={styles.cartRowBottom}>
        <View style={[styles.stepper, { borderColor: colors.border }]}>
          <Pressable onPress={() => onQuantity(line.quantity - 1)} hitSlop={8} accessibilityLabel="Restar uno">
            <Ionicons name={line.quantity === 1 ? 'trash-outline' : 'remove'} size={18} color={line.quantity === 1 ? palette.danger : colors.text} />
          </Pressable>
          <Text style={[styles.qty, { color: colors.text }]}>{line.quantity}</Text>
          <Pressable onPress={() => onQuantity(line.quantity + 1)} hitSlop={8} accessibilityLabel="Sumar uno">
            <Ionicons name="add" size={18} color={colors.text} />
          </Pressable>
        </View>
        {showDiscount ? (
          <View style={[styles.discountInput, { borderColor: colors.border }]}>
            <Text style={[styles.small, { color: colors.muted }]}>Desc. Gs.</Text>
            <TextInput value={pretty(line.discount)} onChangeText={(value) => onDiscount(digits(value))} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.muted} style={[styles.discountField, { color: colors.text }]} />
          </View>
        ) : (
          <Pressable onPress={() => setShowDiscount(true)} hitSlop={6}>
            <Text style={[styles.small, { color: palette.primary, fontWeight: '800' }]}>+ Descuento</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function Row({ label, value, colors, tone, big }: { label: string; value: string; colors: Colors; tone?: string; big?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[big ? styles.rowBigLabel : styles.small, { color: big ? colors.text : colors.muted }]}>{label}</Text>
      <Text style={[big ? styles.rowBig : styles.rowValue, { color: tone ?? colors.text }]}>{value}</Text>
    </View>
  );
}

function OpenRegister({ session, colors, onOpened }: { session: PosSession; colors: Colors; onOpened: () => void }) {
  const [registerId, setRegisterId] = useState(session.registers[0]?.id ?? 'principal');
  const [opening, setOpening] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setSaving(true);
    setError(null);
    try {
      await openCashRegister({ registerId, branchId: session.branch.id, openingBalance: digits(opening) });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onOpened();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo abrir la caja.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.openWrap}>
      <View style={[styles.openCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.openIcon, { backgroundColor: '#D977061A' }]}>
          <Ionicons name="lock-closed-outline" size={30} color="#D97706" />
        </View>
        <Text style={[styles.h1, { color: colors.text }]}>La caja está cerrada</Text>
        <Text style={[styles.muted, { color: colors.muted }]}>Para vender hay que abrir una caja en {session.branch.name}.</Text>
        {session.permissions.manageCash ? (
          <>
            {session.registers.length > 1 && (
              <View style={styles.discounts}>
                {session.registers.map((register) => (
                  <Pressable key={register.id} onPress={() => setRegisterId(register.id)} style={[styles.discountChip, { borderColor: registerId === register.id ? palette.primary : colors.border }]}>
                    <Text style={[styles.discountText, { color: registerId === register.id ? palette.primary : colors.text }]}>{register.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            <View style={[styles.openInput, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Text style={[styles.small, { color: colors.muted }]}>Gs.</Text>
              <TextInput value={opening} onChangeText={(value) => setOpening(pretty(value))} keyboardType="number-pad" placeholder="Efectivo inicial en la caja" placeholderTextColor={colors.muted} style={[styles.openField, { color: colors.text }]} />
            </View>
            {error && <Text style={styles.error}>{error}</Text>}
            <Pressable onPress={open} disabled={saving} style={[styles.checkoutBtn, { opacity: saving ? 0.6 : 1 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.checkoutText}>Abrir caja</Text>}
            </Pressable>
          </>
        ) : (
          <Text style={[styles.muted, { color: colors.muted }]}>Pedile a un encargado que abra la caja.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: '100%', height: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  h1: { fontSize: 21, fontWeight: '800', textAlign: 'center' },
  muted: { fontSize: 13, textAlign: 'center' },
  small: { fontSize: 12 },
  label: { fontSize: 13, fontWeight: '800' },
  outline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10, marginTop: 6 },
  error: { color: palette.danger, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  hero: { flexDirection: 'row', gap: 10, marginHorizontal: 12, marginTop: 12, padding: 14, borderRadius: 20, backgroundColor: palette.primary },
  heroMain: { flex: 1, gap: 2 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  heroRegister: { flexShrink: 1, color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '800' },
  heroTotal: { color: '#fff', fontSize: 26, fontWeight: '900', letterSpacing: -0.5, marginTop: 4 },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '600' },
  quick: { justifyContent: 'center', gap: 6 },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, minWidth: 92 },
  quickText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 10 },
  customerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, height: 40 },
  customerText: { flex: 1, fontSize: 13, fontWeight: '700' },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, padding: 3, height: 40 },
  segmentItem: { borderRadius: 9, paddingHorizontal: 10, justifyContent: 'center' },
  modeText: { fontSize: 12, fontWeight: '800' },
  searchRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  shelvesWrap: { flexGrow: 0 },
  shelves: { gap: 8, paddingHorizontal: 12, paddingVertical: 6 },
  shelf: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 180 },
  shelfText: { fontSize: 13, fontWeight: '700' },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  scanBtn: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  grid: { padding: 12, gap: 10 },
  gridRow: { gap: 10 },
  loading: { paddingVertical: 40 },
  tile: { flex: 1, maxWidth: '49%', borderWidth: 1.5, borderRadius: 16, overflow: 'hidden' },
  tileImage: { width: '100%', aspectRatio: 1.25, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  inCart: { position: 'absolute', top: 8, right: 8, minWidth: 26, height: 26, borderRadius: 13, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  inCartText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  stockBadge: { position: 'absolute', left: 8, bottom: 8, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  stockText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  tileBody: { padding: 10, gap: 6 },
  tileName: { fontSize: 13, fontWeight: '700', lineHeight: 17, minHeight: 34 },
  tileFoot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tilePrice: { flex: 1, fontSize: 15, fontWeight: '900' },
  addBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  toast: { position: 'absolute', bottom: 100, alignSelf: 'center', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '90%' },
  toastText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  cartBar: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 10, paddingLeft: 14, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, elevation: 8 },
  cartCount: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  cartCountText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  cartLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
  cartTotal: { color: '#fff', fontSize: 19, fontWeight: '900' },
  payBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, height: 46 },
  payText: { color: palette.primary, fontSize: 16, fontWeight: '900' },
  cartFooter: { gap: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowValue: { fontSize: 13, fontWeight: '700' },
  rowBigLabel: { fontSize: 16, fontWeight: '800' },
  rowBig: { fontSize: 22, fontWeight: '900' },
  checkoutBtn: { backgroundColor: '#16A34A', borderRadius: 14, minHeight: 54, alignItems: 'center', justifyContent: 'center', marginTop: 8, alignSelf: 'stretch' },
  checkoutText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  cartRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 10, gap: 8 },
  cartRowTop: { flexDirection: 'row', gap: 10 },
  cartName: { fontSize: 14, fontWeight: '700' },
  cartLine: { fontSize: 15, fontWeight: '900' },
  cartRowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, height: 38 },
  qty: { fontSize: 16, fontWeight: '900', minWidth: 20, textAlign: 'center' },
  discountInput: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, height: 38, flex: 1, maxWidth: 170 },
  discountField: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  discounts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  discountChip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  discountText: { fontSize: 13, fontWeight: '700' },
  notes: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14 },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingVertical: 6 },
  openWrap: { flex: 1, justifyContent: 'center', padding: 16 },
  openCard: { borderWidth: 1, borderRadius: 20, padding: 20, gap: 12, alignItems: 'center' },
  openIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  openInput: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, alignSelf: 'stretch' },
  openField: { flex: 1, fontSize: 16, fontWeight: '700', paddingVertical: 12 },
});
