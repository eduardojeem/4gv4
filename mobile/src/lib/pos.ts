import { subscribePrivateCacheContext } from './private-cache-context';
import { formatMobileDate, formatMobileNumber } from './regional-format';
import { installmentAmounts, type CreditTerms } from './pos-credit';
import { isPosService, isSellable } from './pos-catalog';
import { getMobileRuntimeConfig } from './runtime-config';
import { apiFetch, ApiError } from './api';
import type { Product, ProductPage, ProductVariant } from './products';

/**
 * POS de la app: la misma venta que la web (/api/pos/process-sale), con la
 * misma caja y sucursal. El servidor recalcula todo y rechaza un pago que no
 * coincida con su total, así que el total se calcula acá con su misma regla.
 */

export type PosSession = {
  branch: { id: string; name: string };
  registers: { id: string; name: string }[];
  session: { id: string; registerId: string; registerName: string; openingBalance: number; openedAt: string; suspended: boolean } | null;
  summary: CashSummary | null;
  pricing: { taxRate: number; pricesIncludeTax: boolean };
  /** Encabezado del comprobante (Configuración → Empresa). */
  business: { name: string; ruc: string; phone: string; address: string; email: string };
  permissions: { sell: boolean; manageCash: boolean };
};

export type CashMovement = { id: string; type: string; amount: number; method: string | null; reason: string | null; at: string };
export type CashSummary = {
  expectedCash: number;
  salesCount: number;
  salesTotal: number;
  cash: number;
  card: number;
  transfer: number;
  cashIn: number;
  cashOut: number;
  movements: CashMovement[];
};

export async function fetchPosSession() {
  const result = await apiFetch<{ data: PosSession }>('/api/mobile/pos/session');
  return result.data;
}

export async function openCashRegister(input: { registerId: string; branchId: string; openingBalance: number; note?: string }) {
  try {
    await apiFetch('/api/pos/cash-register', {
      method: 'POST',
      headers: { 'x-branch-id': input.branchId },
      body: JSON.stringify({ registerId: input.registerId, branchId: input.branchId, openingBalance: input.openingBalance, note: input.note?.trim() || null }),
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'No se pudo abrir la caja.');
  }
}

// ─── Carrito y total ───────────────────────────────────────────────────────

export type CartLine = { product: Product; quantity: number; discount: number };
export type PriceMode = 'retail' | 'wholesale';

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Precio unitario con la regla de la venta: mayorista si hay, si no −10%; minorista = precio de lista. */
export function unitPrice(product: Pick<Product, 'sale_price' | 'wholesale_price'>, mode: PriceMode) {
  if (mode === 'wholesale') {
    return Number(product.wholesale_price) > 0 ? Number(product.wholesale_price) : round2(Number(product.sale_price) * 0.9);
  }
  return Number(product.sale_price) || 0;
}

export function lineTotal(line: CartLine, mode: PriceMode) {
  const base = round2(unitPrice(line.product, mode) * line.quantity);
  return Math.max(0, base - Math.min(base, line.discount));
}

/** Mismas cuentas que process_pos_sale_atomic: descuentos por línea, % general e IVA. */
export function cartTotals(lines: CartLine[], mode: PriceMode, orderDiscountRate: number, pricing: PosSession['pricing']) {
  let subtotal = 0;
  let lineDiscounts = 0;
  for (const line of lines) {
    const base = round2(unitPrice(line.product, mode) * line.quantity);
    subtotal += base;
    lineDiscounts += Math.min(base, line.discount);
  }
  let net = round2(subtotal - lineDiscounts);
  const rate = Math.min(100, Math.max(0, orderDiscountRate));
  const orderDiscount = round2((net * rate) / 100);
  net -= orderDiscount;
  const taxRate = Math.min(100, Math.max(0, pricing.taxRate));
  const tax = taxRate === 0 ? 0 : pricing.pricesIncludeTax ? round2((net * taxRate) / (100 + taxRate)) : round2((net * taxRate) / 100);
  const total = round2(pricing.pricesIncludeTax ? net : net + tax);
  return { subtotal, discount: round2(lineDiscounts + orderDiscount), tax, total, items: lines.reduce((sum, line) => sum + line.quantity, 0) };
}

// ─── Cobro ─────────────────────────────────────────────────────────────────

/** «credit» es la parte que queda en cuotas: la venta y el crédito se crean juntos. */
export type PayMethod = 'cash' | 'card' | 'transfer' | 'credit';
export type PaymentInput = { method: PayMethod; amount: number; reference?: string; cardLast4?: string };

export type SaleResult = { id: string; total: number; tax: number; discount: number; paymentMethod: string; loyaltyPoints: number; creditId?: string | null; creditSchedule?: unknown; idempotent: boolean };

const SALE_ERRORS: { match: RegExp; text: (m: RegExpMatchArray) => string }[] = [
  { match: /INSUFFICIENT_STOCK\|[^|]+\|(\d+)/, text: (m) => `No alcanza el stock de un producto (quedan ${m[1]}).` },
  { match: /PAYMENT_TOTAL_MISMATCH/, text: () => 'El total cambió (precios o IVA actualizados). Revisá el carrito y volvé a cobrar.' },
  { match: /BRANCH_INVENTORY_NOT_CONFIGURED/, text: () => 'Uno de los productos no tiene inventario en esta sucursal.' },
];

export function newSaleKey() {
  return `app-sale-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function processSale(input: {
  session: PosSession;
  lines: CartLine[];
  priceMode: PriceMode;
  orderDiscountRate: number;
  customerId: string | null;
  payments: PaymentInput[];
  notes?: string;
  idempotencyKey: string;
  /** Condiciones del crédito cuando una parte se paga en cuotas. */
  credit?: CreditTerms | null;
}) {
  try {
    const result = await apiFetch<{ data: Omit<SaleResult, 'idempotent'>; idempotent: boolean }>('/api/pos/process-sale', {
      method: 'POST',
      headers: { 'x-branch-id': input.session.branch.id, 'x-idempotency-key': input.idempotencyKey },
      body: JSON.stringify({
        p_session_id: input.session.session?.id,
        p_sale_data: { customer_id: input.customerId, notes: input.notes?.trim() || null },
        p_items: input.lines.map((line) => ({ product_id: line.product.id, quantity: line.quantity, discount_amount: line.discount })),
        p_payments: input.payments.map((payment) => ({
          payment_method: payment.method,
          amount: payment.amount,
          reference: payment.reference?.trim() || null,
          card_last4: payment.method === 'card' ? payment.cardLast4 : null,
          channel: payment.method === 'card' ? 'card_terminal' : payment.method === 'transfer' ? 'bank_transfer' : null,
        })),
        p_price_mode: input.priceMode,
        p_order_discount_rate: input.orderDiscountRate,
        // Sin start_date: el servidor usa el día de hoy de Paraguay.
        ...(input.credit && input.payments.some((payment) => payment.method === 'credit')
          ? {
              p_credit: {
                interest_rate: input.credit.interestRate,
                installment_count: input.credit.count,
                frequency: input.credit.frequency,
                first_installment_timing: input.credit.timing,
                ...(installmentAmounts(input.credit)
                  ? { schedule_mode: 'installment_amount', installment_amounts: installmentAmounts(input.credit) }
                  : { schedule_mode: 'percent' }),
                ...(input.credit.firstPayment && input.credit.timing === 'at_start'
                  ? {
                      first_payment:
                        input.credit.firstPayment.method === 'cash'
                          ? { method: 'cash', cashReceived: input.credit.firstPayment.cashReceived }
                          : { method: 'transfer', bank: input.credit.firstPayment.bank.trim(), reference: input.credit.firstPayment.reference.trim() },
                    }
                  : {}),
              },
            }
          : {}),
      }),
    });
    return { ...result.data, idempotent: result.idempotent };
  } catch (error) {
    const message = error instanceof ApiError || error instanceof Error ? error.message : '';
    for (const known of SALE_ERRORS) {
      const found = message.match(known.match);
      if (found) throw new Error(known.text(found));
    }
    throw new Error(message || 'No se pudo completar la venta. No se cobró nada.');
  }
}

/** Texto del comprobante para compartir por WhatsApp. */
export function receiptText(input: { business: string; lines: CartLine[]; priceMode: PriceMode; totals: ReturnType<typeof cartTotals>; payments: PaymentInput[]; change: number; saleId: string; customerName?: string | null }) {
  const gs = (value: number) => `Gs. ${formatMobileNumber(Math.round(value))}`;
  const methods: Record<PayMethod, string> = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', credit: 'A crédito' };
  return [
    `*${input.business}*`,
    `Comprobante de venta · ${formatMobileDate(new Date(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
    input.customerName ? `Cliente: ${input.customerName}` : null,
    '',
    ...input.lines.map((line) => `${line.quantity} × ${line.product.name} — ${gs(lineTotal(line, input.priceMode))}`),
    '',
    input.totals.discount > 0 ? `Descuento: −${gs(input.totals.discount)}` : null,
    `*Total: ${gs(input.totals.total)}*`,
    ...input.payments.map((payment) => `${methods[payment.method]}: ${gs(payment.amount)}`),
    input.change > 0 ? `Vuelto: ${gs(input.change)}` : null,
    '',
    `N.º ${input.saleId.slice(0, 8).toUpperCase()} · ¡Gracias por tu compra!`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

// ─── Pedidos ───────────────────────────────────────────────────────────────

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIAL' | 'REFUNDED' | string;
export type OrderPaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'DIGITAL_WALLET';
export type OrderFulfillmentType = 'PICKUP' | 'DELIVERY';
export type OrderChannel = 'WEB' | 'PANEL';
export type OrderSortOption = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';

export type Order = {
  id: string;
  order_number: string;
  branch_id?: string | null;
  channel?: OrderChannel;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: string;
  fulfillment_type: OrderFulfillmentType;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  subtotal: number;
  shipping_cost: number;
  discount_amount: number;
  total: number;
  collected_amount: number;
  amount_due: number;
  notes: string | null;
  created_at: string;
  estimated_delivery_date: string | null;
  delivered_at: string | null;
  order_items: { id: string; product_name: string; product_sku: string | null; variant_name: string | null; quantity: number; unit_price: number; subtotal: number }[];
};

/** Mismos nombres y colores que la sección Pedidos de la web. */
export const ORDER_STATUS: Record<OrderStatus, { label: string; color: string; icon: string }> = {
  PENDING: { label: 'Pendiente', color: '#D97706', icon: 'time-outline' },
  CONFIRMED: { label: 'Confirmado', color: '#2563EB', icon: 'checkmark-circle-outline' },
  PREPARING: { label: 'Preparando', color: '#7C3AED', icon: 'construct-outline' },
  READY: { label: 'Listo', color: '#0891B2', icon: 'bag-check-outline' },
  SHIPPED: { label: 'Enviado', color: '#4F46E5', icon: 'bicycle-outline' },
  DELIVERED: { label: 'Entregado', color: '#16A34A', icon: 'checkmark-done-outline' },
  CANCELLED: { label: 'Cancelado', color: '#DC2626', icon: 'close-circle-outline' },
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  TRANSFER: 'Transferencia',
  DIGITAL_WALLET: 'Billetera digital',
};

export function stripDuplicateVariantSuffix(productName: string, variantName?: string | null): string {
  if (!variantName || !variantName.trim()) return productName;
  const escaped = variantName.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return productName.replace(new RegExp(`\\s*\\(${escaped}\\)$`), '').trim();
}

export function formatOrderItemTitle(productName: string, variantName?: string | null): string {
  const baseName = stripDuplicateVariantSuffix(productName, variantName);
  if (!variantName || !variantName.trim()) return baseName;
  return `${baseName} (${variantName.trim()})`;
}

export const ORDER_FLOW: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED'];

/** Igual que lib/orders/flow.ts: un paso por vez; un retiro en local pasa de Listo a Entregado. */
export function nextOrderStatus(order: Pick<Order, 'status' | 'fulfillment_type'>): OrderStatus | null {
  if (order.status === 'READY' && order.fulfillment_type === 'PICKUP') return 'DELIVERED';
  const index = ORDER_FLOW.indexOf(order.status);
  return index >= 0 && index < ORDER_FLOW.length - 1 ? ORDER_FLOW[index + 1] : null;
}

export const PAYMENT_LABEL: Record<string, { label: string; color: string }> = {
  PAID: { label: 'Pagado', color: '#16A34A' },
  PARTIAL: { label: 'Pago parcial', color: '#D97706' },
  PENDING: { label: 'Sin pagar', color: '#DC2626' },
  REFUNDED: { label: 'Reembolsado', color: '#64748B' },
};

export type OrderPage = { orders: Order[]; pagination: { page: number; total: number; totalPages: number }; stats: Record<string, number> | null; meta: { todayCount: number; todayRevenue: number } | null };

export async function fetchOrders(params: {
  status: OrderStatus | 'ALL';
  search: string;
  page: number;
  withStats?: boolean;
  paymentStatus?: PaymentStatus | 'ALL';
  fulfillmentType?: OrderFulfillmentType | 'ALL';
  branchId?: string | null;
  sort?: OrderSortOption;
}) {
  const query = new URLSearchParams({ page: String(params.page), limit: '20', status: params.status });
  if (params.search.trim()) query.set('search', params.search.trim());
  if (params.withStats) query.set('include_stats', 'true');
  if (params.paymentStatus && params.paymentStatus !== 'ALL') query.set('payment_status', params.paymentStatus);
  if (params.fulfillmentType && params.fulfillmentType !== 'ALL') query.set('fulfillment_type', params.fulfillmentType);
  if (params.branchId && params.branchId !== 'ALL') query.set('branch_id', params.branchId);
  if (params.sort) query.set('sort', params.sort);
  const result = await apiFetch<{ data: OrderPage }>(`/api/orders?${query.toString()}`);
  return result.data;
}

const friendly = (error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    const details = error.body?.details as { message?: string }[] | undefined;
    return (Array.isArray(details) && details[0]?.message) || error.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

export async function changeOrderStatus(id: string, status: OrderStatus, note?: string) {
  try {
    const result = await apiFetch<{ data: Order }>(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, note: note?.trim() || null }) });
    return result.data;
  } catch (error) {
    throw new Error(friendly(error, 'No se pudo cambiar el estado.'));
  }
}

/** La API de cobro de pedidos pide un UUID como clave de idempotencia. */
export function uuid() {
  const hex = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16));
  hex[12] = '4';
  hex[16] = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const s = hex.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}

export async function collectOrderPayment(id: string, input: { amount: number; method: OrderPaymentMethod; reference?: string; note?: string }, key: string) {
  try {
    const result = await apiFetch<{ data: Order }>(`/api/orders/${id}/payment`, {
      method: 'PATCH',
      body: JSON.stringify({ collectionAmount: input.amount, paymentMethod: input.method, paymentReference: input.reference?.trim() || null, note: input.note?.trim() || null, idempotencyKey: key }),
    });
    return result.data;
  } catch (error) {
    throw new Error(friendly(error, 'No se pudo registrar el cobro.'));
  }
}

export type UpdateOrderPatch = {
  customer_name?: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  fulfillment_type?: OrderFulfillmentType;
  payment_method?: OrderPaymentMethod;
  shipping_cost?: number;
  discount_amount?: number;
  notes?: string | null;
};

export async function updateOrder(id: string, patch: UpdateOrderPatch) {
  try {
    const result = await apiFetch<{ data: Order }>(`/api/orders/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
    return result.data;
  } catch (error) {
    throw new Error(friendly(error, 'No se pudo actualizar el pedido.'));
  }
}

export function formatWaPhone(phone: string) {
  const digitsOnly = phone.replace(/\D/g, '');
  if (!digitsOnly) return '';
  return digitsOnly.startsWith('595')
    ? digitsOnly
    : digitsOnly.startsWith('0')
      ? `595${digitsOnly.slice(1)}`
      : digitsOnly;
}

export function orderWhatsAppMessage(order: Order, storeSlug?: string | null) {
  const statusLabel = ORDER_STATUS[order.status]?.label ?? order.status;
  const gs = (value: number) => `Gs. ${formatMobileNumber(Math.round(value))}`;
  const statusLine: Record<OrderStatus, string> = {
    PENDING: `Recibimos tu pedido #${order.order_number} y lo estamos revisando para confirmarlo.`,
    CONFIRMED: `Confirmamos tu pedido #${order.order_number}.`,
    PREPARING: `Estamos preparando tu pedido #${order.order_number}.`,
    READY: order.fulfillment_type === 'PICKUP'
      ? `¡Tu pedido #${order.order_number} ya está listo para retirar!`
      : `¡Tu pedido #${order.order_number} ya está listo para despacho!`,
    SHIPPED: `Tu pedido #${order.order_number} salió en camino.`,
    DELIVERED: `Tu pedido #${order.order_number} fue entregado. ¡Gracias por tu compra!`,
    CANCELLED: `Te informamos que tu pedido #${order.order_number} fue cancelado (${statusLabel}).`,
  };
  let trackUrl: string | null = null;
  if (storeSlug) {
    try {
      const siteUrl = getMobileRuntimeConfig().siteUrl;
      trackUrl = `${siteUrl}/${encodeURIComponent(storeSlug)}/track?orderNumber=${encodeURIComponent(order.order_number)}`;
    } catch {
      trackUrl = null;
    }
  }
  return [
    `¡Hola ${order.customer_name || 'Cliente'}! ${statusLine[order.status] ?? `Te escribimos por tu pedido #${order.order_number}.`}`,
    `Total: ${gs(order.total)}${order.amount_due > 0 ? ` · Saldo pendiente: ${gs(order.amount_due)}` : ''}.`,
    trackUrl ? `Seguí tu pedido acá: ${trackUrl}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

export function buildOrderWhatsAppUrl(order: Order, storeSlug?: string | null) {
  if (!order.customer_phone) return null;
  const phone = formatWaPhone(order.customer_phone);
  if (!phone) return null;
  return `https://wa.me/${phone}?text=${encodeURIComponent(orderWhatsAppMessage(order, storeSlug))}`;
}

export function orderSummaryText(order: Order, branchName?: string | null) {
  const gs = (value: number) => `Gs. ${formatMobileNumber(Math.round(value))}`;
  const status = ORDER_STATUS[order.status]?.label ?? order.status;
  const payment = PAYMENT_LABEL[String(order.payment_status).toUpperCase()]?.label ?? order.payment_status;
  const method = PAYMENT_METHOD_LABELS[order.payment_method] ?? order.payment_method;
  return [
    `Pedido #${order.order_number} · ${status}`,
    branchName ? `Sucursal: ${branchName}` : null,
    `Cliente: ${order.customer_name || 'Cliente'}`,
    order.customer_phone ? `Tel: ${order.customer_phone}` : null,
    `Entrega: ${order.fulfillment_type === 'DELIVERY' ? 'Delivery' : 'Retiro en local'}`,
    order.fulfillment_type === 'DELIVERY' && order.customer_address ? `Dirección: ${order.customer_address}` : null,
    '',
    ...order.order_items.map(
      (item) => `${item.quantity} × ${formatOrderItemTitle(item.product_name, item.variant_name)} — ${gs(item.subtotal)}`
    ),
    '',
    order.shipping_cost > 0 ? `Envío: ${gs(order.shipping_cost)}` : null,
    order.discount_amount > 0 ? `Descuento: −${gs(order.discount_amount)}` : null,
    `Total: ${gs(order.total)}`,
    `Pago: ${payment} (${method})${order.amount_due > 0 ? ` · Falta cobrar: ${gs(order.amount_due)}` : ''}`,
    order.notes ? `Notas: ${order.notes}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

const orderCache = new Map<string, Order>();
subscribePrivateCacheContext(() => orderCache.clear());
export const rememberOrders = (orders: Order[]) => orders.forEach((order) => orderCache.set(order.id, order));
export const cachedOrder = (id: string) => orderCache.get(id);
const orderListeners = new Set<(order: Order) => void>();
export function notifyOrder(order: Order) {
  orderCache.set(order.id, order);
  orderListeners.forEach((listener) => listener(order));
}
export function onOrderChanged(listener: (order: Order) => void) {
  orderListeners.add(listener);
  return () => {
    orderListeners.delete(listener);
  };
}
const createdOrderListeners = new Set<(order: Order) => void>();
export function notifyOrderCreated(order: Order) {
  orderCache.set(order.id, order);
  createdOrderListeners.forEach((listener) => listener(order));
}
export function onOrderCreated(listener: (order: Order) => void) {
  createdOrderListeners.add(listener);
  return () => {
    createdOrderListeners.delete(listener);
  };
}

export type OrderBranch = {
  id: string;
  name: string;
  code?: string | null;
  is_default?: boolean | null;
  is_primary?: boolean | null;
};

export type OrderCatalogKind = 'all' | 'part' | 'service';

export type OrderCreationItemInput = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

export type CreateOrderInput = {
  branchId: string;
  customerId: string;
  items: OrderCreationItemInput[];
  paymentMethod: OrderPaymentMethod;
  fulfillmentType: OrderFulfillmentType;
  deliveryContact?: { phone: string; address: string };
  shippingCost: number;
  discountAmount: number;
  notes?: string;
};

export type CreateOrderResult = {
  order: Order;
  idempotent: boolean;
};

export async function fetchOrderBranches() {
  const result = await apiFetch<{ branches: OrderBranch[] }>('/api/branches');
  return result.branches ?? [];
}

export const isOrderService = (
  product: Pick<Product, 'sku' | 'unit_measure'> & { category?: { name?: string | null } | null }
) => isPosService(product);

export function orderItemUnitPrice(
  product: Pick<Product, 'sale_price' | 'offer_price' | 'has_offer'>,
  variant?: Pick<ProductVariant, 'sale_price'> | null
) {
  const basePrice = Number(product.sale_price) || 0;
  const offerEnabled = product.has_offer !== false;
  const offerPrice = offerEnabled && product.offer_price != null ? Number(product.offer_price) : NaN;
  const hasProductOffer = Number.isFinite(offerPrice) && offerPrice > 0 && offerPrice < basePrice;

  if (variant) {
    const variantPrice = Math.max(0, Number(variant.sale_price) || 0);
    if (variantPrice <= 0) return 0;
    if (!hasProductOffer || basePrice <= 0) return variantPrice;
    const calculated = Math.round(variantPrice * (offerPrice / basePrice));
    return calculated > 0 && calculated < variantPrice ? calculated : variantPrice;
  }

  const price = offerEnabled && Number.isFinite(offerPrice) && offerPrice > 0 ? offerPrice : basePrice;
  return Number.isFinite(price) && price >= 0 ? price : 0;
}

export async function searchOrderCatalog(params: {
  query?: string;
  kind?: OrderCatalogKind;
  branchId?: string | null;
  page?: number;
}) {
  const search = new URLSearchParams({
    page: String(params.page ?? 1),
    per_page: '30',
    is_active: 'true',
    strict_branch_stock: 'true',
    sort: 'name',
    direction: 'asc',
  });
  if (params.query?.trim()) search.set('query', params.query.trim());
  if (params.kind && params.kind !== 'all') search.set('catalog_kind', params.kind);
  if (params.branchId) search.set('branchId', params.branchId);
  const result = await apiFetch<{ success: boolean; data: ProductPage }>(
    `/api/products?${search.toString()}`,
    params.branchId ? { headers: { 'x-branch-id': params.branchId } } : undefined
  );
  const page = result.data;
  return {
    products: (page.products ?? []).filter(isSellable),
    total: page.total ?? 0,
    truncated: Boolean(page.truncated),
  };
}

export async function fetchOrderProductById(productId: string, branchId?: string | null) {
  const search = new URLSearchParams({ variant_stock_scope: 'branch' });
  if (branchId) search.set('branchId', branchId);
  const result = await apiFetch<{ success: boolean; data: Product }>(
    `/api/products/${encodeURIComponent(productId)}?${search.toString()}`,
    branchId ? { headers: { 'x-branch-id': branchId } } : undefined
  );
  return isSellable(result.data) ? result.data : null;
}

export function newOrderKey() {
  return `app-ord-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function createOrder(input: CreateOrderInput, idempotencyKey: string): Promise<CreateOrderResult> {
  try {
    const result = await apiFetch<{ success: boolean; data: Order; idempotent?: boolean }>('/api/orders', {
      method: 'POST',
      headers: {
        ...(input.branchId ? { 'x-branch-id': input.branchId } : {}),
        'x-idempotency-key': idempotencyKey,
      },
      body: JSON.stringify({
        branchId: input.branchId,
        idempotencyKey,
        customerId: input.customerId,
        items: input.items.map((item) => ({
          productId: item.productId,
          ...(item.variantId ? { variantId: item.variantId } : {}),
          quantity: item.quantity,
        })),
        ...(input.fulfillmentType === 'DELIVERY' && input.deliveryContact
          ? {
              deliveryContact: {
                phone: input.deliveryContact.phone.trim(),
                address: input.deliveryContact.address.trim(),
              },
            }
          : {}),
        paymentMethod: input.paymentMethod,
        fulfillmentType: input.fulfillmentType,
        shippingCost: input.fulfillmentType === 'DELIVERY' ? input.shippingCost : 0,
        discountAmount: input.discountAmount,
        notes: input.notes?.trim() || null,
      }),
    });
    return { order: result.data, idempotent: Boolean(result.idempotent) };
  } catch (error) {
    throw new Error(friendly(error, 'No se pudo crear el pedido.'));
  }
}

export type PosCustomer = { id: string; name: string; email?: string | null; phone?: string | null; address?: string | null; ruc?: string | null; customer_type?: string | null; customer_code?: string | null };

/** Clientes para la venta (la API de clientes también sirve con el módulo POS). */
export async function searchPosCustomers(search: string) {
  const params = new URLSearchParams({ limit: '12' });
  if (search.trim()) params.set('search', search.trim());
  const result = await apiFetch<{ data: PosCustomer[] }>(`/api/customers?${params.toString()}`);
  return result.data ?? [];
}

export const isWholesaleCustomer = (customer: Pick<PosCustomer, 'customer_type'> | null) =>
  Boolean(customer && ['wholesale', 'mayorista'].includes(String(customer.customer_type ?? '').toLowerCase()));

export async function fetchOrder(id: string) {
  const result = await apiFetch<{ data: Order }>(`/api/orders/${id}`);
  return result.data;
}

export type OrderEvent = {
  id: string;
  kind: 'STATUS' | 'PAYMENT';
  from: string | null;
  to: string;
  note: string | null;
  amount: number | null;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  actor: string | null;
  createdAt: string;
};

export async function fetchOrderHistory(id: string) {
  const result = await apiFetch<{ data: { events: OrderEvent[] } }>(`/api/orders/${id}/history`);
  return result.data.events ?? [];
}

// ─── Caja: movimientos y cierre ────────────────────────────────────────────

export async function addCashMovement(input: { session: PosSession; type: 'cash_in' | 'cash_out'; amount: number; reason: string }) {
  try {
    await apiFetch('/api/pos/cash-movements', {
      method: 'POST',
      headers: { 'x-branch-id': input.session.branch.id },
      body: JSON.stringify({ sessionId: input.session.session?.id, branchId: input.session.branch.id, type: input.type, amount: input.amount, reason: input.reason.trim() }),
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'No se pudo registrar el movimiento.');
  }
}

export async function closeCashRegister(input: { session: PosSession; closingBalance: number }) {
  try {
    await apiFetch('/api/pos/cash-register', {
      method: 'PATCH',
      headers: { 'x-branch-id': input.session.branch.id },
      body: JSON.stringify({ sessionId: input.session.session?.id, branchId: input.session.branch.id, closingBalance: input.closingBalance }),
    });
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'No se pudo cerrar la caja.');
  }
}

// ─── Clientes nuevos desde la venta ────────────────────────────────────────

export type PosDuplicate = { customerId: string; customerName: string; field: string; value: string };

export class PosDuplicateError extends Error {
  constructor(message: string, readonly duplicates: PosDuplicate[]) {
    super(message);
  }
}

export async function createPosCustomer(input: { name: string; phone?: string; ruc?: string; email?: string; address?: string; wholesale?: boolean }) {
  const clean = (value?: string) => (value && value.trim() ? value.trim() : null);
  const name = input.name.trim().replace(/\s+/g, ' ');
  const [first, ...rest] = name.split(' ');
  try {
    const result = await apiFetch<{ data: PosCustomer }>('/api/customers', {
      method: 'POST',
      body: JSON.stringify({
        name,
        first_name: first || null,
        last_name: rest.join(' ') || null,
        phone: clean(input.phone),
        ruc: clean(input.ruc),
        email: clean(input.email) ?? '',
        address: clean(input.address),
        customer_type: input.wholesale ? 'wholesale' : null,
      }),
    });
    return result.data;
  } catch (error) {
    if (error instanceof ApiError && error.body?.code === 'CUSTOMER_DUPLICATE') {
      throw new PosDuplicateError(error.message, (error.body.duplicates as PosDuplicate[]) ?? []);
    }
    const details = error instanceof ApiError ? (error.body?.details as { message?: string }[] | undefined) : undefined;
    throw new Error((Array.isArray(details) && details[0]?.message) || (error instanceof Error ? error.message : 'No se pudo crear el cliente.'));
  }
}

// ─── Ventas del día ────────────────────────────────────────────────────────

export type SaleRow = {
  id: string;
  code?: string | null;
  total_amount: number;
  discount_amount?: number | null;
  payment_method?: string | null;
  status?: string | null;
  created_at: string;
  customer?: { first_name?: string | null; last_name?: string | null; phone?: string | null } | null;
  sale_items?: { id: string; quantity: number; unit_price: number; subtotal?: number | null; product?: { name?: string | null } | null }[];
};

export async function fetchTodaySales() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const result = await apiFetch<{ data: { sales: SaleRow[] } }>(`/api/sales?per_page=50&start_date=${encodeURIComponent(start.toISOString())}`);
  return result.data.sales ?? [];
}

export const SALE_METHOD: Record<string, string> = {
  efectivo: 'Efectivo',
  cash: 'Efectivo',
  tarjeta: 'Tarjeta',
  card: 'Tarjeta',
  transferencia: 'Transferencia',
  transfer: 'Transferencia',
  mixed: 'Mixto',
  credit: 'Crédito',
};
