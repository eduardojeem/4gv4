import { apiFetch, ApiError } from './api';

/**
 * Toma de inventario, con las mismas APIs que /dashboard/inventory-count: se
 * abre una toma (foto del stock de la sucursal), se cuenta producto por
 * producto (a mano o escaneando) y al aplicarla el sistema ajusta el stock.
 */

export type CountStatus = 'counting' | 'applied' | 'cancelled';

export const COUNT_STATUS: Record<CountStatus, { label: string; color: string }> = {
  counting: { label: 'Contando', color: '#2563EB' },
  applied: { label: 'Aplicada', color: '#16A34A' },
  cancelled: { label: 'Anulada', color: '#64748B' },
};

type Named = { name: string } | { name: string }[] | null;
const nameOf = (value: Named | undefined) => (Array.isArray(value) ? value[0]?.name : value?.name) ?? null;

export type InventoryCount = {
  id: string;
  number: number;
  name: string;
  status: CountStatus;
  branch_id: string;
  notes: string | null;
  created_at: string;
  applied_at: string | null;
  summary: Record<string, number> | null;
  branchName: string | null;
  categoryName: string | null;
};

type CountRow = Omit<InventoryCount, 'branchName' | 'categoryName'> & { branches?: Named; categories?: Named };
const toCount = (row: CountRow): InventoryCount => ({ ...row, branchName: nameOf(row.branches), categoryName: nameOf(row.categories) });

export type CountItem = {
  id: string;
  product_id: string;
  variant_id: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  category_name: string | null;
  /** No llega si el usuario no puede ver costos. */
  unit_cost?: number | null;
  system_qty: number;
  counted_qty: number | null;
  system_qty_at_count: number | null;
  counted_at: string | null;
  applied_delta: number | null;
};

const fail = (error: unknown, fallback: string): never => {
  const text = error instanceof ApiError || error instanceof Error ? error.message : '';
  throw new Error(text || fallback);
};

export async function fetchCounts() {
  const result = await apiFetch<{ available: boolean; counts: CountRow[]; progress?: Record<string, { total: number; counted: number }>; categories?: { id: string; name: string }[]; canAdjust?: boolean }>('/api/inventory-counts');
  return { available: result.available, counts: (result.counts ?? []).map(toCount), progress: result.progress ?? {}, categories: result.categories ?? [], canAdjust: Boolean(result.canAdjust) };
}

export async function fetchBranches() {
  const result = await apiFetch<{ branches: { id: string; name: string }[] }>('/api/branches');
  return result.branches ?? [];
}

export async function createCount(input: { branchId: string; name: string; categoryId: string | null; notes?: string }) {
  try {
    const result = await apiFetch<{ count: { id: string; number: number }; items: number }>('/api/inventory-counts', {
      method: 'POST',
      body: JSON.stringify({ branch_id: input.branchId, name: input.name.trim(), category_id: input.categoryId, notes: input.notes?.trim() || null }),
    });
    return result;
  } catch (error) {
    // «Ya hay una toma abierta»: se devuelve cuál, para abrirla.
    if (error instanceof ApiError && error.status === 409 && typeof error.body?.countId === 'string') {
      throw Object.assign(new Error(error.message), { openCountId: error.body.countId as string });
    }
    return fail(error, 'No se pudo abrir la toma.');
  }
}

export async function fetchCount(id: string) {
  const result = await apiFetch<{ count: CountRow; items: CountItem[]; canAdjust: boolean }>(`/api/inventory-counts/${id}`);
  return { count: toCount(result.count), items: result.items ?? [], canAdjust: result.canAdjust };
}

/** Guarda de a 200 (lo que acepta la API). null borra lo contado. */
export async function saveCounts(id: string, updates: { item_id: string; counted_qty: number | null; match_system?: boolean }[]) {
  const saved: CountItem[] = [];
  for (let index = 0; index < updates.length; index += 200) {
    try {
      const result = await apiFetch<{ items: CountItem[] }>(`/api/inventory-counts/${id}`, { method: 'PATCH', body: JSON.stringify({ updates: updates.slice(index, index + 200) }) });
      saved.push(...(result.items ?? []));
    } catch (error) {
      fail(error, 'No se pudo guardar el conteo.');
    }
  }
  return saved;
}

export async function finishCount(id: string, action: 'apply' | 'cancel') {
  try {
    return await apiFetch<{ ok: boolean; summary?: Record<string, number> }>(`/api/inventory-counts/${id}`, { method: 'POST', body: JSON.stringify({ action }) });
  } catch (error) {
    return fail(error, action === 'apply' ? 'No se pudo aplicar la toma. No se cambió ningún stock.' : 'No se pudo anular la toma.');
  }
}

/** Unidades de más (+) o de menos (−) contra el sistema. null = sin contar. */
export function countDifference(item: Pick<CountItem, 'counted_qty' | 'system_qty' | 'system_qty_at_count'>) {
  if (item.counted_qty === null || item.counted_qty === undefined) return null;
  return item.counted_qty - (item.system_qty_at_count ?? item.system_qty);
}

export function summarizeCount(items: CountItem[]) {
  let counted = 0;
  let withDifference = 0;
  let unitsIn = 0;
  let unitsOut = 0;
  let valueDifference = 0;
  const costsKnown = items.every(item => item.unit_cost != null && Number.isFinite(Number(item.unit_cost)))
  for (const item of items) {
    const diff = countDifference(item);
    if (diff === null) continue;
    counted += 1;
    if (diff === 0) continue;
    withDifference += 1;
    if (diff > 0) unitsIn += diff;
    else unitsOut += -diff;
    valueDifference += diff * Number(item.unit_cost || 0);
  }
  return { total: items.length, counted, notCounted: items.length - counted, withDifference, unitsIn, unitsOut, valueDifference: costsKnown ? Math.round(valueDifference) : null, progress: items.length ? Math.round((counted / items.length) * 100) : 0 };
}

const normalize = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();

/** Código de barras o SKU exacto (lo que lee el escáner). */
export function findByCode(items: CountItem[], code: string) {
  const wanted = normalize(code);
  if (!wanted) return null;
  return items.find((item) => normalize(item.barcode) === wanted) ?? items.find((item) => normalize(item.sku) === wanted) ?? null;
}

/** «3*7791234» suma 3 unidades; sin multiplicador suma 1 (cajas cerradas). */
export function parseScan(input: string) {
  const match = input.trim().match(/^(\d{1,5})\s*[*xX]\s*(.+)$/);
  if (match) return { quantity: Math.max(1, Number(match[1])), code: match[2].trim() };
  return { quantity: 1, code: input.trim() };
}
