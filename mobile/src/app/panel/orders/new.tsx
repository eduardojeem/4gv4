import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BarcodeScanner } from '@/components/barcode-scanner';
import { BottomSheet } from '@/components/bottom-sheet';
import { KeyboardFormScroll } from '@/components/keyboard-form-scroll';
import { PanelAccessState } from '@/components/panel-access-state';
import { PosCustomerSheet } from '@/components/pos-customer';
import { SelectField } from '@/components/select-sheet';
import { formatGs } from '@/lib/marketplace';
import { palette, usePalette } from '@/lib/palette';
import { usePanel } from '@/lib/panel';
import { usePaymentControls } from '@/lib/payment-controls';
import {
  createOrder,
  fetchOrderBranches,
  fetchOrderProductById,
  isOrderService,
  newOrderKey,
  notifyOrder,
  notifyOrderCreated,
  orderItemUnitPrice,
  searchOrderCatalog,
  type OrderBranch,
  type OrderCatalogKind,
  type OrderFulfillmentType,
  type OrderPaymentMethod,
  type PosCustomer,
} from '@/lib/pos';
import { getPrivateCacheContext, setPrivateCacheBranch } from '@/lib/private-cache-context';
import { lookupBarcode, productImages, type Product, type ProductVariant } from '@/lib/products';

type Colors = ReturnType<typeof usePalette>;

type DraftCartLine = {
  key: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  maxStock: number | null;
  isService: boolean;
  imageUrl: string | null;
};

const CATALOG_TABS: { key: OrderCatalogKind; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'part', label: 'Productos' },
  { key: 'service', label: 'Servicios' },
];

const PAYMENT_OPTIONS: {
  key: OrderPaymentMethod;
  controlId: 'cash' | 'card' | 'transfer' | 'digital_wallet';
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'CASH', controlId: 'cash', label: 'Efectivo', icon: 'cash-outline' },
  { key: 'CARD', controlId: 'card', label: 'Tarjeta', icon: 'card-outline' },
  { key: 'TRANSFER', controlId: 'transfer', label: 'Transferencia', icon: 'swap-horizontal-outline' },
  { key: 'DIGITAL_WALLET', controlId: 'digital_wallet', label: 'Billetera', icon: 'wallet-outline' },
];

const DELIVERY_COST_PRESETS = [0, 5000, 10000, 15000];
const INITIAL_CATALOG_VISIBLE = 12;

const digits = (value: string) => Number(value.replace(/\D/g, '')) || 0;
const pretty = (value: string | number) => {
  const only = String(value).replace(/\D/g, '');
  return only ? Number(only).toLocaleString('es-PY') : '';
};
const lineKey = (productId: string, variantId?: string | null) => `${productId}:${variantId ?? ''}`;
const normalizeCode = (value?: string | null) => (value ?? '').trim().toLowerCase();

export default function NewOrderScreen() {
  const colors = usePalette();
  const { data: panel, findItem, can, loading: panelLoading } = usePanel();
  const organizationId = panel?.organization.id ?? null;
  const paymentControls = usePaymentControls(Boolean(organizationId));

  // Sucursal
  const [branches, setBranches] = useState<OrderBranch[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchesError, setBranchesError] = useState<string | null>(null);
  const [branchAttempt, setBranchAttempt] = useState(0);
  const [branchNotice, setBranchNotice] = useState<string | null>(null);

  // Cliente
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  const [customerSheetOpen, setCustomerSheetOpen] = useState(false);

  // Catálogo y carrito
  const [catalogKind, setCatalogKind] = useState<OrderCatalogKind>('all');
  const [query, setQuery] = useState('');
  const [catalogProducts, setCatalogProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogAttempt, setCatalogAttempt] = useState(0);
  const [showAllResults, setShowAllResults] = useState(false);
  const [variantProduct, setVariantProduct] = useState<Product | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [cart, setCart] = useState<DraftCartLine[]>([]);

  // Entrega y cobro
  const deliveryAllowed = can('orders.delivery');
  const [fulfillmentType, setFulfillmentType] = useState<OrderFulfillmentType>('PICKUP');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [shippingInput, setShippingInput] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<OrderPaymentMethod>('CASH');
  const [notes, setNotes] = useState('');

  // Envío
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [idempotencyKey] = useState(newOrderKey);

  const canCreateOrder = Boolean(!panelLoading && organizationId && findItem('orders') && can('ecommerce.orders.manage'));

  // 1. Cargar sucursales accesibles al iniciar o cambiar de comercio
  useEffect(() => {
    if (!organizationId || !canCreateOrder) return undefined;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setBranchesLoading(true);
      setBranchesError(null);
    });
    fetchOrderBranches()
      .then((list) => {
        if (!active) return;
        setBranches(list);
        const currentBranch = getPrivateCacheContext().branchId;
        const preferred =
          (currentBranch ? list.find((b) => b.id === currentBranch) : undefined)
          ?? list.find((b) => b.is_primary)
          ?? list.find((b) => b.is_default)
          ?? list[0]
          ?? null;
        if (preferred) {
          setPrivateCacheBranch(preferred.id);
          setBranchId(preferred.id);
        } else {
          setBranchId(null);
        }
      })
      .catch((err) => {
        if (active) setBranchesError(err instanceof Error ? err.message : 'No se pudieron cargar las sucursales.');
      })
      .finally(() => {
        if (active) setBranchesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [organizationId, branchAttempt, canCreateOrder]);

  // 2. Cargar catálogo por sucursal + búsqueda
  useEffect(() => {
    if (!organizationId || !branchId) return undefined;
    let active = true;
    const delay = query.trim() ? 300 : 0;
    const timer = setTimeout(() => {
      if (!active) return;
      setCatalogLoading(true);
      setCatalogError(null);
      searchOrderCatalog({ query, kind: catalogKind, branchId })
        .then((res) => {
          if (!active) return;
          setCatalogProducts(res.products);
          setShowAllResults(false);
          // Actualizar límite de stock visible si algún ítem del carrito vino en la nueva respuesta
          setCart((prev) =>
            prev.map((line) => {
              const prod = res.products.find((p) => p.id === line.productId);
              if (!prod) return line;
              const service = isOrderService(prod);
              if (service) return { ...line, isService: true, maxStock: null };
              if (line.variantId) {
                const variant = (prod.variants ?? []).find((v) => v.id === line.variantId);
                if (!variant) return line;
                const stock = Math.max(0, Number(variant.current_stock ?? variant.stock_quantity ?? 0));
                return { ...line, maxStock: stock };
              }
              const stock = Math.max(0, Number(prod.branch_stock_quantity ?? prod.stock_quantity ?? 0));
              return { ...line, maxStock: stock };
            })
          );
        })
        .catch((err) => {
          if (active) setCatalogError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.');
        })
        .finally(() => {
          if (active) setCatalogLoading(false);
        });
    }, delay);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [organizationId, branchId, query, catalogKind, catalogAttempt]);

  const resolvedFulfillmentType: OrderFulfillmentType =
    fulfillmentType === 'DELIVERY' && deliveryAllowed ? 'DELIVERY' : 'PICKUP';

  const allowedPaymentMethods = paymentControls.ready
    ? PAYMENT_OPTIONS.filter((m) => paymentControls.allows(m.controlId))
    : [];
  const resolvedPaymentMethod: OrderPaymentMethod | null =
    allowedPaymentMethods.some((m) => m.key === paymentMethod)
      ? paymentMethod
      : (allowedPaymentMethods[0]?.key ?? null);

  const subtotal = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const shippingCost = resolvedFulfillmentType === 'DELIVERY' ? digits(shippingInput) : 0;
  const discountAmount = digits(discountInput);
  const total = Math.max(0, subtotal + shippingCost - discountAmount);
  const totalUnits = cart.reduce((sum, line) => sum + line.quantity, 0);

  const selectedBranch = branches.find((b) => b.id === branchId) ?? null;
  const hasStockConflict = cart.some((line) => line.maxStock !== null && line.quantity > line.maxStock);

  const problems = {
    branch: !branchId ? 'Elegí una sucursal activa para el pedido.' : null,
    customer: !customer ? 'Elegí o creá un cliente para el pedido.' : null,
    items:
      cart.length === 0
        ? 'Agregá al menos un producto o servicio.'
        : hasStockConflict
          ? 'Revisá las cantidades que superan el stock disponible.'
          : null,
    deliveryPhone:
      resolvedFulfillmentType === 'DELIVERY' && !deliveryPhone.trim()
        ? 'Ingresá un teléfono de contacto para el delivery.'
        : null,
    deliveryAddress:
      resolvedFulfillmentType === 'DELIVERY' && !deliveryAddress.trim()
        ? 'Ingresá la dirección de entrega.'
        : null,
    discount: discountAmount > subtotal ? 'El descuento no puede superar el subtotal.' : null,
    payment:
      !paymentControls.ready
        ? paymentControls.error || 'Cargando medios de pago habilitados…'
        : !resolvedPaymentMethod
          ? 'Este comercio no tiene medios de pago habilitados.'
          : null,
  };

  const firstProblem = Object.values(problems).find(Boolean) ?? null;

  const selectBranch = useCallback(
    (nextId: string | null) => {
      if (!nextId || nextId === branchId) return;
      setPrivateCacheBranch(nextId);
      setBranchId(nextId);
      setSubmitError(null);
      if (cart.some((line) => line.maxStock !== null)) {
        setBranchNotice('Sucursal cambiada: verificamos las cantidades con el stock de esta sucursal.');
      } else {
        setBranchNotice(null);
      }
    },
    [branchId, cart]
  );

  const handlePickCustomer = useCallback((picked: PosCustomer | null) => {
    setCustomerSheetOpen(false);
    if (!picked) return;
    setCustomer(picked);
    setDeliveryPhone(picked.phone?.trim() ?? '');
    setDeliveryAddress(picked.address?.trim() ?? '');
    setSubmitError(null);
  }, []);

  const addLine = useCallback((product: Product, variant: ProductVariant | null) => {
    const service = isOrderService(product);
    const maxStock = service
      ? null
      : variant
        ? Math.max(0, Number(variant.current_stock ?? variant.stock_quantity ?? 0))
        : Math.max(0, Number(product.branch_stock_quantity ?? product.stock_quantity ?? 0));

    if (maxStock !== null && maxStock <= 0) {
      Alert.alert('Sin stock', `No hay unidades disponibles en ${selectedBranch?.name ?? 'esta sucursal'}.`);
      return;
    }

    const key = lineKey(product.id, variant?.id);
    const unitPrice = orderItemUnitPrice(product, variant);
    const variantName = variant ? (variant.variant_name || variant.name || 'Variante') : null;
    const sku = variant?.sku ?? product.sku ?? null;
    const imageUrl = productImages(product)[0] ?? null;

    setCart((prev) => {
      const existing = prev.find((line) => line.key === key);
      if (existing) {
        const cap = maxStock !== null ? Math.min(1000, maxStock) : 1000;
        if (existing.quantity >= cap) {
          Alert.alert('Tope de stock', `Solo quedan ${cap} unidad${cap === 1 ? '' : 'es'} disponibles.`);
          return prev;
        }
        return prev.map((line) => (line.key === key ? { ...line, quantity: line.quantity + 1, maxStock } : line));
      }
      return [
        ...prev,
        {
          key,
          productId: product.id,
          variantId: variant?.id ?? null,
          productName: product.name,
          variantName,
          sku,
          unitPrice,
          quantity: 1,
          maxStock,
          isService: service,
          imageUrl,
        },
      ];
    });
    setSubmitError(null);
    void Haptics.selectionAsync();
  }, [selectedBranch?.name]);

  const handleTapProduct = useCallback(
    (product: Product) => {
      const activeVariants = (product.variants ?? []).filter((v) => v.is_active !== false);
      if (activeVariants.length > 0) {
        setVariantProduct(product);
        return;
      }
      if (product.has_variants) {
        Alert.alert('Sin variantes activas', 'Este producto usa variantes pero no tiene opciones activas.');
        return;
      }
      addLine(product, null);
    },
    [addLine]
  );

  const changeQty = useCallback((key: string, delta: number) => {
    setCart((prev) =>
      prev.flatMap((line) => {
        if (line.key !== key) return [line];
        const nextQty = line.quantity + delta;
        if (nextQty <= 0) return [];
        const cap = line.maxStock !== null ? Math.min(1000, line.maxStock) : 1000;
        if (nextQty > cap) {
          Alert.alert('Stock disponible', `Máximo disponible en sucursal: ${cap}.`);
          return [line];
        }
        return [{ ...line, quantity: nextQty }];
      })
    );
  }, []);

  const handleBarcodeScanned = useCallback(
    async (rawCode: string) => {
      setScanning(false);
      const code = rawCode.trim();
      if (!code || !branchId) return;
      const target = normalizeCode(code);
      setScanNotice(null);
      try {
        const res = await searchOrderCatalog({ query: code, kind: 'all', branchId });
        for (const product of res.products) {
          const activeVariants = (product.variants ?? []).filter((v) => v.is_active !== false);
          const matchedVariant = activeVariants.find(
            (v) => normalizeCode(v.barcode) === target || normalizeCode(v.sku) === target
          );
          if (matchedVariant) {
            addLine(product, matchedVariant);
            setScanNotice(`Agregado por código: ${product.name} (${matchedVariant.variant_name || matchedVariant.name || 'Variante'})`);
            return;
          }
          if (normalizeCode(product.barcode) === target || normalizeCode(product.sku) === target) {
            if (activeVariants.length > 0) {
              setVariantProduct(product);
              setScanNotice(`Elegí la variante de ${product.name}`);
            } else {
              addLine(product, null);
              setScanNotice(`Agregado por código: ${product.name}`);
            }
            return;
          }
        }

        // Respaldo para códigos de barras en variantes o variantes con cero a la izquierda
        const lookup = await lookupBarcode(code).catch(() => null);
        if (lookup?.own?.id) {
          const resolvedProduct = await fetchOrderProductById(lookup.own.id, branchId).catch(() => null);
          if (!resolvedProduct) {
            setScanNotice(`«${lookup.own.name}» está desactivado y no se puede agregar.`);
            return;
          }
          const activeVariants = (resolvedProduct.variants ?? []).filter((v) => v.is_active !== false);
          const variantLabelTarget = normalizeCode(lookup.own.variant);
          const matchedVariant = activeVariants.find(
            (v) =>
              normalizeCode(v.barcode) === target
              || normalizeCode(v.sku) === target
              || (variantLabelTarget && normalizeCode(v.variant_name || v.name) === variantLabelTarget)
          );
          if (matchedVariant) {
            addLine(resolvedProduct, matchedVariant);
            setScanNotice(
              `Agregado por código: ${resolvedProduct.name} (${matchedVariant.variant_name || matchedVariant.name || 'Variante'})`
            );
            return;
          }
          if (activeVariants.length > 0) {
            setVariantProduct(resolvedProduct);
            setScanNotice(`Elegí la variante de ${resolvedProduct.name}`);
            return;
          }
          addLine(resolvedProduct, null);
          setScanNotice(`Agregado por código: ${resolvedProduct.name}`);
          return;
        }

        setQuery(code);
        setScanNotice(`Sin coincidencia exacta para «${code}». Mostrando resultados de búsqueda.`);
      } catch (err) {
        Alert.alert('No se pudo buscar el código', err instanceof Error ? err.message : 'Probá de nuevo.');
      }
    },
    [branchId, addLine]
  );

  const confirmLeave = () => {
    const goBack = () => (router.canGoBack() ? router.back() : router.replace('/panel/orders' as never));
    if (cart.length > 0 || customer) {
      Alert.alert('¿Descartar borrador?', 'Tenés cambios cargados en este pedido.', [
        { text: 'Seguir acá', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: goBack },
      ]);
      return;
    }
    goBack();
  };

  const submit = async () => {
    setTouched(true);
    if (firstProblem || !branchId || !customer || !resolvedPaymentMethod) {
      setSubmitError(firstProblem);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    setSaving(true);
    setSubmitError(null);
    try {
      const result = await createOrder(
        {
          branchId,
          customerId: customer.id,
          items: cart.map((line) => ({
            productId: line.productId,
            ...(line.variantId ? { variantId: line.variantId } : {}),
            quantity: line.quantity,
          })),
          paymentMethod: resolvedPaymentMethod,
          fulfillmentType: resolvedFulfillmentType,
          ...(resolvedFulfillmentType === 'DELIVERY'
            ? {
                deliveryContact: {
                  phone: deliveryPhone.trim(),
                  address: deliveryAddress.trim(),
                },
              }
            : {}),
          shippingCost,
          discountAmount,
          notes: notes.trim() || undefined,
        },
        idempotencyKey
      );
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      notifyOrder(result.order);
      notifyOrderCreated(result.order);
      router.replace(`/panel/orders/${result.order.id}` as never);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No se pudo crear el pedido.');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  if (panelLoading || !findItem('orders') || !can('ecommerce.orders.manage')) {
    return <PanelAccessState />;
  }

  const show = (key: keyof typeof problems) => (touched ? problems[key] : null);
  const visibleCatalog = showAllResults ? catalogProducts : catalogProducts.slice(0, INITIAL_CATALOG_VISIBLE);

  return (
    <View style={styles.flex}>
      <View style={[styles.topBar, { borderColor: colors.border }]}>
        <Pressable onPress={confirmLeave} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Volver">
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.text }]}>Nuevo pedido</Text>
        <View style={styles.iconBtn} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <KeyboardFormScroll style={styles.flex} contentContainerStyle={styles.content}>
          {/* 1. Sucursal */}
          <Section number={1} title="Sucursal" colors={colors} error={show('branch') || branchesError}>
            {branchesLoading ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.primary} />
                <Text style={[styles.small, { color: colors.muted }]}>Cargando sucursales…</Text>
              </View>
            ) : branchesError ? (
              <Pressable onPress={() => setBranchAttempt((n) => n + 1)} style={[styles.outlineBtn, { borderColor: colors.border }]}>
                <Text style={[styles.bold, { color: colors.text }]}>Reintentar carga de sucursales</Text>
              </Pressable>
            ) : branches.length === 0 ? (
              <Text style={styles.fieldError}>No tenés una sucursal activa asignada.</Text>
            ) : branches.length === 1 ? (
              <View style={[styles.branchPill, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Ionicons name="storefront-outline" size={18} color={palette.primary} />
                <Text style={[styles.bold, { color: colors.text }]}>{branches[0].name}</Text>
                {branches[0].code ? <Text style={[styles.small, { color: colors.muted }]}>· {branches[0].code}</Text> : null}
              </View>
            ) : (
              <SelectField
                label="Sucursal"
                icon="storefront-outline"
                value={selectedBranch?.name ?? null}
                placeholder="Elegí la sucursal"
                options={branches.map((b) => ({
                  id: b.id,
                  label: b.name,
                  hint: b.is_primary ? 'Principal' : b.code ?? undefined,
                }))}
                onSelect={(choice) => selectBranch(choice.id)}
              />
            )}
            {branchNotice ? <Text style={[styles.small, { color: '#D97706', fontWeight: '600' }]}>{branchNotice}</Text> : null}
          </Section>

          {/* 2. Cliente */}
          <Section number={2} title="Cliente" colors={colors} error={show('customer')}>
            {customer ? (
              <Pressable
                onPress={() => setCustomerSheetOpen(true)}
                accessibilityRole="button"
                style={[styles.customerCard, { borderColor: palette.primary, backgroundColor: `${palette.primary}0D` }]}>
                <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
                  <Text style={styles.avatarText}>{customer.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.flex}>
                  <Text numberOfLines={1} style={[styles.bold, { color: colors.text, fontSize: 15 }]}>{customer.name}</Text>
                  <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>
                    {[customer.phone, customer.email, customer.ruc ? `CI ${customer.ruc}` : null].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                  </Text>
                  {customer.address ? (
                    <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>{customer.address}</Text>
                  ) : null}
                </View>
                <Text style={[styles.small, styles.bold, { color: palette.primary }]}>Cambiar</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => setCustomerSheetOpen(true)}
                accessibilityRole="button"
                style={[styles.pickCustomerBtn, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Ionicons name="person-add-outline" size={20} color={palette.primary} />
                <Text style={[styles.bold, { color: palette.primary, fontSize: 15 }]}>Elegir o crear cliente</Text>
              </Pressable>
            )}
          </Section>

          {/* 3. Productos y servicios */}
          <Section number={3} title="Productos y servicios" colors={colors} error={show('items')}>
            {cart.length > 0 && (
              <View style={[styles.cartBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.bold, { color: colors.text, fontSize: 13 }]}>
                    En el pedido ({totalUnits} {totalUnits === 1 ? 'ítem' : 'ítems'})
                  </Text>
                  <Text style={[styles.bold, { color: palette.primary, fontSize: 13 }]}>{formatGs(subtotal)}</Text>
                </View>
                {cart.map((line) => {
                  const stockExceeded = line.maxStock !== null && line.quantity > line.maxStock;
                  return (
                    <View key={line.key} style={[styles.cartLine, { borderColor: colors.border }]}>
                      <View style={styles.flex}>
                        <Text numberOfLines={1} style={[styles.bold, { color: colors.text, fontSize: 14 }]}>
                          {line.productName}
                        </Text>
                        <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>
                          {[line.variantName, line.isService ? 'Servicio' : null, formatGs(line.unitPrice)].filter(Boolean).join(' · ')}
                        </Text>
                        {stockExceeded && (
                          <Text style={[styles.small, { color: palette.danger, fontWeight: '700' }]}>
                            Supera el stock de esta sucursal (disp: {line.maxStock})
                          </Text>
                        )}
                      </View>
                      <View style={styles.qtyBox}>
                        <Pressable
                          onPress={() => changeQty(line.key, -1)}
                          hitSlop={6}
                          accessibilityLabel={`Quitar una unidad de ${line.productName}`}
                          style={[styles.qtyBtn, { borderColor: colors.border }]}>
                          <Ionicons name="remove" size={16} color={colors.text} />
                        </Pressable>
                        <Text style={[styles.qtyValue, { color: colors.text }]}>{line.quantity}</Text>
                        <Pressable
                          onPress={() => changeQty(line.key, 1)}
                          hitSlop={6}
                          accessibilityLabel={`Sumar una unidad de ${line.productName}`}
                          style={[styles.qtyBtn, { borderColor: colors.border }]}>
                          <Ionicons name="add" size={16} color={colors.text} />
                        </Pressable>
                      </View>
                      <Pressable
                        onPress={() => setCart((prev) => prev.filter((item) => item.key !== line.key))}
                        hitSlop={8}
                        accessibilityLabel={`Eliminar ${line.productName}`}>
                        <Ionicons name="trash-outline" size={18} color={palette.danger} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={[styles.searchBar, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="search" size={17} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  setScanNotice(null);
                }}
                placeholder="Buscar producto, servicio o SKU"
                placeholderTextColor={colors.muted}
                autoCorrect={false}
                style={[styles.searchInput, { color: colors.text }]}
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Limpiar búsqueda">
                  <Ionicons name="close-circle" size={18} color={colors.muted} />
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setScanning(true)}
                hitSlop={8}
                accessibilityLabel="Escanear código de barras"
                style={styles.scanIconBtn}>
                <Ionicons name="barcode-outline" size={21} color={palette.primary} />
              </Pressable>
            </View>

            {scanNotice ? <Text style={[styles.small, { color: palette.primary, fontWeight: '700' }]}>{scanNotice}</Text> : null}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {CATALOG_TABS.map((tab) => {
                const selected = catalogKind === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => setCatalogKind(tab.key)}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? palette.primary : colors.border,
                        backgroundColor: selected ? `${palette.primary}18` : colors.background,
                      },
                    ]}>
                    <Text style={[styles.chipText, { color: selected ? palette.primary : colors.text }, selected && styles.bold]}>
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {!branchId ? (
              <Text style={[styles.small, { color: colors.muted }]}>Elegí una sucursal para ver el catálogo y el stock.</Text>
            ) : catalogLoading ? (
              <ActivityIndicator style={{ paddingVertical: 20 }} color={palette.primary} />
            ) : catalogError ? (
              <View style={styles.inlineErrorBox}>
                <Text style={styles.fieldError}>{catalogError}</Text>
                <Pressable onPress={() => setCatalogAttempt((n) => n + 1)} style={[styles.outlineBtn, { borderColor: colors.border }]}>
                  <Text style={[styles.bold, { color: colors.text }]}>Reintentar</Text>
                </Pressable>
              </View>
            ) : visibleCatalog.length === 0 ? (
              <Text style={[styles.small, { color: colors.muted, textAlign: 'center', paddingVertical: 14 }]}>
                {query.trim() ? `Nada coincide con «${query.trim()}».` : 'No hay ítems activos para mostrar.'}
              </Text>
            ) : (
              <View style={styles.catalogList}>
                {visibleCatalog.map((product) => (
                  <CatalogRow
                    key={product.id}
                    product={product}
                    cartLines={cart.filter((line) => line.productId === product.id)}
                    colors={colors}
                    onPress={() => handleTapProduct(product)}
                  />
                ))}
                {!showAllResults && catalogProducts.length > INITIAL_CATALOG_VISIBLE && (
                  <Pressable
                    onPress={() => setShowAllResults(true)}
                    style={[styles.outlineBtn, { borderColor: colors.border }]}>
                    <Text style={[styles.bold, { color: palette.primary }]}>
                      Mostrar todos ({catalogProducts.length})
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </Section>

          {/* 4. Entrega */}
          <Section
            number={4}
            title="Entrega"
            colors={colors}
            error={show('deliveryPhone') || show('deliveryAddress')}>
            <View style={styles.segmentRow}>
              <Pressable
                onPress={() => {
                  setFulfillmentType('PICKUP');
                  setShippingInput('');
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: resolvedFulfillmentType === 'PICKUP' }}
                style={[
                  styles.segmentBtn,
                  {
                    borderColor: resolvedFulfillmentType === 'PICKUP' ? palette.primary : colors.border,
                    backgroundColor: resolvedFulfillmentType === 'PICKUP' ? `${palette.primary}15` : colors.background,
                  },
                ]}>
                <Ionicons
                  name="storefront-outline"
                  size={18}
                  color={resolvedFulfillmentType === 'PICKUP' ? palette.primary : colors.muted}
                />
                <Text
                  style={[
                    styles.bold,
                    { color: resolvedFulfillmentType === 'PICKUP' ? palette.primary : colors.text, fontSize: 14 },
                  ]}>
                  Retiro en local
                </Text>
              </Pressable>
              {deliveryAllowed && (
                <Pressable
                  onPress={() => setFulfillmentType('DELIVERY')}
                  accessibilityRole="button"
                  accessibilityState={{ selected: resolvedFulfillmentType === 'DELIVERY' }}
                  style={[
                    styles.segmentBtn,
                    {
                      borderColor: resolvedFulfillmentType === 'DELIVERY' ? palette.primary : colors.border,
                      backgroundColor: resolvedFulfillmentType === 'DELIVERY' ? `${palette.primary}15` : colors.background,
                    },
                  ]}>
                  <Ionicons
                    name="bicycle-outline"
                    size={18}
                    color={resolvedFulfillmentType === 'DELIVERY' ? palette.primary : colors.muted}
                  />
                  <Text
                    style={[
                      styles.bold,
                      { color: resolvedFulfillmentType === 'DELIVERY' ? palette.primary : colors.text, fontSize: 14 },
                    ]}>
                    Delivery
                  </Text>
                </Pressable>
              )}
            </View>

            {resolvedFulfillmentType === 'DELIVERY' && (
              <View style={styles.stack}>
                <Input
                  label="Teléfono para el envío"
                  value={deliveryPhone}
                  onChangeText={setDeliveryPhone}
                  placeholder="09xx xxx xxx"
                  keyboardType="phone-pad"
                  colors={colors}
                />
                <Input
                  label="Dirección de entrega"
                  value={deliveryAddress}
                  onChangeText={setDeliveryAddress}
                  placeholder="Calle, número y referencia"
                  colors={colors}
                  multiline
                />
                <Input
                  label="Costo de envío"
                  value={shippingInput}
                  onChangeText={(next) => setShippingInput(pretty(next))}
                  placeholder="0"
                  keyboardType="number-pad"
                  prefix="Gs."
                  colors={colors}
                />
                <View style={styles.chips}>
                  {DELIVERY_COST_PRESETS.map((preset) => {
                    const selected = shippingCost === preset;
                    return (
                      <Pressable
                        key={preset}
                        onPress={() => setShippingInput(preset === 0 ? '' : pretty(preset))}
                        style={[
                          styles.chip,
                          {
                            borderColor: selected ? palette.primary : colors.border,
                            backgroundColor: selected ? `${palette.primary}18` : colors.background,
                          },
                        ]}>
                        <Text style={[styles.chipText, { color: selected ? palette.primary : colors.text }, selected && styles.bold]}>
                          {preset === 0 ? 'Gratis' : formatGs(preset)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}
          </Section>

          {/* 5. Pago y observaciones */}
          <Section
            number={5}
            title="Pago y notas"
            colors={colors}
            error={show('discount') || show('payment')}>
            {!paymentControls.ready && !paymentControls.error ? (
              <View style={styles.inlineRow}>
                <ActivityIndicator size="small" color={palette.primary} />
                <Text style={[styles.small, { color: colors.muted }]}>Verificando medios de pago habilitados…</Text>
              </View>
            ) : paymentControls.error ? (
              <Pressable onPress={paymentControls.retry} style={[styles.outlineBtn, { borderColor: colors.border }]}>
                <Text style={[styles.bold, { color: colors.text }]}>Reintentar carga de medios de pago</Text>
              </Pressable>
            ) : (
              <View style={styles.chips}>
                {allowedPaymentMethods.map((item) => {
                  const selected = resolvedPaymentMethod === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => setPaymentMethod(item.key)}
                      style={[
                        styles.chip,
                        {
                          borderColor: selected ? palette.primary : colors.border,
                          backgroundColor: selected ? `${palette.primary}18` : colors.background,
                        },
                      ]}>
                      <Ionicons name={item.icon} size={15} color={selected ? palette.primary : colors.muted} />
                      <Text style={[styles.chipText, { color: selected ? palette.primary : colors.text }, selected && styles.bold]}>
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Input
              label="Descuento (opcional)"
              value={discountInput}
              onChangeText={(next) => setDiscountInput(pretty(next))}
              placeholder="0"
              keyboardType="number-pad"
              prefix="Gs."
              colors={colors}
            />

            <Input
              label="Notas del pedido (opcional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Indicaciones de entrega o referencia"
              maxLength={2000}
              multiline
              colors={colors}
            />

            <View style={[styles.infoBanner, { borderColor: colors.border, backgroundColor: colors.background }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
              <Text style={[styles.small, styles.flex, { color: colors.muted }]}>
                El pedido se crea como «Sin pagar». Podés registrar el cobro desde su ficha apenas termine.
              </Text>
            </View>
          </Section>

          {submitError && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={palette.danger} />
              <Text style={styles.errorText}>{submitError}</Text>
            </View>
          )}
        </KeyboardFormScroll>

        <View style={[styles.footer, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={styles.summaryRows}>
            <View style={styles.rowBetween}>
              <Text style={[styles.small, { color: colors.muted }]}>
                Subtotal ({totalUnits} {totalUnits === 1 ? 'ítem' : 'ítems'})
              </Text>
              <Text style={[styles.small, styles.bold, { color: colors.text }]}>{formatGs(subtotal)}</Text>
            </View>
            {shippingCost > 0 && (
              <View style={styles.rowBetween}>
                <Text style={[styles.small, { color: colors.muted }]}>Envío</Text>
                <Text style={[styles.small, styles.bold, { color: colors.text }]}>{formatGs(shippingCost)}</Text>
              </View>
            )}
            {discountAmount > 0 && (
              <View style={styles.rowBetween}>
                <Text style={[styles.small, { color: palette.danger }]}>Descuento</Text>
                <Text style={[styles.small, styles.bold, { color: palette.danger }]}>− {formatGs(discountAmount)}</Text>
              </View>
            )}
          </View>
          <Pressable
            onPress={() => void submit()}
            disabled={saving}
            accessibilityRole="button"
            style={[styles.submit, { opacity: saving ? 0.7 : 1 }]}>
            {saving ? <ActivityIndicator color="#fff" /> : <Ionicons name="checkmark-circle" size={20} color="#fff" />}
            <Text style={styles.submitText}>
              {saving ? 'Creando pedido…' : `Crear pedido · ${formatGs(total)}`}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {customerSheetOpen && (
        <PosCustomerSheet
          selected={customer}
          title="Cliente del pedido"
          subtitle="Elegí un cliente registrado o crealo en el momento."
          showAddress
          allowClear={false}
          onClose={() => setCustomerSheetOpen(false)}
          onPick={handlePickCustomer}
        />
      )}

      {variantProduct && (
        <VariantPickerSheet
          product={variantProduct}
          colors={colors}
          onClose={() => setVariantProduct(null)}
          onPick={(variant) => {
            const target = variantProduct;
            setVariantProduct(null);
            addLine(target, variant);
          }}
        />
      )}

      <BarcodeScanner
        visible={scanning}
        onClose={() => setScanning(false)}
        title="Escanear producto o variante"
        hint="Centrá el código de barras en el recuadro"
        onScanned={(code) => void handleBarcodeScanned(code)}
      />
    </View>
  );
}

function CatalogRow({
  product,
  cartLines,
  colors,
  onPress,
}: {
  product: Product;
  cartLines: DraftCartLine[];
  colors: Colors;
  onPress: () => void;
}) {
  const service = isOrderService(product);
  const activeVariants = (product.variants ?? []).filter((v) => v.is_active !== false);
  const hasVariants = activeVariants.length > 0;
  const img = productImages(product)[0] ?? null;
  const inCartQty = cartLines.reduce((sum, line) => sum + line.quantity, 0);

  let priceLabel = '';
  let originalPriceLabel: string | null = null;
  let stockLabel = '';
  let stockColor = '#16A34A';
  let disabled = false;

  if (hasVariants) {
    const prices = activeVariants.map((v) => orderItemUnitPrice(product, v));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    priceLabel = minPrice === maxPrice ? formatGs(minPrice) : `Desde ${formatGs(minPrice)}`;
    if (service) {
      stockLabel = `Servicio · ${activeVariants.length} opciones`;
      stockColor = '#0891B2';
    } else {
      const totalStock = activeVariants.reduce(
        (sum, v) => sum + Math.max(0, Number(v.current_stock ?? v.stock_quantity ?? 0)),
        0
      );
      stockLabel = totalStock > 0 ? `${activeVariants.length} opciones · ${totalStock} disp.` : 'Sin stock';
      stockColor = totalStock > 0 ? '#16A34A' : '#DC2626';
      disabled = totalStock <= 0;
    }
  } else if (product.has_variants) {
    priceLabel = formatGs(orderItemUnitPrice(product, null));
    stockLabel = 'Sin variantes activas';
    stockColor = '#DC2626';
    disabled = true;
  } else {
    const unitPrice = orderItemUnitPrice(product, null);
    const basePrice = Number(product.sale_price) || 0;
    priceLabel = formatGs(unitPrice);
    if (unitPrice < basePrice) originalPriceLabel = formatGs(basePrice);
    if (service) {
      stockLabel = 'Servicio';
      stockColor = '#0891B2';
    } else {
      const stock = Math.max(0, Number(product.branch_stock_quantity ?? product.stock_quantity ?? 0));
      stockLabel = stock > 0 ? `Stock: ${stock}` : 'Sin stock';
      stockColor = stock > 0 ? '#16A34A' : '#DC2626';
      disabled = stock <= 0;
    }
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.catalogRow,
        {
          borderColor: inCartQty > 0 ? palette.primary : colors.border,
          backgroundColor: colors.background,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}>
      <View style={[styles.thumb, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {img ? (
          <Image source={img} style={styles.thumbImg} contentFit="cover" />
        ) : (
          <Ionicons name={service ? 'construct-outline' : 'cube-outline'} size={20} color={colors.muted} />
        )}
      </View>
      <View style={styles.flex}>
        <Text numberOfLines={1} style={[styles.bold, { color: colors.text, fontSize: 14 }]}>{product.name}</Text>
        <Text numberOfLines={1} style={[styles.small, { color: colors.muted }]}>
          {[product.sku || null, stockLabel].filter(Boolean).join(' · ')}
        </Text>
        <View style={styles.priceRow}>
          <Text style={[styles.bold, { color: stockColor === '#DC2626' ? colors.muted : colors.text, fontSize: 14 }]}>
            {priceLabel}
          </Text>
          {originalPriceLabel ? (
            <Text style={[styles.small, styles.strike, { color: colors.muted }]}>{originalPriceLabel}</Text>
          ) : null}
        </View>
      </View>
      {inCartQty > 0 ? (
        <View style={[styles.inCartPill, { backgroundColor: palette.primary }]}>
          <Text style={styles.inCartText}>{hasVariants ? `${inCartQty} · +` : `${inCartQty}`}</Text>
        </View>
      ) : (
        <Ionicons
          name={hasVariants ? 'options-outline' : 'add-circle'}
          size={24}
          color={disabled ? colors.muted : palette.primary}
        />
      )}
    </Pressable>
  );
}

function VariantPickerSheet({
  product,
  colors,
  onClose,
  onPick,
}: {
  product: Product;
  colors: Colors;
  onClose: () => void;
  onPick: (variant: ProductVariant) => void;
}) {
  const service = isOrderService(product);
  const variants = (product.variants ?? []).filter((v) => v.is_active !== false);

  return (
    <BottomSheet
      visible
      title={product.name}
      subtitle={service ? 'Elegí una opción de servicio' : 'Elegí la variante según stock de esta sucursal'}
      onClose={onClose}>
      {variants.map((variant) => {
        const available = service ? null : Math.max(0, Number(variant.current_stock ?? variant.stock_quantity ?? 0));
        const outOfStock = available !== null && available <= 0;
        const unitPrice = orderItemUnitPrice(product, variant);
        const label = variant.variant_name || variant.name || 'Variante';
        return (
          <Pressable
            key={variant.id}
            disabled={outOfStock}
            onPress={() => onPick(variant)}
            style={({ pressed }) => [
              styles.variantRow,
              { borderColor: colors.border, opacity: outOfStock ? 0.45 : pressed ? 0.75 : 1 },
            ]}>
            <View style={styles.flex}>
              <Text style={[styles.bold, { color: colors.text, fontSize: 15 }]}>{label}</Text>
              <Text style={[styles.small, { color: outOfStock ? palette.danger : colors.muted }]}>
                {[
                  variant.sku || null,
                  service ? 'Servicio' : outOfStock ? 'Sin stock' : `Disponible: ${available}`,
                ].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Text style={[styles.bold, { color: colors.text, fontSize: 15 }]}>{formatGs(unitPrice)}</Text>
            <Ionicons name="add-circle" size={22} color={outOfStock ? colors.muted : palette.primary} />
          </Pressable>
        );
      })}
    </BottomSheet>
  );
}

function Section({
  number,
  title,
  colors,
  error,
  children,
}: {
  number: number;
  title: string;
  colors: Colors;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: error ? palette.danger : colors.border }]}>
      <View style={styles.sectionHead}>
        <View style={[styles.number, { backgroundColor: palette.primary }]}>
          <Text style={styles.numberText}>{number}</Text>
        </View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      </View>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function Input({
  label,
  colors,
  prefix,
  multiline,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string; colors: Colors; prefix?: string }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.background }]}>
        {prefix ? <Text style={[styles.prefix, { color: colors.muted }]}>{prefix}</Text> : null}
        <TextInput
          {...props}
          multiline={multiline}
          placeholderTextColor={colors.muted}
          accessibilityLabel={label}
          style={[styles.input, { color: colors.text }, multiline && styles.multiline]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '800' },
  small: { fontSize: 12 },
  stack: { gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  inlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  inlineErrorBox: { gap: 8, alignItems: 'flex-start' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800' },
  content: { padding: 16, gap: 14, paddingBottom: 24 },
  section: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  number: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  numberText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  fieldError: { color: palette.danger, fontSize: 13, fontWeight: '600' },
  outlineBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, alignSelf: 'flex-start' },
  branchPill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11 },
  customerCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  pickCustomerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 12, minHeight: 50, paddingHorizontal: 12 },
  cartBox: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 8 },
  cartLine: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qtyValue: { fontSize: 14, fontWeight: '800', minWidth: 20, textAlign: 'center' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 46 },
  searchInput: { flex: 1, fontSize: 15, height: '100%' },
  scanIconBtn: { padding: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { fontSize: 13, fontWeight: '600' },
  catalogList: { gap: 8 },
  catalogRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
  thumb: { width: 42, height: 42, borderRadius: 10, borderWidth: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  thumbImg: { width: '100%', height: '100%' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  strike: { textDecorationLine: 'line-through' },
  inCartPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  inCartText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  variantRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 12 },
  segmentRow: { flexDirection: 'row', gap: 8 },
  segmentBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, minHeight: 46, paddingHorizontal: 10 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  prefix: { fontSize: 15, fontWeight: '700', marginRight: 6 },
  input: { flex: 1, fontSize: 15, paddingVertical: 11 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 10, padding: 10 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, backgroundColor: 'rgba(220,38,38,0.1)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.35)' },
  errorText: { flex: 1, color: palette.danger, fontSize: 14, fontWeight: '600' },
  footer: { padding: 12, gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
  summaryRows: { gap: 3 },
  submit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: palette.primary, borderRadius: 14, minHeight: 52 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
