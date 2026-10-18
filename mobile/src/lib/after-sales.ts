import { apiFetch, ApiError } from './api';

/**
 * Posventa (garantías, cambios y devoluciones), con las mismas APIs que
 * /dashboard/after-sales. Las reglas (plazos, topes de reintegro, stock del
 * reemplazo, caja abierta) las valida el servidor en una sola transacción.
 */

export type CaseStatus = 'open' | 'approved' | 'rejected' | 'completed' | 'cancelled';
export type RequestType = 'repair_warranty' | 'product_warranty' | 'exchange' | 'return';
export type SourceType = 'repair' | 'sale';

export const STATUS: Record<CaseStatus, { label: string; color: string }> = {
  open: { label: 'Abierto', color: '#64748B' },
  approved: { label: 'Aprobado', color: '#2563EB' },
  rejected: { label: 'Rechazado', color: '#DC2626' },
  completed: { label: 'Completado', color: '#16A34A' },
  cancelled: { label: 'Cancelado', color: '#94A3B8' },
};

export const REQUEST: Record<RequestType, { label: string; icon: string; color: string; hint: string }> = {
  repair_warranty: { label: 'Garantía de reparación', icon: 'construct-outline', color: '#2563EB', hint: 'El equipo volvió a fallar por lo mismo que se reparó.' },
  product_warranty: { label: 'Garantía de producto', icon: 'shield-checkmark-outline', color: '#4F46E5', hint: 'El producto vendido salió defectuoso.' },
  exchange: { label: 'Cambio', icon: 'swap-horizontal-outline', color: '#7C3AED', hint: 'El cliente se lleva otro producto en su lugar.' },
  return: { label: 'Devolución', icon: 'return-down-back-outline', color: '#D97706', hint: 'Se devuelve el producto y se reintegra el dinero.' },
};

/** Espeja NEXT_ACTIONS de la web (y las transiciones que acepta la API). */
export const NEXT_ACTIONS: Record<CaseStatus, { status: CaseStatus; label: string; destructive?: boolean }[]> = {
  open: [
    { status: 'approved', label: 'Aprobar' },
    { status: 'rejected', label: 'Rechazar', destructive: true },
    { status: 'cancelled', label: 'Cancelar', destructive: true },
  ],
  approved: [
    { status: 'completed', label: 'Completar' },
    { status: 'cancelled', label: 'Cancelar', destructive: true },
  ],
  rejected: [],
  completed: [],
  cancelled: [],
};

export const REJECT_REASONS = ['Fuera del plazo', 'Daño por mal uso', 'No se comprobó la falla', 'No cumple la política'];

export type RestockAction = 'sellable' | 'quarantine' | 'none';
export const RESTOCK: Record<RestockAction, { label: string; hint: string }> = {
  sellable: { label: 'Vuelve a la venta', hint: 'Suma al stock disponible.' },
  quarantine: { label: 'A revisión (con falla)', hint: 'No se vende hasta revisarlo.' },
  none: { label: 'No vuelve al stock', hint: 'Se descarta o queda en garantía del proveedor.' },
};

export function defaultRestock(type: RequestType): RestockAction {
  if (type === 'product_warranty') return 'quarantine';
  if (type === 'exchange' || type === 'return') return 'sellable';
  return 'none';
}

type One<T> = T | T[] | null | undefined;
const first = <T,>(value: One<T>) => (Array.isArray(value) ? (value[0] ?? null) : (value ?? null));

export type AfterSalesCase = {
  id: string;
  case_number: string | null;
  source_type: SourceType;
  request_type: RequestType;
  status: CaseStatus;
  customer_id: string | null;
  repair_id: string | null;
  sale_id: string | null;
  product_id: string | null;
  quantity: number;
  reason: string;
  notes: string | null;
  refund_amount: number | null;
  refund_method: 'cash' | 'store_credit' | null;
  restock_action: RestockAction | null;
  price_difference: number | null;
  replacement_quantity: number | null;
  created_at: string;
  resolved_at: string | null;
  customer: { name: string | null; phone: string | null } | null;
  repair: { ticket_number: string | null; device_brand: string | null; device_model: string | null; final_cost: number | null; warranty_expires_at: string | null } | null;
  sale: { code: string | null; total_amount: number | null } | null;
  product: { name: string | null; sku: string | null } | null;
  replacement: { name: string | null } | null;
  generatedRepair: { ticket_number: string | null; status: string | null } | null;
};

type RawCase = Omit<AfterSalesCase, 'customer' | 'repair' | 'sale' | 'product' | 'replacement' | 'generatedRepair'> & {
  customers?: One<AfterSalesCase['customer']>;
  repairs?: One<AfterSalesCase['repair']>;
  sales?: One<AfterSalesCase['sale']>;
  products?: One<AfterSalesCase['product']>;
  replacement_product?: AfterSalesCase['replacement'];
  generated_repair?: AfterSalesCase['generatedRepair'];
};

const toCase = (row: RawCase): AfterSalesCase => ({
  ...row,
  customer: first(row.customers),
  repair: first(row.repairs),
  sale: first(row.sales),
  product: first(row.products),
  replacement: row.replacement_product ?? null,
  generatedRepair: row.generated_repair ?? null,
});

const fail = (error: unknown, fallback: string): never => {
  const text = error instanceof ApiError || error instanceof Error ? error.message : '';
  throw new Error(text || fallback);
};

export async function fetchCases(params: { status: CaseStatus | 'all'; search: string; page: number }) {
  const query = new URLSearchParams({ page: String(params.page), limit: '30' });
  if (params.status !== 'all') query.set('status', params.status);
  if (params.search.trim()) query.set('search', params.search.trim());
  const result = await apiFetch<{ data: RawCase[]; pagination: { total: number; totalPages: number } }>(`/api/after-sales?${query.toString()}`);
  return { rows: (result.data ?? []).map(toCase), total: result.pagination?.total ?? 0, totalPages: result.pagination?.totalPages ?? 1 };
}

export async function fetchSummary() {
  return (await apiFetch<{ data: { open: number; approved: number; completed: number; rejected: number; refunds: number; quarantined: number } }>('/api/after-sales/summary')).data;
}

export async function updateCase(
  id: string,
  input: { status: CaseStatus; notes?: string | null; refund_amount?: number | null; refund_method?: 'cash' | 'store_credit' | null; restock_action?: RestockAction | null }
) {
  try {
    return await apiFetch<{ data: RawCase; refund?: { amount: number; method: string } }>(`/api/after-sales/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
  } catch (error) {
    return fail(error, 'No se pudo actualizar el caso.');
  }
}

// ─── Alta: buscar el comprobante de origen ─────────────────────────────────

export type SaleSource = {
  id: string;
  label: string;
  subtitle: string;
  amount: number;
  date: string | null;
  items: { id: string; product_id: string | null; name: string; quantity: number; unitPrice: number; warrantyMonths: number; returnWindowDays: number; exchangeWindowDays: number }[];
};
export type RepairSource = { id: string; label: string; subtitle: string; device: string; warrantyMonths: number | null; warrantyExpiresAt: string | null; warrantyExpired: boolean; date: string | null };

export async function searchSales(q: string) {
  const query = new URLSearchParams({ type: 'sale', limit: '15' });
  if (q.trim()) query.set('q', q.trim());
  return (await apiFetch<{ data: SaleSource[] }>(`/api/after-sales/sources?${query.toString()}`)).data ?? [];
}

export async function searchRepairs(q: string) {
  const query = new URLSearchParams({ type: 'repair', limit: '15' });
  if (q.trim()) query.set('q', q.trim());
  return (await apiFetch<{ data: RepairSource[] }>(`/api/after-sales/sources?${query.toString()}`)).data ?? [];
}

export type ReplacementProduct = { id: string; name: string; price: number; stock: number };

export async function searchReplacement(q: string): Promise<ReplacementProduct[]> {
  const result = await apiFetch<{ data?: Record<string, unknown>[]; products?: Record<string, unknown>[] }>(`/api/products?query=${encodeURIComponent(q.trim())}&limit=8`);
  return (result.data ?? result.products ?? []).slice(0, 8).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? 'Producto'),
    price: Number(row.sale_price ?? 0),
    stock: Number(row.stock_quantity ?? 0),
  }));
}

export async function createCase(input: {
  source_type: SourceType;
  request_type: RequestType;
  repair_id?: string | null;
  sale_id?: string | null;
  sale_item_id?: string | null;
  product_id?: string | null;
  quantity: number;
  reason: string;
  notes?: string | null;
  refund_amount?: number | null;
  replacement_product_id?: string | null;
  replacement_quantity?: number | null;
  price_difference?: number | null;
}) {
  try {
    return toCase((await apiFetch<{ data: RawCase }>('/api/after-sales', { method: 'POST', body: JSON.stringify(input) })).data);
  } catch (error) {
    return fail(error, 'No se pudo registrar el reclamo.');
  }
}

/** Plazo del producto según el tipo de reclamo, contado desde la venta. */
export function windowFor(type: RequestType, item: SaleSource['items'][number], saleDate: string | null) {
  if (!saleDate) return null;
  const start = new Date(saleDate);
  const end = new Date(start);
  if (type === 'product_warranty') end.setMonth(end.getMonth() + (item.warrantyMonths || 0));
  else end.setDate(end.getDate() + (type === 'return' ? item.returnWindowDays : item.exchangeWindowDays));
  return { until: end, expired: end.getTime() < Date.now() };
}
