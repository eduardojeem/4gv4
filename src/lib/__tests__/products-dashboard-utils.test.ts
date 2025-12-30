/**
 * Unit tests for products dashboard utilities
 */

import { describe, test, expect } from 'vitest'
import {
  searchProducts,
  applyFilters,
  calculateMetrics,
  sortProducts,
  getStockStatus,
  groupAlertsByType,
  getActiveAlerts,
  getUniqueBrands,
  exportProductsToCSV,
  generateSKU,
  validateProductData
} from '../products-dashboard-utils'
import { Product, ProductAlert } from '@/types/products'
import { DashboardFilters, SortConfig } from '@/types/products-dashboard'

// Mock data
const mockProducts: Product[] = [
  {
    id: '1',
    sku: 'PROD-001',
    name: 'Laptop Dell',
    description: 'High performance laptop',
    brand: 'Dell',
    category_id: 'cat-1',
    supplier_id: 'sup-1',
    purchase_price: 800,
    sale_price: 1000,
    stock_quantity: 10,
    min_stock: 5,
    unit_measure: 'unidad',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    sku: 'PROD-002',
    name: 'Mouse Logitech',
    description: 'Wireless mouse',
    brand: 'Logitech',
    category_id: 'cat-2',
    supplier_id: 'sup-2',
    purchase_price: 20,
    sale_price: 30,
    stock_quantity: 3,
    min_stock: 5,
    unit_measure: 'unidad',
    is_active: true,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z'
  },
  {
    id: '3',
    sku: 'PROD-003',
    name: 'Keyboard HP',
    description: 'Mechanical keyboard',
    brand: 'HP',
    category_id: 'cat-1',
    supplier_id: 'sup-1',
    purchase_price: 50,
    sale_price: 75,
    stock_quantity: 0,
    min_stock: 3,
    unit_measure: 'unidad',
    is_active: false,
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z'
  }
]

describe('searchProducts', () => {
  test('should return all products when search query is empty', () => {
    const result = searchProducts(mockProducts, '')
    expect(result).toHaveLength(3)
  })

  test('should filter products by name', () => {
    const result = searchProducts(mockProducts, 'laptop')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Laptop Dell')
  })

  test('should filter products by SKU', () => {
    const result = searchProducts(mockProducts, 'PROD-002')
    expect(result).toHaveLength(1)
    expect(result[0].sku).toBe('PROD-002')
  })

  test('should filter products by brand', () => {
    const result = searchProducts(mockProducts, 'logitech')
    expect(result).toHaveLength(1)
    expect(result[0].brand).toBe('Logitech')
  })

  test('should filter products by description', () => {
    const result = searchProducts(mockProducts, 'wireless')
    expect(result).toHaveLength(1)
    expect(result[0].description).toBe('Wireless mouse')
  })

  test('should be case insensitive', () => {
    const result = searchProducts(mockProducts, 'LAPTOP')
    expect(result).toHaveLength(1)
  })

  test('should return empty array when no matches', () => {
    const result = searchProducts(mockProducts, 'nonexistent')
    expect(result).toHaveLength(0)
  })

  test('should handle null values gracefully', () => {
    const productsWithNulls: Product[] = [{
      ...mockProducts[0],
      description: null,
      brand: null
    }]
    const result = searchProducts(productsWithNulls, 'laptop')
    expect(result).toHaveLength(1)
  })
})

describe('applyFilters', () => {
  test('should return all products when no filters applied', () => {
    const result = applyFilters(mockProducts, {})
    expect(result).toHaveLength(3)
  })

  test('should filter by category_id', () => {
    const filters: DashboardFilters = { category_id: 'cat-1' }
    const result = applyFilters(mockProducts, filters)
    expect(result).toHaveLength(2)
    expect(result.every(p => p.category_id === 'cat-1')).toBe(true)
  })

  test('should filter by supplier_id', () => {
    const filters: DashboardFilters = { supplier_id: 'sup-2' }
    const result = applyFilters(mockProducts, filters)
    expect(result).toHaveLength(1)
    expect(result[0].supplier_id).toBe('sup-2')
  })

  test('should filter by brand', () => {
    const filters: DashboardFilters = { brand: 'Dell' }
    const result = applyFilters(mockProducts, filters)
    expect(result).toHaveLength(1)
    expect(result[0].brand).toBe('Dell')
  })

  test('should filter by is_active', () => {
    const filters: DashboardFilters = { is_active: true }
    const result = applyFilters(mockProducts, filters)
    expect(result).toHaveLength(2)
    expect(result.every(p => p.is_active)).toBe(true)
  })

  test('should filter by stock_status - out_of_stock', () => {
    const filters: DashboardFilters = { stock_status: 'out_of_stock' }
    const result = applyFilters(mockProducts, filters)
    expect(result).toHaveLength(1)
    expect(result[0].stock_quantity).toBe(0)
  })

  test('should filter by stock_status - low_stock', () => {
    const filters: DashboardFilters = { stock_status: 'low_stock' }
    const result = applyFilters(mockProducts, filters)
    expect(result).toHaveLength(1)
    expect(result[0].stock_quantity).toBe(3)
  })

  test('should filter by price range', () => {
    const filters: DashboardFilters = { price_min: 50, price_max: 100 }
    const result = applyFilters(mockProducts, filters)
    expect(result).toHaveLength(1)
    expect(result[0].sale_price).toBe(75)
  })

  test('should combine multiple filters with AND logic', () => {
    const filters: DashboardFilters = {
      category_id: 'cat-1',
      is_active: true
    }
    const result = applyFilters(mockProducts, filters)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  test('should handle quick_filter - low_stock', () => {
    const filters: DashboardFilters = { quick_filter: 'low_stock' }
    const result = applyFilters(mockProducts, filters)
    expect(result).toHaveLength(1)
    expect(result[0].stock_quantity).toBeLessThanOrEqual(result[0].min_stock)
    expect(result[0].stock_quantity).toBeGreaterThan(0)
  })

  test('should handle quick_filter - out_of_stock', () => {
    const filters: DashboardFilters = { quick_filter: 'out_of_stock' }
    const result = applyFilters(mockProducts, filters)
    expect(result).toHaveLength(1)
    expect(result[0].stock_quantity).toBe(0)
  })

  test('should handle quick_filter - active', () => {
    const filters: DashboardFilters = { quick_filter: 'active' }
    const result = applyFilters(mockProducts, filters)
    expect(result).toHaveLength(2)
    expect(result.every(p => p.is_active)).toBe(true)
  })
})

describe('calculateMetrics', () => {
  test('should calculate correct metrics', () => {
    const metrics = calculateMetrics(mockProducts)
    
    expect(metrics.total_products).toBe(3)
    expect(metrics.active_products).toBe(2)
    expect(metrics.low_stock_count).toBe(1)
    expect(metrics.out_of_stock_count).toBe(1)
    expect(metrics.inventory_value).toBe(10090) // (1000*10) + (30*3) + (75*0)
  })

  test('should handle empty products array', () => {
    const metrics = calculateMetrics([])
    
    expect(metrics.total_products).toBe(0)
    expect(metrics.active_products).toBe(0)
    expect(metrics.low_stock_count).toBe(0)
    expect(metrics.out_of_stock_count).toBe(0)
    expect(metrics.inventory_value).toBe(0)
  })
})

describe('sortProducts', () => {
  test('should sort by name ascending', () => {
    const sortConfig: SortConfig = { field: 'name', direction: 'asc' }
    const result = sortProducts(mockProducts, sortConfig)
    
    expect(result[0].name).toBe('Keyboard HP')
    expect(result[1].name).toBe('Laptop Dell')
    expect(result[2].name).toBe('Mouse Logitech')
  })

  test('should sort by name descending', () => {
    const sortConfig: SortConfig = { field: 'name', direction: 'desc' }
    const result = sortProducts(mockProducts, sortConfig)
    
    expect(result[0].name).toBe('Mouse Logitech')
    expect(result[1].name).toBe('Laptop Dell')
    expect(result[2].name).toBe('Keyboard HP')
  })

  test('should sort by sale_price ascending', () => {
    const sortConfig: SortConfig = { field: 'sale_price', direction: 'asc' }
    const result = sortProducts(mockProducts, sortConfig)
    
    expect(result[0].sale_price).toBe(30)
    expect(result[1].sale_price).toBe(75)
    expect(result[2].sale_price).toBe(1000)
  })

  test('should sort by stock_quantity descending', () => {
    const sortConfig: SortConfig = { field: 'stock_quantity', direction: 'desc' }
    const result = sortProducts(mockProducts, sortConfig)
    
    expect(result[0].stock_quantity).toBe(10)
    expect(result[1].stock_quantity).toBe(3)
    expect(result[2].stock_quantity).toBe(0)
  })
})

describe('getStockStatus', () => {
  test('should return out_of_stock when quantity is 0', () => {
    const product = { ...mockProducts[0], stock_quantity: 0 }
    expect(getStockStatus(product)).toBe('out_of_stock')
  })

  test('should return low_stock when quantity <= min_stock', () => {
    const product = { ...mockProducts[0], stock_quantity: 5, min_stock: 5 }
    expect(getStockStatus(product)).toBe('low_stock')
  })

  test('should return in_stock when quantity > min_stock', () => {
    const product = { ...mockProducts[0], stock_quantity: 10, min_stock: 5 }
    expect(getStockStatus(product)).toBe('in_stock')
  })
})

describe('groupAlertsByType', () => {
  const mockAlerts: ProductAlert[] = [
    {
      id: '1',
      product_id: 'p1',
      type: 'out_of_stock',
      message: 'Product out of stock',
      read: false,
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      product_id: 'p2',
      type: 'low_stock',
      message: 'Product low stock',
      read: false,
      created_at: '2024-01-02T00:00:00Z'
    },
    {
      id: '3',
      product_id: 'p3',
      type: 'no_supplier',
      message: 'Product has no supplier',
      read: false,
      created_at: '2024-01-03T00:00:00Z'
    }
  ]

  test('should group alerts by type', () => {
    const grouped = groupAlertsByType(mockAlerts)
    
    expect(grouped.out_of_stock).toHaveLength(1)
    expect(grouped.low_stock).toHaveLength(1)
    expect(grouped.missing_data).toHaveLength(1)
    expect(grouped.other).toHaveLength(0)
  })
})

describe('getActiveAlerts', () => {
  const mockAlerts: ProductAlert[] = [
    {
      id: '1',
      product_id: 'p1',
      type: 'out_of_stock',
      message: 'Alert 1',
      read: false,
      is_resolved: false,
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      product_id: 'p2',
      type: 'low_stock',
      message: 'Alert 2',
      read: true,
      is_resolved: false,
      created_at: '2024-01-02T00:00:00Z'
    },
    {
      id: '3',
      product_id: 'p3',
      type: 'no_supplier',
      message: 'Alert 3',
      read: false,
      is_resolved: true,
      created_at: '2024-01-03T00:00:00Z'
    }
  ]

  test('should return only unread and unresolved alerts', () => {
    const active = getActiveAlerts(mockAlerts)
    expect(active).toHaveLength(1)
    expect(active[0].id).toBe('1')
  })
})

describe('getUniqueBrands', () => {
  test('should return unique brands sorted', () => {
    const brands = getUniqueBrands(mockProducts)
    expect(brands).toEqual(['Dell', 'HP', 'Logitech'])
  })

  test('should handle products without brands', () => {
    const productsWithoutBrands = mockProducts.map(p => ({ ...p, brand: null }))
    const brands = getUniqueBrands(productsWithoutBrands)
    expect(brands).toEqual([])
  })
})

describe('exportProductsToCSV', () => {
  test('should generate CSV with headers and data', () => {
    const csv = exportProductsToCSV(mockProducts)
    
    expect(csv).toContain('ID,SKU,Nombre')
    expect(csv).toContain('PROD-001')
    expect(csv).toContain('Laptop Dell')
  })

  test('should handle empty products array', () => {
    const csv = exportProductsToCSV([])
    expect(csv).toBe('')
  })

  test('should escape CSV special characters', () => {
    const productWithComma: Product = {
      ...mockProducts[0],
      description: 'Product with, comma'
    }
    const csv = exportProductsToCSV([productWithComma])
    expect(csv).toContain('"Product with, comma"')
  })
})

describe('generateSKU', () => {
  test('should generate SKU with default prefix', () => {
    const sku = generateSKU()
    expect(sku).toMatch(/^PROD-/)
  })

  test('should generate SKU with custom prefix', () => {
    const sku = generateSKU('TEST')
    expect(sku).toMatch(/^TEST-/)
  })

  test('should generate unique SKUs', () => {
    const sku1 = generateSKU()
    const sku2 = generateSKU()
    expect(sku1).not.toBe(sku2)
  })
})

describe('validateProductData', () => {
  test('should validate correct product data', () => {
    const data = {
      name: 'Test Product',
      sku: 'TEST-001',
      sale_price: 100,
      purchase_price: 50,
      stock_quantity: 10,
      min_stock: 5
    }
    const result = validateProductData(data)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  test('should reject missing name', () => {
    const data = { name: '', sku: 'TEST-001' }
    const result = validateProductData(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('El nombre es requerido')
  })

  test('should reject missing SKU', () => {
    const data = { name: 'Test', sku: '' }
    const result = validateProductData(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('El SKU es requerido')
  })

  test('should reject negative prices', () => {
    const data = {
      name: 'Test',
      sku: 'TEST-001',
      sale_price: -10,
      purchase_price: -5
    }
    const result = validateProductData(data)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  test('should reject negative stock', () => {
    const data = {
      name: 'Test',
      sku: 'TEST-001',
      stock_quantity: -5
    }
    const result = validateProductData(data)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('El stock no puede ser negativo')
  })
})
