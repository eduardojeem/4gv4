import { apiFetch } from './api';
import { posCatalogQuery, type PosShelf } from './pos-catalog';
import type { ProductPage } from './products';

/** Los ítems activos del estante (o de la búsqueda) que se ven en el POS. */
export async function fetchPosCatalog(shelf: PosShelf, search: string) {
  const result = await apiFetch<{ success: boolean; data: ProductPage }>(`/api/products?${posCatalogQuery(shelf, search).toString()}`);
  return result.data.products.filter((product) => product.is_active);
}
