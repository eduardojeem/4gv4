import { branchHeaders } from '@/lib/branches/client'

export const INVENTORY_EXPORT_HEADERS = [
  'Nombre',
  'SKU',
  'Categoría',
  'Proveedor',
  'Precio venta',
  'Costo',
  'Stock',
  'Mínimo',
  'Estado',
] as const

/** Tope de seguridad: 100 páginas de 100 productos. */
const EXPORT_PAGE_SIZE = 100
const EXPORT_MAX_PAGES = 100

interface ExportableProduct {
  name?: string | null
  sku?: string | null
  category?: { name?: string | null } | null
  supplier?: { name?: string | null } | null
  sale_price?: number | null
  purchase_price?: number | null
  stock_quantity?: number | null
  min_stock?: number | null
  status?: string | null
  is_active?: boolean | null
}

export function toExportRow(product: ExportableProduct): string[] {
  const activo = product.status
    ? product.status === 'active'
    : product.is_active !== false

  return [
    product.name ?? '',
    product.sku ?? '',
    product.category?.name ?? '',
    product.supplier?.name ?? '',
    String(product.sale_price ?? 0),
    // El costo puede venir recortado por permisos: se exporta vacio, no cero.
    product.purchase_price === undefined || product.purchase_price === null
      ? ''
      : String(product.purchase_price),
    String(product.stock_quantity ?? 0),
    String(product.min_stock ?? 0),
    activo ? 'Activo' : 'Inactivo',
  ]
}

export interface InventoryExportFilters {
  search?: string
  category?: string
  supplier?: string
  status?: string
  stockStatus?: string
}

/**
 * Recorre TODO el inventario que cumple los filtros, no la pagina que se esta
 * viendo.
 *
 * La exportacion anterior serializaba el array `products` del hook —diez
 * filas— en un archivo llamado «inventario_<fecha>.csv». Quien lo abria en
 * Excel creia tener el inventario completo.
 */
export async function exportInventoryCsvRows(
  filters: InventoryExportFilters,
  branchId?: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<string[][]> {
  const rows: string[][] = [[...INVENTORY_EXPORT_HEADERS]]
  let page = 1
  let truncated = false

  while (page <= EXPORT_MAX_PAGES) {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(EXPORT_PAGE_SIZE),
      sort: 'name',
      direction: 'asc',
    })
    if (branchId) params.set('strict_branch_stock', 'true')
    if (filters.search?.trim()) params.set('query', filters.search.trim())
    if (filters.category && filters.category !== 'all') params.set('category_id', filters.category)
    if (filters.supplier && filters.supplier !== 'all') params.set('supplier_id', filters.supplier)
    if (filters.status === 'active' || filters.status === 'inactive') {
      params.set('is_active', String(filters.status === 'active'))
    }
    const stockStatus = ({
      out: 'out_of_stock',
      low: 'low_stock',
      normal: 'normal_stock',
      high: 'high_stock',
    } as Record<string, string>)[filters.stockStatus ?? 'all']
    if (stockStatus) params.set('stock_status', stockStatus)

    const response = await fetchImpl(`/api/products?${params.toString()}`, {
      cache: 'no-store',
      headers: branchHeaders(branchId),
    })
    const payload = await response.json().catch(() => null)

    if (!response.ok || !payload?.success || !Array.isArray(payload?.data?.products)) {
      throw new Error(payload?.error || 'No se pudo leer el catálogo para exportar.')
    }

    const batch = payload.data.products as ExportableProduct[]
    for (const product of batch) rows.push(toExportRow(product))

    if (payload.data.truncated) truncated = true
    const total = Number(payload.data.total) || 0
    if (batch.length < EXPORT_PAGE_SIZE || rows.length - 1 >= total) break
    page += 1
  }

  if (truncated) {
    throw new Error(
      'El filtro de stock activo hace que el catálogo se recorra parcialmente: quitá ese filtro para exportar el inventario completo.'
    )
  }

  return rows
}
