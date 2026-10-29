import type { Product } from './products';

/**
 * Qué muestra el catálogo del POS. Por defecto, los productos (lo que tiene
 * stock); los servicios aparte, en su propio estante; los más vendidos de este
 * teléfono y cada categoría, como antes.
 */
export type PosShelf = 'products' | 'services' | 'frequent' | { categoryId: string };

export const DEFAULT_POS_SHELF: PosShelf = 'products';

/**
 * La misma regla que usa el servidor (src/lib/products/is-service-like.ts):
 * si el POS la ve distinto, un servicio por SKU o categoría aparecería «Sin
 * stock» y no se podría cobrar.
 */
export function isPosService(product: Pick<Product, 'sku' | 'unit_measure'> & { category?: { name?: string | null } | null }) {
  const sku = String(product.sku || '').toUpperCase().trim();
  const unit = String(product.unit_measure || '').toLowerCase().trim();
  const category = String(product.category?.name || '').toLowerCase().trim();
  return unit === 'servicio'
    || /^(SRV|SERV|SER)[-_]/.test(sku)
    || category.includes('servicio')
    || category.includes('mano de obra');
}

export const sameShelf = (a: PosShelf, b: PosShelf) =>
  typeof a === 'string' || typeof b === 'string' ? a === b : a.categoryId === b.categoryId;

/**
 * Lo que se le pide al servidor. Al buscar se busca en todo el catálogo: los
 * estantes no se ven mientras se escribe, así que no pueden recortar en silencio.
 */
export function posCatalogQuery(shelf: PosShelf, search: string) {
  const query = search.trim();
  // Solo activos: el servidor devuelve también los inactivos si no se le pide.
  const params = new URLSearchParams({ page: '1', per_page: '30', is_active: 'true' });
  if (query) {
    params.set('query', query);
    params.set('sort', 'name');
    params.set('direction', 'asc');
    return params;
  }
  if (shelf === 'services') {
    params.set('catalog_kind', 'service');
    params.set('sort', 'name');
    params.set('direction', 'asc');
    return params;
  }
  if (typeof shelf !== 'string') params.set('category_id', shelf.categoryId);
  // «part» es todo lo que no es servicio: el servidor usa la misma regla.
  else params.set('catalog_kind', 'part');
  params.set('sort', 'stock');
  params.set('direction', 'desc');
  return params;
}

/** Lo que se puede vender: un producto desactivado no aparece ni se agrega. */
export const isSellable = (product: Pick<Product, 'is_active'>) => product.is_active !== false;

/** El texto cuando el estante está vacío. */
export function emptyShelfMessage(shelf: PosShelf, search: string) {
  if (search.trim()) return `Nada coincide con «${search.trim()}».`;
  if (shelf === 'services') return 'No hay servicios activos. Cargalos en Productos con la unidad «Servicio».';
  if (typeof shelf !== 'string') return 'No hay productos activos en esta categoría.';
  return 'No hay productos activos.';
}
