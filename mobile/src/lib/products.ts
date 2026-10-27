import { getPrivateCacheContext, isPrivateCacheContextCurrent, subscribePrivateCacheContext, type PrivateCacheContext } from './private-cache-context';
import { apiFetch, ApiError } from './api';
import { supabase } from './supabase';
import { getMobileRuntimeConfig } from './runtime-config';

/**
 * Productos en la app: las mismas APIs que la sección de la web
 * (/api/products, categorías, marcas y búsqueda por código de barras), con sus
 * permisos, límites del plan y validaciones.
 */

export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  description?: string | null;
  sale_price: number;
  purchase_price?: number | null;
  wholesale_price?: number | null;
  offer_price?: number | null;
  has_offer?: boolean | null;
  stock_quantity: number;
  branch_stock_quantity?: number | null;
  min_stock?: number | null;
  max_stock?: number | null;
  images?: string[] | null;
  image_url?: string | null;
  is_active: boolean;
  visibility?: 'public' | 'wholesale' | 'hidden' | null;
  unit_measure?: string | null;
  brand?: string | null;
  brand_id?: string | null;
  category_id?: string | null;
  category?: { id: string; name: string } | null;
  featured?: boolean | null;
  warranty_months?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  has_variants?: boolean | null;
  variants?: { id: string; name?: string | null; variant_name?: string | null; stock_quantity?: number | null; min_stock?: number | null; is_active?: boolean | null; stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock'; current_stock?: number; minimum_stock?: number }[];
  variant_stock_summary?: {
    variant_count: number;
    out_of_stock_variant_count: number;
    low_stock_variant_count: number;
    affected_variant_count: number;
    total_stock: number;
  } | null;
};

export type Category = { id: string; name: string; parent_id?: string | null; products_count?: number };
export type Brand = { id: string; name: string; logo_url?: string | null };

export type StockFilter = 'all' | 'low_stock' | 'out_of_stock' | 'in_stock';
export type ProductSort = 'name' | 'price' | 'stock' | 'created_at';

export type ProductQuery = {
  query?: string;
  categoryId?: string | null;
  stock?: StockFilter;
  offers?: boolean;
  inactive?: boolean;
  services?: boolean;
  catalogKind?: 'physical' | 'service';
  sort?: ProductSort;
  direction?: 'asc' | 'desc';
  page?: number;
};

export type ProductPage = { products: Product[]; total: number; page: number; per_page: number; truncated?: boolean };

const PER_PAGE = 30;

export async function fetchProducts(params: ProductQuery) {
  const search = new URLSearchParams({ page: String(params.page ?? 1), per_page: String(PER_PAGE) });
  if (params.query?.trim()) search.set('query', params.query.trim());
  if (params.categoryId) search.set('category_id', params.categoryId);
  if (params.stock && params.stock !== 'all') search.set('stock_status', params.stock);
  if (params.inactive) search.set('is_active', 'false');
  if (params.services) search.set('catalog_kind', 'service');
  else if (params.catalogKind) search.set('catalog_kind', params.catalogKind);
  if (params.offers) search.set('offers', 'true');
  search.set('sort', params.sort ?? 'name');
  search.set('direction', params.direction ?? (params.sort === 'created_at' ? 'desc' : 'asc'));
  const result = await apiFetch<{ success: boolean; data: ProductPage }>(`/api/products?${search.toString()}`);
  const page = result.data;
  return page;
}

/** Busca un producto puntual (para abrir el detalle sin pasar por la lista). */
export async function fetchProduct(id: string) {
  const result = await apiFetch<{ success: boolean; data: Product }>(`/api/products/${id}`);
  return result.data;
}

export async function fetchCategories() {
  const result = await apiFetch<{ success: boolean; data: Category[] }>('/api/categories');
  return result.data ?? [];
}

export async function fetchBrands() {
  const result = await apiFetch<{ success: boolean; data: Brand[] }>('/api/brands?limit=100&is_active=true');
  return result.data ?? [];
}

export type ProductInput = {
  name: string;
  sku: string;
  barcode?: string | null;
  description?: string | null;
  category_id?: string | null;
  brand?: string | null;
  brand_id?: string | null;
  purchase_price?: number;
  sale_price: number;
  wholesale_price?: number | null;
  offer_price?: number | null;
  has_offer?: boolean;
  stock_quantity?: number;
  min_stock?: number;
  is_active?: boolean;
  visibility?: 'public' | 'wholesale' | 'hidden';
  unit_measure?: string;
  images?: string[];
  image_url?: string | null;
  warranty_months?: number | null;
};

type ValidationDetail = { field: string; message: string };

/** Errores de la API en una sola frase útil (validación, duplicado, plan). */
function friendly(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.body) {
    const details = error.body.details as ValidationDetail[] | undefined;
    if (Array.isArray(details) && details.length) return details.map((detail) => detail.message).join(' · ');
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

export async function createProduct(input: ProductInput) {
  try {
    const result = await apiFetch<{ success: boolean; data: Product }>('/api/products', { method: 'POST', body: JSON.stringify(input) });
    return result.data;
  } catch (error) {
    throw new Error(friendly(error, 'No se pudo crear el producto.'));
  }
}

/** PUT parcial: la API escribe solo lo que se manda (no pisa el stock si no se toca). */
export async function updateProduct(id: string, patch: Partial<ProductInput>) {
  try {
    const result = await apiFetch<{ success: boolean; data: Product }>('/api/products', { method: 'PUT', body: JSON.stringify({ id, ...patch }) });
    return result.data;
  } catch (error) {
    throw new Error(friendly(error, 'No se pudieron guardar los cambios.'));
  }
}

export async function deleteProduct(id: string) {
  try {
    await apiFetch(`/api/products?ids=${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (error) {
    throw new Error(friendly(error, 'No se pudo eliminar el producto.'));
  }
}

export type BarcodeLookup = {
  code: string;
  own: { id: string; name: string } | null;
  global: { name: string; description?: string | null; imageUrl?: string | null; brandName?: string | null; tenantBrandId?: string | null; tenantCategoryId?: string | null; source?: string | null } | null;
};

/** ¿Ya tengo este código? ¿Está en el catálogo global? (completa nombre, marca y foto). */
export async function lookupBarcode(code: string, excludeId?: string) {
  const params = new URLSearchParams({ code });
  if (excludeId) params.set('excludeId', excludeId);
  const result = await apiFetch<{ success: boolean; data: BarcodeLookup }>(`/api/products/barcode-lookup?${params.toString()}`);
  return result.data;
}

// ─── Fotos ─────────────────────────────────────────────────────────────────

const SUPABASE_URL = getMobileRuntimeConfig().supabaseUrl;
const BUCKET = 'product-images';

/** URL pública de una imagen: la base guarda a veces la ruta y a veces la URL completa. */
export function imageUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${value.replace(/^\/+/, '').replace(new RegExp(`^${BUCKET}/`), '')}`;
}

export const productImages = (product: Pick<Product, 'images' | 'image_url'>) =>
  [...(product.images ?? []), ...(product.image_url ? [product.image_url] : [])]
    .map(imageUrl)
    .filter((url, index, list): url is string => Boolean(url) && list.indexOf(url) === index);

/** Sube una foto como la web: al bucket público product-images, en products/. */
export async function uploadProductImage(uri: string, mimeType?: string | null) {
  const extension = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `products/${Math.random().toString(36).slice(2, 15)}_${Date.now()}.${extension}`;
  const file = await fetch(uri).then((response) => response.arrayBuffer());
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: mimeType ?? 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });
  if (error) throw new Error(`No se pudo subir la foto: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// ─── Reglas de presentación ────────────────────────────────────────────────

export const isService = (product: Pick<Product, 'unit_measure'>) => product.unit_measure === 'servicio';

export const hasActiveOffer = (product: Pick<Product, 'has_offer' | 'offer_price' | 'sale_price'>) =>
  Boolean(product.has_offer && product.offer_price && product.offer_price < product.sale_price);

export type StockState = { label: string; color: string; tone: 'ok' | 'low' | 'out' | 'service' };

export function stockState(product: Pick<Product, 'stock_quantity' | 'min_stock' | 'unit_measure' | 'variant_stock_summary'>): StockState {
  if (isService(product)) return { label: 'Servicio', color: '#0891B2', tone: 'service' };
  const variants = product.variant_stock_summary;
  if (variants && variants.variant_count === 0) return { label: 'Sin variantes activas', color: '#64748B', tone: 'ok' };
  if (variants && variants.variant_count > 0) {
    if (variants.total_stock <= 0) return { label: `${variants.out_of_stock_variant_count} agotada${variants.out_of_stock_variant_count === 1 ? '' : 's'}`, color: '#DC2626', tone: 'out' };
    if (variants.affected_variant_count > 0) {
      const parts = [
        variants.out_of_stock_variant_count > 0 ? `${variants.out_of_stock_variant_count} agotada${variants.out_of_stock_variant_count === 1 ? '' : 's'}` : '',
        variants.low_stock_variant_count > 0 ? `${variants.low_stock_variant_count} baja${variants.low_stock_variant_count === 1 ? '' : 's'}` : '',
      ].filter(Boolean);
      return { label: parts.join(' · '), color: '#D97706', tone: 'low' };
    }
    return { label: `Variantes: ${variants.total_stock}`, color: '#16A34A', tone: 'ok' };
  }
  const stock = Number(product.stock_quantity) || 0;
  if (stock <= 0) return { label: 'Sin stock', color: '#DC2626', tone: 'out' };
  if (stock <= Number(product.min_stock || 0)) return { label: `Bajo: ${stock}`, color: '#D97706', tone: 'low' };
  return { label: `Stock: ${stock}`, color: '#16A34A', tone: 'ok' };
}

export function margin(product: Pick<Product, 'sale_price' | 'purchase_price'>) {
  const cost = Number(product.purchase_price) || 0;
  const price = Number(product.sale_price) || 0;
  if (cost <= 0 || price <= 0) return null;
  return Math.round(((price - cost) / price) * 100);
}

/** SKU sugerido a partir del nombre: letras y números, como exige la API. */
export function suggestSku(name: string) {
  const base = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word.slice(0, 4))
    .join('-');
  return `${base || 'PROD'}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`.slice(0, 50);
}

export const VISIBILITY: Record<'public' | 'wholesale' | 'hidden', { label: string; help: string; icon: string }> = {
  public: { label: 'Público', help: 'Se ve en la tienda online y el marketplace', icon: 'globe-outline' },
  wholesale: { label: 'Solo mayoristas', help: 'Lo ven solo clientes mayoristas', icon: 'briefcase-outline' },
  hidden: { label: 'Oculto', help: 'Solo para uso interno (POS y taller)', icon: 'eye-off-outline' },
};

// Caché simple para abrir el detalle al instante desde la lista.
const cache = new Map<string, Product>();
export const rememberProducts = (products: Product[], scope: PrivateCacheContext = getPrivateCacheContext()) => {
  if (scope.key && scope.branchId && isPrivateCacheContextCurrent(scope)) products.forEach((product) => cache.set(product.id, product));
};
export const cachedProduct = (id: string, scope: PrivateCacheContext = getPrivateCacheContext()) => scope.key && scope.branchId && isPrivateCacheContextCurrent(scope) ? cache.get(id) : undefined;
subscribePrivateCacheContext(() => cache.clear());
const listeners = new Set<(product: Product | { id: string; deleted: true }) => void>();
export function notifyProduct(change: Product | { id: string; deleted: true }, scope: PrivateCacheContext = getPrivateCacheContext()) {
  if (!scope.key || !isPrivateCacheContextCurrent(scope)) return;
  if ('deleted' in change) cache.delete(change.id);
  else if (scope.branchId) cache.set(change.id, change);
  listeners.forEach((listener) => listener(change));
}
export function onProductChanged(listener: (change: Product | { id: string; deleted: true }) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
