import { apiFetch, ApiError } from './api';

/**
 * Clientes y créditos en la app: las mismas APIs que la web (/api/customers,
 * sus métricas, historial y deudas, /api/credits y el cobro de deudas).
 */

export type Customer = {
  id: string;
  name: string;
  customer_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  phone?: string | null;
  alternate_phone?: string | null;
  alternate_phone_label?: string | null;
  email?: string | null;
  ruc?: string | null;
  address?: string | null;
  city?: string | null;
  customer_type?: string | null;
  status?: string | null;
  credit_limit?: number | null;
  lifetime_value?: number | null;
  total_purchases?: number | null;
  loyalty_points?: number | null;
  notes?: string | null;
  created_at?: string | null;
};

export type CustomerFilter = 'all' | 'debt' | 'wholesale' | 'empresa' | 'inactive';

const friendly = (error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    const details = error.body?.details as { message?: string }[] | undefined;
    return (Array.isArray(details) && details[0]?.message) || error.message || fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
};

export async function fetchCustomers(params: { search: string; filter: CustomerFilter; page: number }) {
  const query = new URLSearchParams({ page: String(params.page), limit: '30', sort: 'created_at', order: 'desc' });
  if (params.search.trim()) query.set('search', params.search.trim());
  if (params.filter === 'debt') query.set('has_debt', 'true');
  if (params.filter === 'wholesale') query.set('customer_type', 'wholesale');
  if (params.filter === 'empresa') query.set('customer_type', 'empresa');
  if (params.filter === 'inactive') query.set('status', 'inactive');
  const result = await apiFetch<{ data: Customer[]; summary?: { total: number; active: number }; pagination: { total: number; totalPages: number } }>(`/api/customers?${query.toString()}`);
  return result;
}

export async function fetchCustomer(id: string) {
  const result = await apiFetch<{ data: Customer[] }>(`/api/customers?id=${encodeURIComponent(id)}&summary=0`);
  const customer = result.data?.[0];
  if (!customer) throw new Error('Cliente no encontrado.');
  return customer;
}

export type CustomerInput = {
  name: string;
  phone?: string;
  alternate_phone?: string;
  alternate_phone_label?: string;
  email?: string;
  ruc?: string;
  address?: string;
  city?: string;
  customer_type?: 'regular' | 'wholesale' | 'empresa';
  notes?: string;
  /** Solo se manda si cambió: con la ficha para crédito obligatoria, el servidor lo rechaza. */
  credit_limit?: number;
};

export type Duplicate = { customerId: string; customerName: string; field: string; value: string };
export class DuplicateError extends Error {
  constructor(message: string, readonly duplicates: Duplicate[]) {
    super(message);
  }
}

const payload = (input: CustomerInput) => {
  const clean = (value?: string) => (value && value.trim() ? value.trim() : null);
  const name = input.name.trim().replace(/\s+/g, ' ');
  const [first, ...rest] = name.split(' ');
  const company = input.customer_type === 'empresa';
  return {
    name,
    first_name: company ? null : first || null,
    last_name: company ? null : rest.join(' ') || null,
    phone: clean(input.phone),
    alternate_phone: clean(input.alternate_phone),
    alternate_phone_label: clean(input.alternate_phone) ? clean(input.alternate_phone_label) : null,
    email: clean(input.email) ?? '',
    ruc: clean(input.ruc),
    address: clean(input.address),
    city: clean(input.city),
    customer_type: input.customer_type ?? 'regular',
    notes: clean(input.notes),
    ...(input.credit_limit !== undefined ? { credit_limit: Math.max(0, Math.round(input.credit_limit)) } : {}),
  };
};

const rethrow = (error: unknown, fallback: string): never => {
  if (error instanceof ApiError && error.body?.code === 'CREDIT_LIMIT_REQUIRES_DECISION') {
    throw new Error('En tu empresa el límite se aprueba desde la Ficha para crédito (en la web). Guardá sin cambiar el límite.');
  }
  if (error instanceof ApiError && error.body?.code === 'CUSTOMER_DUPLICATE') {
    throw new DuplicateError(error.message, (error.body.duplicates as Duplicate[]) ?? []);
  }
  throw new Error(friendly(error, fallback));
};

export async function createCustomer(input: CustomerInput) {
  try {
    return (await apiFetch<{ data: Customer }>('/api/customers', { method: 'POST', body: JSON.stringify(payload(input)) })).data;
  } catch (error) {
    return rethrow(error, 'No se pudo crear el cliente.');
  }
}

export async function updateCustomer(id: string, input: CustomerInput) {
  try {
    return (await apiFetch<{ data: Customer }>('/api/customers', { method: 'PUT', body: JSON.stringify({ id, ...payload(input) }) })).data;
  } catch (error) {
    return rethrow(error, 'No se pudieron guardar los cambios.');
  }
}

/** La API no borra clientes con ventas, créditos o reparaciones: devuelve el motivo. */
export async function deleteCustomer(id: string) {
  try {
    await apiFetch(`/api/customers?ids=${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (error) {
    throw new Error(friendly(error, 'No se pudo eliminar el cliente.'));
  }
}

export type CustomerMetrics = {
  repairs: number;
  purchases: number;
  billed: number;
  posBilled: number;
  webBilled: number;
  repairsBilled: number;
  loyaltyPoints: number | null;
  creditBalance: number;
};

export async function fetchCustomerMetrics(id: string) {
  return (await apiFetch<{ metrics: CustomerMetrics }>(`/api/customers/${id}/metrics`)).metrics;
}

export type HistoryItem = {
  id: string;
  kind: 'sale' | 'repair';
  date: string;
  reference: string;
  title: string;
  detail: string;
  total: number;
  paid: number;
  balance: number | null;
  payment: 'paid' | 'partial' | 'unpaid' | 'credit' | 'credit_settled' | 'no_charge';
  overdue: boolean;
  status: string;
  nextDueDate?: string | null;
};

export async function fetchCustomerHistory(id: string) {
  const result = await apiFetch<{ items: HistoryItem[]; summary: { salesCount: number; repairsCount: number; owed: number; overdueCount: number } }>(`/api/customers/${id}/history`);
  return result;
}

export type Debt = {
  id: string;
  type: 'repair' | 'installment' | 'sale';
  title: string;
  subtitle?: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  dueDate?: string;
  isOverdue: boolean;
  status: string;
  creditId?: string;
  collectable: boolean;
};

export type DebtSummary = {
  branchId: string | null;
  creditLimit: number;
  debts: Debt[];
  totalDebt: number;
  collectableDebt: number;
  overdueDebt: number;
  storeBalance: number;
};

export async function fetchCustomerDebts(id: string) {
  return apiFetch<DebtSummary>(`/api/customers/${id}/collect-payment`);
}

export type CreditRow = {
  id: string;
  customer_id: string;
  principal: number;
  interest_rate: number;
  term_months: number;
  start_date: string;
  status: 'active' | 'completed' | 'defaulted' | 'cancelled';
  credit_code?: string | null;
};
export type InstallmentRow = {
  id: string;
  credit_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  amount_paid?: number | null;
  status: 'pending' | 'paid' | 'late';
  paid_at?: string | null;
};
export type PaymentRow = { id: string; credit_id: string; installment_id?: string | null; amount: number; payment_method?: string | null; created_at: string; notes?: string | null };

export async function fetchCustomerCredits(id: string) {
  return apiFetch<{ credits: CreditRow[]; installments: InstallmentRow[]; payments: PaymentRow[] }>('/api/credits/batch', {
    method: 'POST',
    body: JSON.stringify({ customerIds: [id] }),
  });
}

// ─── Cobro de deudas (cuotas y reparaciones) ───────────────────────────────

export type CollectInput = {
  amount: number;
  method: 'cash' | 'card' | 'transfer';
  /** auto = de la más vieja a la más nueva; manual = a lo indicado en allocations. */
  allocations?: { id: string; type: 'installment' | 'repair'; amount: number }[];
  referenceNumber?: string;
  voucherNumber?: string;
  lastFourDigits?: string;
  notes?: string;
  excessToStoreCredit?: boolean;
  branchId?: string | null;
};

export type CollectResult = { receiptNumber: string; totalApplied: number; excessToStoreCredit: number; appliedAllocations: { id: string; title: string; allocatedAmount: number; newPending: number; fullyPaid: boolean }[] };

export function newCollectionKey() {
  return `app-collect-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function collectPayment(customerId: string, input: CollectInput, idempotencyKey: string) {
  try {
    return await apiFetch<CollectResult>(`/api/customers/${customerId}/collect-payment`, {
      method: 'POST',
      headers: input.branchId ? { 'x-branch-id': input.branchId } : undefined,
      body: JSON.stringify({
        amount: Math.round(input.amount),
        paymentMethod: input.method,
        mode: input.allocations?.length ? 'manual' : 'auto',
        ...(input.allocations?.length ? { allocations: input.allocations.map((row) => ({ ...row, amount: Math.round(row.amount) })) } : {}),
        referenceNumber: input.referenceNumber?.trim() || undefined,
        voucherNumber: input.voucherNumber?.trim() || undefined,
        lastFourDigits: input.lastFourDigits?.trim() || undefined,
        notes: input.notes?.trim() || undefined,
        creditExcessToStoreCredit: Boolean(input.excessToStoreCredit),
        idempotencyKey,
        ...(input.branchId ? { branchId: input.branchId } : {}),
      }),
    });
  } catch (error) {
    throw new Error(friendly(error, 'No se pudo registrar el cobro.'));
  }
}

// ─── Cartera de créditos ───────────────────────────────────────────────────

export type PortfolioSummary = {
  outstanding: number;
  overdue: number;
  paid: number;
  dueToday: number;
  distinctCustomers: number;
  pendingCount: number;
  overdueCount: number;
  totalFinanced: number;
  recoveryRate: number;
};

export type PortfolioCredit = CreditRow & { customer_name?: string | null; customer_phone?: string | null };

export type PortfolioStatus = '' | 'pending' | 'late' | 'paid';

/** Cuotas de la cartera ordenadas por vencimiento (la API filtra y pagina de a 100). */
export async function fetchPortfolio(params: { status: PortfolioStatus; page: number; customerName?: string }) {
  const query = new URLSearchParams({ page: String(params.page), per_page: '50' });
  if (params.status) query.set('status', params.status);
  if (params.customerName?.trim()) query.set('customerName', params.customerName.trim());
  const result = await apiFetch<{
    data: { credits: PortfolioCredit[]; installments: InstallmentRow[]; globalSummary: PortfolioSummary; filteredSummary: PortfolioSummary; pagination: { total: number; perPage: number } };
  }>(`/api/credits?${query.toString()}`);
  return result.data;
}

export const CREDIT_STATUS: Record<CreditRow['status'], { label: string; color: string }> = {
  active: { label: 'Activo', color: '#2563EB' },
  completed: { label: 'Pagado', color: '#16A34A' },
  defaulted: { label: 'En mora', color: '#DC2626' },
  cancelled: { label: 'Anulado', color: '#64748B' },
};

export const isWholesale = (customer: Pick<Customer, 'customer_type'>) => ['wholesale', 'mayorista'].includes(String(customer.customer_type ?? '').toLowerCase());

export const dateOnly = (value?: string | null) => {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const creditCode = (credit: Pick<CreditRow, 'id' | 'credit_code'>) => credit.credit_code?.trim() || `CR-${credit.id.slice(0, 8).toUpperCase()}`;
