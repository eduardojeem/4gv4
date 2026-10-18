import { apiFetch, ApiError } from './api';

/**
 * Categorías y marcas: las mismas APIs que las secciones de la web
 * (/api/categories, /api/brands y sus catálogos globales).
 */

export type CategoryRow = {
  id: string;
  name: string;
  description?: string | null;
  parent_id?: string | null;
  global_category_id?: string | null;
  is_active?: boolean | null;
  products_count?: number;
};

export type BrandRow = {
  id: string;
  name: string;
  description?: string | null;
  website?: string | null;
  logo_url?: string | null;
  global_brand_id?: string | null;
  is_active?: boolean | null;
  stats?: { product_count?: number };
};

export type GlobalCategory = { id: string; name: string; parent_id?: string | null };
export type GlobalBrandOption = { id: string; name: string; logo_url?: string | null; already_added?: boolean; own_brand_id?: string | null };

const message = (error: unknown, fallback: string) => {
  if (error instanceof ApiError) {
    const details = error.body?.details as { message?: string }[] | undefined;
    if (Array.isArray(details) && details[0]?.message) return details[0].message;
    return error.message || fallback;
  }
  return error instanceof Error && error.message ? error.message : fallback;
};

const wrap = async <T>(run: () => Promise<T>, fallback: string) => {
  try {
    return await run();
  } catch (error) {
    throw new Error(message(error, fallback));
  }
};

// ─── Categorías ────────────────────────────────────────────────────────────

export const fetchCategoryRows = () =>
  wrap(async () => (await apiFetch<{ data: CategoryRow[] }>('/api/categories')).data ?? [], 'No se pudieron cargar las categorías.');

export type CategoryInput = { name: string; description?: string | null; parent_id?: string | null; is_active?: boolean };

export const createCategory = (input: CategoryInput) =>
  wrap(
    async () => (await apiFetch<{ data: CategoryRow }>('/api/categories', { method: 'POST', body: JSON.stringify({ ...input, name: input.name.trim() }) })).data,
    'No se pudo crear la categoría.'
  );

export const updateCategory = (id: string, input: Partial<CategoryInput>) =>
  wrap(
    async () => (await apiFetch<{ data: CategoryRow }>('/api/categories', { method: 'PUT', body: JSON.stringify({ id, ...input }) })).data,
    'No se pudo guardar la categoría.'
  );

/** La API no deja borrar una categoría con productos o subcategorías: devuelve el motivo. */
export const deleteCategory = (id: string) =>
  wrap(async () => {
    await apiFetch(`/api/categories?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  }, 'No se pudo eliminar la categoría.');

export const fetchGlobalCategories = () =>
  wrap(async () => (await apiFetch<{ data: GlobalCategory[] }>('/api/categories/global')).data ?? [], 'No se pudo cargar el catálogo.');

export const importGlobalCategories = (ids: string[]) =>
  wrap(
    async () =>
      apiFetch<{ created: number; linked: number; alreadyPresent: number }>('/api/categories/global', {
        method: 'POST',
        body: JSON.stringify({ globalCategoryIds: ids }),
      }),
    'No se pudieron agregar las categorías.'
  );

// ─── Marcas ────────────────────────────────────────────────────────────────

export const fetchBrandRows = (linked?: 'official' | 'own') =>
  wrap(
    async () => (await apiFetch<{ data: BrandRow[] }>(`/api/brands?limit=100${linked ? `&linked=${linked}` : ''}`)).data ?? [],
    'No se pudieron cargar las marcas.'
  );

export type BrandInput = { name: string; description?: string | null; website?: string | null; is_active?: boolean };

export const createBrand = (input: BrandInput) =>
  wrap(
    async () => (await apiFetch<{ data: BrandRow }>('/api/brands', { method: 'POST', body: JSON.stringify({ ...input, name: input.name.trim() }) })).data,
    'No se pudo crear la marca.'
  );

export const updateBrand = (id: string, input: Partial<BrandInput>) =>
  wrap(
    async () => (await apiFetch<{ data: BrandRow }>('/api/brands', { method: 'PUT', body: JSON.stringify({ id, ...input }) })).data,
    'No se pudo guardar la marca.'
  );

export const deleteBrand = (id: string) =>
  wrap(async () => {
    await apiFetch(`/api/brands?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  }, 'No se pudo eliminar la marca.');

export const searchBrandCatalog = (search: string) =>
  wrap(
    async () => (await apiFetch<{ data: GlobalBrandOption[] }>(`/api/brands/catalog?limit=60&search=${encodeURIComponent(search.trim())}`)).data ?? [],
    'No se pudo cargar el catálogo de marcas.'
  );

export const addBrandsFromCatalog = (ids: string[]) =>
  wrap(
    async () => apiFetch<{ created: number; linked: number; skipped: number }>('/api/brands/from-catalog', { method: 'POST', body: JSON.stringify({ ids }) }),
    'No se pudieron agregar las marcas.'
  );

/** Árbol de categorías aplanado: cada padre seguido de sus hijas (con nivel). */
export function categoryTree(rows: CategoryRow[]) {
  const byParent = new Map<string | null, CategoryRow[]>();
  rows.forEach((row) => {
    const key = row.parent_id && rows.some((other) => other.id === row.parent_id) ? row.parent_id : null;
    byParent.set(key, [...(byParent.get(key) ?? []), row]);
  });
  const sorted = (list: CategoryRow[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const out: (CategoryRow & { level: number; childCount: number })[] = [];
  const walk = (parent: string | null, level: number) => {
    sorted(byParent.get(parent) ?? []).forEach((row) => {
      out.push({ ...row, level, childCount: byParent.get(row.id)?.length ?? 0 });
      walk(row.id, level + 1);
    });
  };
  walk(null, 0);
  return out;
}
