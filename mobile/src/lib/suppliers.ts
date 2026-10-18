import { apiFetch, ApiError } from './api';

/** Proveedores, con la misma API que /dashboard/suppliers. */

export type Supplier = {
  id: string;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  tax_id?: string | null;
  website?: string | null;
  payment_terms?: string | null;
  credit_limit?: number | null;
  current_debt?: number | null;
  rating?: number | null;
  status?: string | null;
  is_active?: boolean | null;
  category?: string | null;
  notes?: string | null;
  created_at?: string | null;
  productCount?: number;
};

export type SupplierFilter = 'all' | 'active' | 'inactive';

const message = (error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    const details = error.body?.details as { path?: string[]; message?: string }[] | undefined;
    const first = Array.isArray(details) ? details[0] : undefined;
    if (first?.path?.[0] === 'name') return 'El nombre debe tener al menos 2 letras.';
    if (first?.path?.[0] === 'email') return 'Revisá el email.';
    return error.message || fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
};

export const isActiveSupplier = (supplier: Pick<Supplier, 'status' | 'is_active'>) => supplier.is_active !== false && supplier.status !== 'inactive';

export async function fetchSuppliers(params: { search: string; filter: SupplierFilter; page: number }) {
  // page empieza en 0 en esta API.
  const query = new URLSearchParams({ page: String(params.page), pageSize: '30' });
  // La API arma un filtro con el texto: sin comas ni paréntesis para no romperlo.
  const search = params.search.replace(/[,()%]/g, ' ').trim();
  if (search) query.set('search', search);
  if (params.filter !== 'all') query.set('is_active', params.filter === 'active' ? 'true' : 'false');
  const result = await apiFetch<{ data: Supplier[]; count: number }>(`/api/suppliers?${query.toString()}`);
  return { rows: result.data ?? [], total: result.count ?? 0 };
}

export type SupplierInput = {
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
  address?: string;
  city?: string;
  category?: string;
  payment_terms?: string;
  website?: string;
  credit_limit?: number | null;
  current_debt?: number | null;
  rating?: number | null;
  notes?: string;
  is_active: boolean;
};

const payload = (input: SupplierInput) => {
  const clean = (value?: string) => (value && value.trim() ? value.trim() : null);
  return {
    name: input.name.trim(),
    contact_name: clean(input.contact_name),
    phone: clean(input.phone),
    email: clean(input.email) ?? '',
    tax_id: clean(input.tax_id),
    address: clean(input.address),
    city: clean(input.city),
    category: clean(input.category),
    payment_terms: clean(input.payment_terms),
    website: clean(input.website),
    credit_limit: input.credit_limit ?? null,
    current_debt: input.current_debt ?? null,
    rating: input.rating ?? null,
    notes: clean(input.notes),
    is_active: input.is_active,
  };
};

export async function createSupplier(input: SupplierInput) {
  try {
    return (await apiFetch<{ data: Supplier }>('/api/suppliers', { method: 'POST', body: JSON.stringify(payload(input)) })).data;
  } catch (error) {
    throw new Error(message(error, 'No se pudo crear el proveedor.'));
  }
}

export async function updateSupplier(id: string, input: Partial<SupplierInput>) {
  try {
    const body = 'name' in input && input.name !== undefined ? { id, ...payload(input as SupplierInput) } : { id, ...input };
    return (await apiFetch<{ data: Supplier }>('/api/suppliers', { method: 'PUT', body: JSON.stringify(body) })).data;
  } catch (error) {
    throw new Error(message(error, 'No se pudo guardar el proveedor.'));
  }
}

export async function deleteSupplier(id: string) {
  try {
    await apiFetch(`/api/suppliers?ids=${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (error) {
    throw new Error(message(error, 'No se pudo eliminar el proveedor. Si tiene productos asignados, desactivalo.'));
  }
}

/** Para editar: la API no tiene GET por id, se busca en la lista. */
export async function fetchSupplier(id: string) {
  const cached = supplierCache.get(id);
  if (cached) return cached;
  for (let page = 0; page < 20; page += 1) {
    const result = await apiFetch<{ data: Supplier[]; count: number }>(`/api/suppliers?page=${page}&pageSize=100`);
    const found = (result.data ?? []).find((row) => row.id === id);
    if (found) return found;
    if ((result.data ?? []).length < 100) break;
  }
  throw new Error('Proveedor no encontrado.');
}

const supplierCache = new Map<string, Supplier>();
export const rememberSuppliers = (rows: Supplier[]) => rows.forEach((row) => supplierCache.set(row.id, row));
