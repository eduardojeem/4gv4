import { PRODUCTS_MAX_PRICE } from '@/lib/constants/products'

/**
 * Read active product filter state from URLSearchParams.
 */
export function readActiveProductFilters(searchParams: URLSearchParams) {
  const query = searchParams.get('query')
  const categoryId = searchParams.get('category_id')
  const brand = searchParams.get('brand')
  const branchId = searchParams.get('branch_id')
  const inStock = searchParams.get('in_stock') === 'true'
  const audience = searchParams.get('audience')
  const size = searchParams.get('size')
  const color = searchParams.get('color')
  const minPrice = Number(searchParams.get('min_price')) || 0
  const maxPrice = Number(searchParams.get('max_price')) || PRODUCTS_MAX_PRICE
  const hasActiveFilters =
    !!query || !!categoryId || !!brand || !!branchId || !!audience || !!size || !!color || inStock || minPrice > 0 || maxPrice < PRODUCTS_MAX_PRICE
  return { query, categoryId, brand, branchId, audience, size, color, inStock, minPrice, maxPrice, hasActiveFilters }
}

/**
 * Return a new URLSearchParams with all product filters cleared.
 * Preserves any non-filter params (e.g. sort).
 */
export function clearAllProductFilters(searchParams: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(searchParams.toString())
  params.delete('query')
  params.delete('category_id')
  params.delete('brand')
  params.delete('branch_id')
  params.delete('min_price')
  params.delete('max_price')
  params.delete('in_stock')
  params.delete('audience')
  params.delete('size')
  params.delete('color')
  params.set('page', '1')
  return params
}
