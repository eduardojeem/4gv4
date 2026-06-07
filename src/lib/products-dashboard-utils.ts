/**
 * Utility functions for the Modern Products Dashboard
 */

import { Product, ProductAlert } from '@/types/product-unified'
import { DashboardFilters, DashboardMetrics, SortConfig, SearchOptions, GroupedAlerts } from '@/types/products-dashboard'

/**
 * Filter products by search query across multiple fields
 */
export function searchProducts(products: Product[], query: string): Product[] {
  if (!query || query.trim() === '') {
    return products
  }

  const searchTerm = query.toLowerCase().trim()

  return products.filter(product => {
    const name = product.name?.toLowerCase() || ''
    const sku = product.sku?.toLowerCase() || ''
    const brand = product.brand?.toLowerCase() || ''
    const description = product.description?.toLowerCase() || ''

    return (
      name.includes(searchTerm) ||
      sku.includes(searchTerm) ||
      brand.includes(searchTerm) ||
      description.includes(searchTerm)
    )
  })
}

/**
 * Apply filters to products using AND logic
 */
export function applyFilters(products: Product[], filters: DashboardFilters): Product[] {
  let filtered = [...products]

  // Category filter
  if (filters.category_id) {
    filtered = filtered.filter(p => p.category_id === filters.category_id)
  }

  // Supplier filter
  if (filters.supplier_id) {
    filtered = filtered.filter(p => p.supplier_id === filters.supplier_id)
  }

  // Brand filter
  if (filters.brand) {
    filtered = filtered.filter(p => p.brand?.toLowerCase() === filters.brand?.toLowerCase())
  }

  // Active status filter
  if (filters.is_active !== undefined) {
    filtered = filtered.filter(p => p.is_active === filters.is_active)
  }

  // Stock status filter
  if (filters.stock_status) {
    filtered = filtered.filter(p => {
      const status = getStockStatus(p)
      return status === filters.stock_status
    })
  }

  // Price range filter
  if (filters.price_min !== undefined) {
    filtered = filtered.filter(p => p.sale_price >= filters.price_min!)
  }

  if (filters.price_max !== undefined) {
    filtered = filtered.filter(p => p.sale_price <= filters.price_max!)
  }

  // Quick filter
  if (filters.quick_filter) {
    switch (filters.quick_filter) {
      case 'low_stock':
        filtered = filtered.filter(isLowStock)
        break
      case 'out_of_stock':
        filtered = filtered.filter(isOutOfStock)
        break
      case 'active':
        filtered = filtered.filter(p => p.is_active)
        break
      case 'all':
      default:
        // No additional filtering
        break
    }
  }

  return filtered
}

/**
 * Stock helpers — single source of truth for stock classification.
 *
 * When `min_stock` is not set we treat the threshold as 0, i.e. the product is
 * only ever "out of stock" (never "low stock"). This keeps badges, metrics,
 * quick-filter counts and alerts perfectly aligned.
 */
type StockShape = { stock_quantity?: number | null; min_stock?: number | null }

export function getMinStockThreshold(product: Pick<StockShape, 'min_stock'>): number {
  return Number(product.min_stock ?? 0)
}

export function isOutOfStock(product: Pick<StockShape, 'stock_quantity'>): boolean {
  return Number(product.stock_quantity ?? 0) <= 0
}

export function isLowStock(product: StockShape): boolean {
  const stock = Number(product.stock_quantity ?? 0)
  return stock > 0 && stock <= getMinStockThreshold(product)
}

/**
 * Get stock status for a product
 */
export function getStockStatus(product: Product): 'in_stock' | 'low_stock' | 'out_of_stock' {
  if (isOutOfStock(product)) {
    return 'out_of_stock'
  }
  if (isLowStock(product)) {
    return 'low_stock'
  }
  return 'in_stock'
}

/**
 * Sort products by field and direction
 */
export function sortProducts(products: Product[], sortConfig: SortConfig): Product[] {
  const sorted = [...products]

  sorted.sort((a, b) => {
    let aValue: any
    let bValue: any

    switch (sortConfig.field) {
      case 'name':
        aValue = a.name?.toLowerCase() || ''
        bValue = b.name?.toLowerCase() || ''
        break
      case 'sku':
        aValue = a.sku?.toLowerCase() || ''
        bValue = b.sku?.toLowerCase() || ''
        break
      case 'sale_price':
        aValue = a.sale_price || 0
        bValue = b.sale_price || 0
        break
      case 'stock_quantity':
        aValue = a.stock_quantity || 0
        bValue = b.stock_quantity || 0
        break
      case 'created_at':
        aValue = new Date(a.created_at).getTime()
        bValue = new Date(b.created_at).getTime()
        break
      case 'updated_at':
        aValue = new Date(a.updated_at).getTime()
        bValue = new Date(b.updated_at).getTime()
        break
      default:
        return 0
    }

    if (aValue < bValue) {
      return sortConfig.direction === 'asc' ? -1 : 1
    }
    if (aValue > bValue) {
      return sortConfig.direction === 'asc' ? 1 : -1
    }
    return 0
  })

  return sorted
}

/**
 * Calculate dashboard metrics from products
 */
export function calculateMetrics(products: Product[]): DashboardMetrics {
  const total_products = products.length
  const active_products = products.filter(p => p.is_active).length
  
  const low_stock_count = products.filter(isLowStock).length

  const out_of_stock_count = products.filter(isOutOfStock).length
  
  const inventory_value = products.reduce(
    (sum, p) => sum + (p.sale_price * p.stock_quantity),
    0
  )

  return {
    total_products,
    active_products,
    low_stock_count,
    out_of_stock_count,
    inventory_value
  }
}

/**
 * Group alerts by type
 */
export function groupAlertsByType(alerts: ProductAlert[]): GroupedAlerts {
  const grouped: GroupedAlerts = {
    out_of_stock: [],
    low_stock: [],
    missing_data: [],
    other: []
  }

  alerts.forEach(alert => {
    switch (alert.type) {
      case 'out_of_stock':
        grouped.out_of_stock.push(alert)
        break
      case 'low_stock':
        grouped.low_stock.push(alert)
        break
      case 'no_supplier':
      case 'no_category':
      case 'no_image':
      case 'missing_supplier':
      case 'missing_category':
      case 'missing_image':
        grouped.missing_data.push(alert)
        break
      default:
        grouped.other.push(alert)
        break
    }
  })

  return grouped
}

/**
 * Filter products by alert
 */
export function filterProductsByAlert(products: Product[], alert: ProductAlert): Product[] {
  return products.filter(p => p.id === alert.product_id)
}

/**
 * Get active (unresolved) alerts
 */
export function getActiveAlerts(alerts: ProductAlert[]): ProductAlert[] {
  return alerts.filter(alert => !alert.is_resolved && !alert.read)
}

/**
 * Debounce function for search input
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * Format large numbers (e.g., 1000000 -> 1M)
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return value.toString()
}

/**
 * Get unique brands from products
 */
export function getUniqueBrands(products: Product[]): string[] {
  const brands = products
    .map(p => p.brand)
    .filter((brand): brand is string => !!brand)
  
  return Array.from(new Set(brands)).sort()
}

const CSV_DELIMITER = ';'
const CSV_BOM = '\uFEFF'

function formatCSVDate(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('es-PY')
}

function formatCSVNumber(value: number | null | undefined): string {
  return Number(value || 0).toFixed(2)
}

function escapeCSVValue(value: unknown): string {
  const str = String(value ?? '')
  if (str.includes(CSV_DELIMITER) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function buildCSV(headers: string[], rows: unknown[][]): string {
  return [
    `sep=${CSV_DELIMITER}`,
    headers.map(escapeCSVValue).join(CSV_DELIMITER),
    ...rows.map(row => row.map(escapeCSVValue).join(CSV_DELIMITER))
  ].join('\r\n')
}

/**
 * Export products to CSV
 */
export function exportProductsToCSV(products: Product[]): string {
  if (products.length === 0) {
    return ''
  }

  // Define headers
  const headers = [
    'ID',
    'SKU',
    'Nombre',
    'Descripción',
    'Categoría',
    'Marca',
    'Proveedor',
    'Precio Compra',
    'Precio Venta',
    'Precio Mayoreo',
    'Stock',
    'Stock Mínimo',
    'Stock Máximo',
    'Unidad',
    'Código Barras',
    'Ubicación',
    'Activo',
    'Destacado',
    'Fecha Creación',
    'Fecha Actualización'
  ]

  // Build CSV rows
  const rows = products.map(p => [
    p.id,
    p.sku,
    p.name,
    p.description || '',
    p.category?.name || '',
    p.brand || '',
    p.supplier?.name || '',
    p.purchase_price,
    p.sale_price,
    p.wholesale_price || '',
    p.stock_quantity,
    p.min_stock,
    p.max_stock || '',
    p.unit_measure,
    p.barcode || '',
    p.location || '',
    p.is_active ? 'Sí' : 'No',
    p.featured ? 'Sí' : 'No',
    p.created_at,
    p.updated_at
  ])

  // Escape CSV values
  const escapeCsvValue = (value: unknown): string => {
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  // Build CSV string
  const csvContent = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map(row => row.map(escapeCsvValue).join(','))
  ].join('\n')

  return csvContent
}

export function exportProductsToInventoryCSV(products: Product[]): string {
  if (products.length === 0) {
    return ''
  }

  const headers = [
    'SKU',
    'Nombre',
    'Descripción',
    'Categoría',
    'Marca',
    'Proveedor',
    'Precio Compra',
    'Precio Venta',
    'Precio Mayoreo',
    'Stock',
    'Stock Mínimo',
    'Stock Máximo',
    'Unidad',
    'Código Barras',
    'Ubicación',
    'Activo',
    'Destacado',
    'Valor Stock',
    'Margen %',
    'Estado Stock',
    'Fecha Creación',
    'Fecha Actualización',
    'ID',
  ]

  const exportHeaders = [
    'SKU',
    'Nombre',
    'Descripcion',
    'Categoria',
    'Marca',
    'Proveedor',
    'Precio Compra',
    'Precio Venta',
    'Precio Mayoreo',
    'Stock',
    'Stock Minimo',
    'Stock Maximo',
    'Unidad',
    'Codigo Barras',
    'Ubicacion',
    'Activo',
    'Destacado',
    'Valor Stock',
    'Margen %',
    'Estado Stock',
    'Fecha Creacion',
    'Fecha Actualizacion',
    'ID',
  ]

  const rows = products.map(product => [
    product.sku,
    product.name,
    product.description || '',
    product.category?.name || '',
    product.brand || '',
    product.supplier?.name || '',
    formatCSVNumber(product.purchase_price),
    formatCSVNumber(product.sale_price),
    product.wholesale_price !== undefined && product.wholesale_price !== null ? formatCSVNumber(product.wholesale_price) : '',
    product.stock_quantity,
    product.min_stock,
    product.max_stock || '',
    product.unit_measure,
    product.barcode || '',
    product.location || '',
    product.is_active ? 'Sí' : 'No',
    product.featured ? 'Sí' : 'No',
    formatCSVNumber(Number(product.sale_price || 0) * Number(product.stock_quantity || 0)),
    product.purchase_price ? (((Number(product.sale_price || 0) - Number(product.purchase_price || 0)) / Number(product.purchase_price)) * 100).toFixed(2) : '0.00',
    isOutOfStock(product) ? 'Sin stock' : (isLowStock(product) ? 'Stock bajo' : 'En stock'),
    formatCSVDate(product.created_at),
    formatCSVDate(product.updated_at),
    product.id,
  ])

  return buildCSV(exportHeaders, rows)
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string = 'productos.csv'): void {
  const content = csvContent.startsWith(CSV_BOM) ? csvContent : `${CSV_BOM}${csvContent}`
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

/**
 * Generate unique SKU
 */
export function generateSKU(prefix: string = 'PROD'): string {
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

/**
 * Validate product data
 */
export function validateProductData(data: Partial<Product>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!data.name || data.name.trim() === '') {
    errors.push('El nombre es requerido')
  }

  if (!data.sku || data.sku.trim() === '') {
    errors.push('El SKU es requerido')
  }

  if (data.sale_price !== undefined && data.sale_price < 0) {
    errors.push('El precio de venta no puede ser negativo')
  }

  if (data.purchase_price !== undefined && data.purchase_price < 0) {
    errors.push('El precio de compra no puede ser negativo')
  }

  if (data.stock_quantity !== undefined && data.stock_quantity < 0) {
    errors.push('El stock no puede ser negativo')
  }

  if (data.min_stock !== undefined && data.min_stock < 0) {
    errors.push('El stock mínimo no puede ser negativo')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
