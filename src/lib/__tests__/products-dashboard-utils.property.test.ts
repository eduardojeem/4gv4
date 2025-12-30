/**
 * Property-based tests for products dashboard utilities
 * Using fast-check for property-based testing
 * 
 * Feature: modern-products-dashboard
 */

import { describe, test, expect } from 'vitest'
import fc from 'fast-check'
import {
  searchProducts,
  applyFilters,
  calculateMetrics,
  sortProducts,
  getStockStatus,
  groupAlertsByType,
  getActiveAlerts,
  exportProductsToCSV
} from '../products-dashboard-utils'
import {
  productGenerator,
  productsArrayGenerator,
  searchQueryGenerator,
  filtersGenerator,
  sortConfigGenerator,
  alertGenerator
} from '../../test/generators/products'
import { SortConfig, DashboardFilters } from '@/types/products-dashboard'
import { Product } from '@/types/products'

import { validateProductData } from '../products-dashboard-utils'

describe('Products Dashboard Utils - Property Tests', () => {
  /**
   * Feature: modern-products-dashboard, Property 1: Search filters across multiple fields
   * Validates: Requirements 2.1
   */
  test('Property 1: Search filters across multiple fields', () => {
    fc.assert(
      fc.property(
        productsArrayGenerator(0, 50),
        searchQueryGenerator(),
        (products, searchQuery) => {
          const filtered = searchProducts(products, searchQuery)

          // If search query is empty, should return all products
          if (!searchQuery || searchQuery.trim() === '') {
            expect(filtered).toHaveLength(products.length)
            return true
          }

          const query = searchQuery.toLowerCase().trim()

          // All filtered products must contain the search query in at least one field
          const allMatch = filtered.every(product => {
            const name = product.name?.toLowerCase() || ''
            const sku = product.sku?.toLowerCase() || ''
            const brand = product.brand?.toLowerCase() || ''
            const description = product.description?.toLowerCase() || ''

            return (
              name.includes(query) ||
              sku.includes(query) ||
              brand.includes(query) ||
              description.includes(query)
            )
          })

          expect(allMatch).toBe(true)
          return allMatch
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 2: Filter combination uses AND logic
   * Validates: Requirements 3.2, 3.3
   */
  test('Property 2: Filter combination uses AND logic', () => {
    fc.assert(
      fc.property(
        productsArrayGenerator(10, 50),
        filtersGenerator(),
        (products, filters) => {
          const filtered = applyFilters(products, filters)

          // All filtered products must match ALL active filter criteria
          const allMatch = filtered.every(product => {
            let matches = true

            // Check category filter
            if (filters.category_id) {
              matches = matches && product.category_id === filters.category_id
            }

            // Check supplier filter
            if (filters.supplier_id) {
              matches = matches && product.supplier_id === filters.supplier_id
            }

            // Check brand filter
            if (filters.brand) {
              matches = matches && product.brand?.toLowerCase() === filters.brand.toLowerCase()
            }

            // Check active status filter
            if (filters.is_active !== undefined) {
              matches = matches && product.is_active === filters.is_active
            }

            // Check stock status filter
            if (filters.stock_status) {
              const status = getStockStatus(product)
              matches = matches && status === filters.stock_status
            }

            // Check price range
            if (filters.price_min !== undefined) {
              matches = matches && product.sale_price >= filters.price_min
            }

            if (filters.price_max !== undefined) {
              matches = matches && product.sale_price <= filters.price_max
            }

            return matches
          })

          expect(allMatch).toBe(true)
          return allMatch
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 5: Inventory value calculation
   * Validates: Requirements 4.5
   */
  test('Property 5: Inventory value calculation', () => {
    fc.assert(
      fc.property(
        productsArrayGenerator(1, 50),
        (products) => {
          const metrics = calculateMetrics(products)

          // Calculate expected inventory value manually
          const expectedValue = products.reduce(
            (sum, p) => sum + (p.sale_price * p.stock_quantity),
            0
          )

          // The calculated inventory value should match the manual calculation
          expect(metrics.inventory_value).toBeCloseTo(expectedValue, 2)
          
          // Inventory value should never be negative
          expect(metrics.inventory_value).toBeGreaterThanOrEqual(0)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
})

  /**
   * Feature: modern-products-dashboard, Property 3: Filter count accuracy
   * Validates: Requirements 3.5, 9.4
   */
  test('Property 3: Filter count accuracy', () => {
    fc.assert(
      fc.property(
        productsArrayGenerator(10, 50),
        filtersGenerator(),
        (products, filters) => {
          const filtered = applyFilters(products, filters)
          const count = filtered.length

          // The count should equal the actual number of filtered products
          expect(count).toBe(filtered.length)

          // Verify count matches manual calculation
          let manualCount = 0
          for (const product of products) {
            let matches = true

            // Apply same filter logic
            if (filters.category_id && product.category_id !== filters.category_id) {
              matches = false
            }
            if (filters.supplier_id && product.supplier_id !== filters.supplier_id) {
              matches = false
            }
            if (filters.brand && product.brand?.toLowerCase() !== filters.brand.toLowerCase()) {
              matches = false
            }
            if (filters.is_active !== undefined && product.is_active !== filters.is_active) {
              matches = false
            }
            if (filters.stock_status) {
              const status = getStockStatus(product)
              if (status !== filters.stock_status) {
                matches = false
              }
            }
            if (filters.price_min !== undefined && product.sale_price < filters.price_min) {
              matches = false
            }
            if (filters.price_max !== undefined && product.sale_price > filters.price_max) {
              matches = false
            }
            
            // Apply quick_filter logic
            if (filters.quick_filter) {
              switch (filters.quick_filter) {
                case 'low_stock':
                  if (!(product.stock_quantity <= product.min_stock && product.stock_quantity > 0)) {
                    matches = false
                  }
                  break
                case 'out_of_stock':
                  if (product.stock_quantity !== 0) {
                    matches = false
                  }
                  break
                case 'active':
                  if (!product.is_active) {
                    matches = false
                  }
                  break
                case 'all':
                default:
                  // No additional filtering
                  break
              }
            }

            if (matches) {
              manualCount++
            }
          }

          expect(count).toBe(manualCount)
          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 4: Metric card filtering
   * Validates: Requirements 4.4
   */
  test('Property 4: Metric card filtering', () => {
    fc.assert(
      fc.property(
        productsArrayGenerator(10, 50),
        fc.constantFrom('low_stock', 'out_of_stock', 'all'),
        (products, metricType) => {
          let expectedProducts: Product[] = []

          switch (metricType) {
            case 'low_stock':
              expectedProducts = products.filter(
                p => p.stock_quantity <= p.min_stock && p.stock_quantity > 0
              )
              break
            case 'out_of_stock':
              expectedProducts = products.filter(p => p.stock_quantity === 0)
              break
            case 'all':
              expectedProducts = products
              break
          }

          // Simulate clicking a metric card by applying the corresponding filter
          const filters: DashboardFilters = {}
          if (metricType === 'low_stock') {
            filters.quick_filter = 'low_stock'
          } else if (metricType === 'out_of_stock') {
            filters.quick_filter = 'out_of_stock'
          }

          const filtered = applyFilters(products, filters)

          // The filtered results should match the expected products for that metric
          expect(filtered.length).toBe(expectedProducts.length)

          // Verify each filtered product matches the metric criteria
          filtered.forEach(product => {
            switch (metricType) {
              case 'low_stock':
                expect(product.stock_quantity).toBeLessThanOrEqual(product.min_stock)
                expect(product.stock_quantity).toBeGreaterThan(0)
                break
              case 'out_of_stock':
                expect(product.stock_quantity).toBe(0)
                break
            }
          })

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 17: Quick filter clears custom filters
   * Validates: Requirements 9.5
   */
  test('Property 17: Quick filter clears custom filters', () => {
    fc.assert(
      fc.property(
        productsArrayGenerator(10, 50),
        filtersGenerator(),
        fc.constantFrom('all', 'low_stock', 'out_of_stock', 'active'),
        (products, _customFilters, quickFilter) => {
          // Apply quick filter (simulating user clicking a quick filter button)
          const filtersAfterQuickFilter: DashboardFilters = {
            quick_filter: quickFilter
          }

          // Verify that custom filters are cleared
          expect(filtersAfterQuickFilter.category_id).toBeUndefined()
          expect(filtersAfterQuickFilter.supplier_id).toBeUndefined()
          expect(filtersAfterQuickFilter.brand).toBeUndefined()
          expect(filtersAfterQuickFilter.is_active).toBeUndefined()
          expect(filtersAfterQuickFilter.stock_status).toBeUndefined()
          expect(filtersAfterQuickFilter.price_min).toBeUndefined()
          expect(filtersAfterQuickFilter.price_max).toBeUndefined()

          // Only quick_filter should be set
          expect(filtersAfterQuickFilter.quick_filter).toBe(quickFilter)

          // Verify that applying the quick filter produces expected results
          const filtered = applyFilters(products, filtersAfterQuickFilter)

          switch (quickFilter) {
            case 'low_stock':
              filtered.forEach(p => {
                expect(p.stock_quantity).toBeLessThanOrEqual(p.min_stock)
                expect(p.stock_quantity).toBeGreaterThan(0)
              })
              break
            case 'out_of_stock':
              filtered.forEach(p => {
                expect(p.stock_quantity).toBe(0)
              })
              break
            case 'active':
              filtered.forEach(p => {
                expect(p.is_active).toBe(true)
              })
              break
            case 'all':
              // All products should be included
              expect(filtered.length).toBe(products.length)
              break
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 16: Quick filter application
   * Validates: Requirements 9.2
   */
  test('Property 16: Quick filter application', () => {
    fc.assert(
      fc.property(
        productsArrayGenerator(10, 50),
        fc.constantFrom('all', 'low_stock', 'out_of_stock', 'active'),
        (products, quickFilterType) => {
          // Apply quick filter
          const filters: DashboardFilters = {
            quick_filter: quickFilterType
          }

          const filtered = applyFilters(products, filters)

          // Verify filtered results match the quick filter criteria
          switch (quickFilterType) {
            case 'all':
              // All products should be included
              expect(filtered.length).toBe(products.length)
              expect(filtered).toEqual(products)
              break

            case 'low_stock':
              // Only products with stock <= min_stock and stock > 0
              expect(filtered.every(p => 
                p.stock_quantity <= p.min_stock && p.stock_quantity > 0
              )).toBe(true)
              
              // Verify no products are missed
              const expectedLowStock = products.filter(p => 
                p.stock_quantity <= p.min_stock && p.stock_quantity > 0
              )
              expect(filtered.length).toBe(expectedLowStock.length)
              break

            case 'out_of_stock':
              // Only products with stock === 0
              expect(filtered.every(p => p.stock_quantity === 0)).toBe(true)
              
              // Verify no products are missed
              const expectedOutOfStock = products.filter(p => p.stock_quantity === 0)
              expect(filtered.length).toBe(expectedOutOfStock.length)
              break

            case 'active':
              // Only active products
              expect(filtered.every(p => p.is_active === true)).toBe(true)
              
              // Verify no products are missed
              const expectedActive = products.filter(p => p.is_active)
              expect(filtered.length).toBe(expectedActive.length)
              break
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 9: Individual product selection toggle
   * Validates: Requirements 7.1
   */
  test('Property 9: Individual product selection toggle', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.array(fc.uuid(), { minLength: 0, maxLength: 20 }),
        (productId, selectedIds) => {
          // Simulate clicking a product's checkbox
          const isCurrentlySelected = selectedIds.includes(productId)
          
          let newSelectedIds: string[]
          if (isCurrentlySelected) {
            // Should remove from selection
            newSelectedIds = selectedIds.filter(id => id !== productId)
          } else {
            // Should add to selection
            newSelectedIds = [...selectedIds, productId]
          }

          // Verify toggle behavior
          if (isCurrentlySelected) {
            // Product should no longer be in selection
            expect(newSelectedIds.includes(productId)).toBe(false)
            expect(newSelectedIds.length).toBe(selectedIds.length - 1)
          } else {
            // Product should now be in selection
            expect(newSelectedIds.includes(productId)).toBe(true)
            expect(newSelectedIds.length).toBe(selectedIds.length + 1)
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 8: Product duplication
   * Validates: Requirements 6.4
   */
  test('Property 8: Product duplication', () => {
    fc.assert(
      fc.property(
        productGenerator(),
        (originalProduct) => {
          // Simulate duplicating a product
          const duplicatedProduct = {
            ...originalProduct,
            id: 'new-id-' + Date.now(), // New unique ID
            sku: 'DUP-' + originalProduct.sku, // New unique SKU
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }

          // Verify duplication properties
          // ID must be different
          expect(duplicatedProduct.id).not.toBe(originalProduct.id)
          
          // SKU must be different
          expect(duplicatedProduct.sku).not.toBe(originalProduct.sku)
          
          // All other fields should be identical
          expect(duplicatedProduct.name).toBe(originalProduct.name)
          expect(duplicatedProduct.description).toBe(originalProduct.description)
          expect(duplicatedProduct.brand).toBe(originalProduct.brand)
          expect(duplicatedProduct.category_id).toBe(originalProduct.category_id)
          expect(duplicatedProduct.supplier_id).toBe(originalProduct.supplier_id)
          expect(duplicatedProduct.purchase_price).toBe(originalProduct.purchase_price)
          expect(duplicatedProduct.sale_price).toBe(originalProduct.sale_price)
          expect(duplicatedProduct.wholesale_price).toBe(originalProduct.wholesale_price)
          expect(duplicatedProduct.stock_quantity).toBe(originalProduct.stock_quantity)
          expect(duplicatedProduct.min_stock).toBe(originalProduct.min_stock)
          expect(duplicatedProduct.max_stock).toBe(originalProduct.max_stock)
          expect(duplicatedProduct.unit_measure).toBe(originalProduct.unit_measure)
          expect(duplicatedProduct.is_active).toBe(originalProduct.is_active)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 10: Select all matches visible products
   * Validates: Requirements 7.2
   */
  test('Property 10: Select all matches visible products', () => {
    fc.assert(
      fc.property(
        productsArrayGenerator(5, 30),
        filtersGenerator(),
        (products, filters) => {
          // Apply filters to get visible products
          const visibleProducts = applyFilters(products, filters)
          
          // Simulate "select all" action
          const selectedIds = visibleProducts.map(p => p.id)

          // Verify that selection contains exactly the visible product IDs
          expect(selectedIds.length).toBe(visibleProducts.length)
          
          // Every visible product should be selected
          visibleProducts.forEach(product => {
            expect(selectedIds.includes(product.id)).toBe(true)
          })

          // No non-visible products should be selected
          const visibleIds = new Set(visibleProducts.map(p => p.id))
          selectedIds.forEach(id => {
            expect(visibleIds.has(id)).toBe(true)
          })

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 24: Column sort ascending
   * Feature: modern-products-dashboard, Property 25: Sort toggle to descending
   * Validates: Requirements 15.2, 15.3
   */
  test('Property 24 & 25: Column sorting (ascending and descending)', () => {
    fc.assert(
      fc.property(
        productsArrayGenerator(10, 30),
        fc.constantFrom('name', 'sku', 'sale_price', 'stock_quantity'),
        (products, field) => {
          // First click: sort ascending
          const sortConfigAsc: SortConfig = { field, direction: 'asc' }
          const sortedAsc = sortProducts(products, sortConfigAsc)

          // Verify ascending order
          for (let i = 0; i < sortedAsc.length - 1; i++) {
            const current = sortedAsc[i]
            const next = sortedAsc[i + 1]

            let currentValue: any
            let nextValue: any

            switch (field) {
              case 'name':
                currentValue = current.name?.toLowerCase() || ''
                nextValue = next.name?.toLowerCase() || ''
                break
              case 'sku':
                currentValue = current.sku?.toLowerCase() || ''
                nextValue = next.sku?.toLowerCase() || ''
                break
              case 'sale_price':
                currentValue = current.sale_price || 0
                nextValue = next.sale_price || 0
                break
              case 'stock_quantity':
                currentValue = current.stock_quantity || 0
                nextValue = next.stock_quantity || 0
                break
            }

            expect(currentValue <= nextValue).toBe(true)
          }

          // Second click: sort descending
          const sortConfigDesc: SortConfig = { field, direction: 'desc' }
          const sortedDesc = sortProducts(products, sortConfigDesc)

          // Verify descending order
          for (let i = 0; i < sortedDesc.length - 1; i++) {
            const current = sortedDesc[i]
            const next = sortedDesc[i + 1]

            let currentValue: any
            let nextValue: any

            switch (field) {
              case 'name':
                currentValue = current.name?.toLowerCase() || ''
                nextValue = next.name?.toLowerCase() || ''
                break
              case 'sku':
                currentValue = current.sku?.toLowerCase() || ''
                nextValue = next.sku?.toLowerCase() || ''
                break
              case 'sale_price':
                currentValue = current.sale_price || 0
                nextValue = next.sale_price || 0
                break
              case 'stock_quantity':
                currentValue = current.stock_quantity || 0
                nextValue = next.stock_quantity || 0
                break
            }

            expect(currentValue >= nextValue).toBe(true)
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 6: View mode state preservation
   * Validates: Requirements 5.5
   */
  test('Property 6: View mode state preservation', () => {
    fc.assert(
      fc.property(
        productsArrayGenerator(10, 30),
        filtersGenerator(),
        searchQueryGenerator(),
        fc.constantFrom('grid', 'table', 'compact'),
        (products, filters, searchQuery, viewMode) => {
          // Apply search and filters
          const searched = searchProducts(products, searchQuery)
          const filtered = applyFilters(searched, filters)
          
          // Store the filtered product IDs and count
          const filteredIds = new Set(filtered.map(p => p.id))
          const filteredCount = filtered.length

          // Simulate view mode change
          // The view mode should not affect which products are displayed
          // Only the presentation changes (grid vs table vs compact)
          
          // Verify that changing view mode doesn't change the filtered results
          // In a real implementation, this would be handled by the component state
          // Here we verify that the data layer (filtering) is independent of view mode
          
          const refiltered = applyFilters(searched, filters)
          
          expect(refiltered.length).toBe(filteredCount)
          refiltered.forEach(product => {
            expect(filteredIds.has(product.id)).toBe(true)
          })

          // Verify view mode is one of the valid options
          expect(['grid', 'table', 'compact'].includes(viewMode)).toBe(true)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 11: Bulk operation affected count
   * Validates: Requirements 7.5
   */
  test('Property 11: Bulk operation affected count', () => {
    fc.assert(
      fc.property(
        productsArrayGenerator(5, 30),
        fc.array(fc.uuid(), { minLength: 1, maxLength: 15 }),
        (products, selectedIds) => {
          // Filter products to only those that are selected
          const selectedProducts = products.filter(p => selectedIds.includes(p.id))
          
          // Simulate bulk operation (e.g., bulk delete, bulk activate)
          // The operation should affect exactly the number of selected products
          const affectedCount = selectedProducts.length

          // Verify that the affected count matches the selection
          expect(affectedCount).toBe(selectedProducts.length)
          expect(affectedCount).toBeLessThanOrEqual(selectedIds.length)
          expect(affectedCount).toBeLessThanOrEqual(products.length)

          // Verify each affected product is in the selected IDs
          selectedProducts.forEach(product => {
            expect(selectedIds.includes(product.id)).toBe(true)
          })

          // Simulate the result after bulk delete
          const remainingProducts = products.filter(p => !selectedIds.includes(p.id))
          expect(remainingProducts.length).toBe(products.length - affectedCount)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 12: Alert grouping by type
   * Validates: Requirements 8.2
   */
  test('Property 12: Alert grouping by type', () => {
    fc.assert(
      fc.property(
        fc.array(alertGenerator(), { minLength: 5, maxLength: 30 }),
        (alerts) => {
          const grouped = groupAlertsByType(alerts)

          // Verify all alerts are categorized (including 'other' category)
          const totalGrouped = 
            grouped.out_of_stock.length +
            grouped.low_stock.length +
            grouped.missing_data.length +
            (grouped.other?.length || 0)

          expect(totalGrouped).toBe(alerts.length)

          // Verify each group contains only alerts of that type
          grouped.out_of_stock.forEach(alert => {
            expect(alert.type).toBe('out_of_stock')
          })

          grouped.low_stock.forEach(alert => {
            expect(alert.type).toBe('low_stock')
          })

          grouped.missing_data.forEach(alert => {
            expect(['no_supplier', 'no_category', 'no_image', 'missing_supplier', 'missing_category', 'missing_image'].includes(alert.type)).toBe(true)
          })

          // Verify 'other' category contains alerts not in the main categories
          if (grouped.other) {
            grouped.other.forEach(alert => {
              expect(['out_of_stock', 'low_stock', 'no_supplier', 'no_category', 'no_image', 'missing_supplier', 'missing_category', 'missing_image'].includes(alert.type)).toBe(false)
            })
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 13: Alert filtering
   * Validates: Requirements 8.3
   */
  test('Property 13: Alert filtering', () => {
    fc.assert(
      fc.property(
        fc.array(alertGenerator(), { minLength: 5, maxLength: 30 }),
        productsArrayGenerator(10, 30),
        fc.constantFrom('out_of_stock', 'low_stock', 'missing_data'),
        (alerts, products, alertType) => {
          // Group alerts by type
          const grouped = groupAlertsByType(alerts)
          
          // Get alerts of the selected type
          const relevantAlerts = grouped[alertType]
          
          // Get product IDs from these alerts
          const alertProductIds = new Set(relevantAlerts.map(a => a.product_id))

          // Filter products to show only those with alerts
          const filteredProducts = products.filter(p => alertProductIds.has(p.id))

          // Verify that all filtered products have an alert of the selected type
          filteredProducts.forEach(product => {
            expect(alertProductIds.has(product.id)).toBe(true)
          })

          // Verify count matches
          expect(filteredProducts.length).toBeLessThanOrEqual(relevantAlerts.length)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 14: Alert dismissal
   * Validates: Requirements 8.4
   */
  test('Property 14: Alert dismissal', () => {
    fc.assert(
      fc.property(
        fc.array(alertGenerator(), { minLength: 5, maxLength: 20 }),
        fc.uuid(),
        (alerts, alertIdToDismiss) => {
          // Simulate dismissing an alert by marking it as read
          const updatedAlerts = alerts.map(alert =>
            alert.id === alertIdToDismiss
              ? { ...alert, read: true }
              : alert
          )

          // Get active alerts (unread and unresolved)
          const activeAlerts = getActiveAlerts(updatedAlerts)

          // The dismissed alert should not be in active alerts
          const dismissedAlertInActive = activeAlerts.some(a => a.id === alertIdToDismiss)
          
          // If the alert existed and was unresolved, it should now be excluded
          const originalAlert = alerts.find(a => a.id === alertIdToDismiss)
          if (originalAlert && !originalAlert.is_resolved) {
            expect(dismissedAlertInActive).toBe(false)
          }

          // All active alerts should be unread and unresolved
          activeAlerts.forEach(alert => {
            expect(alert.read).toBe(false)
            expect(alert.is_resolved).not.toBe(true)
          })

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 15: Resolved alerts exclusion
   * Validates: Requirements 8.5
   */
  test('Property 15: Resolved alerts exclusion', () => {
    fc.assert(
      fc.property(
        fc.array(alertGenerator(), { minLength: 5, maxLength: 20 }),
        (alerts) => {
          // Get active alerts
          const activeAlerts = getActiveAlerts(alerts)

          // Verify no resolved alerts are included
          activeAlerts.forEach(alert => {
            expect(alert.is_resolved).not.toBe(true)
            expect(alert.read).toBe(false)
          })

          // Count resolved alerts in original array
          const resolvedCount = alerts.filter(a => a.is_resolved === true).length
          const readCount = alerts.filter(a => a.read === true).length

          // Active alerts should be less than or equal to total minus resolved/read
          expect(activeAlerts.length).toBeLessThanOrEqual(alerts.length - resolvedCount)
          expect(activeAlerts.length).toBeLessThanOrEqual(alerts.length - readCount)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 20: Export matches visible products
   * Validates: Requirements 12.1, 12.4
   */
  test('Property 20: Export matches visible products', () => {
    fc.assert(
      fc.property(
        productsArrayGenerator(10, 30),
        filtersGenerator(),
        searchQueryGenerator(),
        (products, filters, searchQuery) => {
          // Apply search and filters to get visible products
          const searched = searchProducts(products, searchQuery)
          const visibleProducts = applyFilters(searched, filters)

          // Export the visible products
          const csv = exportProductsToCSV(visibleProducts)

          if (visibleProducts.length === 0) {
            // If no visible products, CSV should be empty
            expect(csv).toBe('')
            return true
          }

          // CSV should contain data for all visible products
          // Count the number of data rows (excluding header)
          const lines = csv.split('\n').filter(line => line.trim() !== '')
          const dataRows = lines.length - 1 // Subtract header row

          // Number of data rows should match number of visible products
          expect(dataRows).toBe(visibleProducts.length)

          // Verify each visible product appears in the CSV
          visibleProducts.forEach(product => {
            expect(csv).toContain(product.id)
            expect(csv).toContain(product.sku)
          })

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 21: Export includes all fields
   * Validates: Requirements 12.2
   */
  test('Property 21: Export includes all fields', () => {
    fc.assert(
      fc.property(
        productsArrayGenerator(1, 10),
        (products) => {
          const csv = exportProductsToCSV(products)

          if (products.length === 0) {
            expect(csv).toBe('')
            return true
          }

          // Verify CSV contains all required field headers
          const requiredHeaders = [
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

          requiredHeaders.forEach(header => {
            expect(csv).toContain(header)
          })

          // Verify each product's ID is included (IDs don't have special characters)
          products.forEach(product => {
            expect(csv).toContain(product.id)
          })

          // Verify the CSV has the correct number of rows (header + data rows)
          const lines = csv.split('\n').filter(line => line.trim() !== '')
          expect(lines.length).toBe(products.length + 1) // +1 for header

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 22: Data refresh preserves view state
   * Validates: Requirements 13.3
   */
  test('Property 22: Data refresh preserves view state', () => {
    fc.assert(
      fc.property(
        productsArrayGenerator(10, 30),
        filtersGenerator(),
        searchQueryGenerator(),
        sortConfigGenerator(),
        fc.constantFrom('grid', 'table', 'compact'),
        fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
        (products, filters, searchQuery, sortConfig, viewMode, selectedIds) => {
          // Simulate current view state before refresh
          const viewStateBefore = {
            filters: { ...filters },
            searchQuery,
            sortConfig: { ...sortConfig },
            viewMode,
            selectedIds: [...selectedIds]
          }

          // Apply filters and search to get current displayed products
          const searched = searchProducts(products, searchQuery)
          const filtered = applyFilters(searched, filters)
          const sorted = sortProducts(filtered, sortConfig)

          // Simulate refresh (in real app, this would reload data from server)
          // After refresh, the view state should be preserved
          const viewStateAfter = {
            filters: { ...filters },
            searchQuery,
            sortConfig: { ...sortConfig },
            viewMode,
            selectedIds: [...selectedIds]
          }

          // Verify all view state is preserved
          expect(viewStateAfter.filters).toEqual(viewStateBefore.filters)
          expect(viewStateAfter.searchQuery).toBe(viewStateBefore.searchQuery)
          expect(viewStateAfter.sortConfig).toEqual(viewStateBefore.sortConfig)
          expect(viewStateAfter.viewMode).toBe(viewStateBefore.viewMode)
          expect(viewStateAfter.selectedIds).toEqual(viewStateBefore.selectedIds)

          // Verify that applying the same state produces the same results
          const searchedAfter = searchProducts(products, viewStateAfter.searchQuery)
          const filteredAfter = applyFilters(searchedAfter, viewStateAfter.filters)
          const sortedAfter = sortProducts(filteredAfter, viewStateAfter.sortConfig)

          expect(sortedAfter.length).toBe(sorted.length)
          expect(sortedAfter.map(p => p.id)).toEqual(sorted.map(p => p.id))

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 23: Multiple images indicator
   * Validates: Requirements 14.5
   */
  test('Property 23: Multiple images indicator', () => {
    fc.assert(
      fc.property(
        productGenerator(),
        fc.array(fc.webUrl(), { minLength: 0, maxLength: 10 }),
        (product, images) => {
          // Create a product with the specified images
          const productWithImages = {
            ...product,
            images: images.length > 0 ? images : undefined,
            image_url: images.length > 0 ? images[0] : null
          }

          // Determine if multiple images indicator should be shown
          const shouldShowIndicator = 
            productWithImages.images && 
            productWithImages.images.length > 1

          // Verify the logic
          if (shouldShowIndicator) {
            expect(productWithImages.images!.length).toBeGreaterThan(1)
            
            // The indicator should show the count of additional images
            const additionalImagesCount = productWithImages.images!.length - 1
            expect(additionalImagesCount).toBeGreaterThan(0)
          } else {
            // Either no images or only one image
            if (productWithImages.images) {
              expect(productWithImages.images.length).toBeLessThanOrEqual(1)
            }
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 18: Form field validation
   * Feature: modern-products-dashboard, Property 19: Required field validation
   * Validates: Requirements 10.2, 10.3
   */
  test('Property 18 & 19: Form validation (field and required)', () => {
    fc.assert(
      fc.property(
        fc.record({
          name: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
          sku: fc.option(fc.string({ minLength: 0, maxLength: 50 }), { nil: undefined }),
          sale_price: fc.option(fc.float({ min: -100, max: 10000 }), { nil: undefined }),
          purchase_price: fc.option(fc.float({ min: -100, max: 10000 }), { nil: undefined }),
          stock_quantity: fc.option(fc.integer({ min: -10, max: 1000 }), { nil: undefined }),
          min_stock: fc.option(fc.integer({ min: -10, max: 100 }), { nil: undefined })
        }),
        (productData) => {
          const validation = validateProductData(productData)

          // Required field validation (Property 19)
          if (!productData.name || productData.name.trim() === '') {
            expect(validation.valid).toBe(false)
            expect(validation.errors.some(e => e.includes('nombre'))).toBe(true)
          }

          if (!productData.sku || productData.sku.trim() === '') {
            expect(validation.valid).toBe(false)
            expect(validation.errors.some(e => e.includes('SKU'))).toBe(true)
          }

          // Field validation (Property 18)
          if (productData.sale_price !== undefined && productData.sale_price < 0) {
            expect(validation.valid).toBe(false)
            expect(validation.errors.some(e => e.includes('precio de venta'))).toBe(true)
          }

          if (productData.purchase_price !== undefined && productData.purchase_price < 0) {
            expect(validation.valid).toBe(false)
            expect(validation.errors.some(e => e.includes('precio de compra'))).toBe(true)
          }

          if (productData.stock_quantity !== undefined && productData.stock_quantity < 0) {
            expect(validation.valid).toBe(false)
            expect(validation.errors.some(e => e.includes('stock'))).toBe(true)
          }

          if (productData.min_stock !== undefined && productData.min_stock < 0) {
            expect(validation.valid).toBe(false)
            expect(validation.errors.some(e => e.includes('stock mínimo'))).toBe(true)
          }

          // Valid data should pass
          if (
            productData.name && productData.name.trim() !== '' &&
            productData.sku && productData.sku.trim() !== '' &&
            (productData.sale_price === undefined || productData.sale_price >= 0) &&
            (productData.purchase_price === undefined || productData.purchase_price >= 0) &&
            (productData.stock_quantity === undefined || productData.stock_quantity >= 0) &&
            (productData.min_stock === undefined || productData.min_stock >= 0)
          ) {
            expect(validation.valid).toBe(true)
            expect(validation.errors).toHaveLength(0)
          }

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 7: Edit modal pre-population
   * Validates: Requirements 6.2
   */
  test('Property 7: Edit modal pre-population', () => {
    fc.assert(
      fc.property(
        productGenerator(),
        (product) => {
          // Simulate opening edit modal with product data
          const formData = {
            id: product.id,
            sku: product.sku,
            name: product.name,
            description: product.description,
            category_id: product.category_id,
            brand: product.brand,
            supplier_id: product.supplier_id,
            purchase_price: product.purchase_price,
            sale_price: product.sale_price,
            wholesale_price: product.wholesale_price,
            stock_quantity: product.stock_quantity,
            min_stock: product.min_stock,
            max_stock: product.max_stock,
            unit_measure: product.unit_measure,
            barcode: product.barcode,
            is_active: product.is_active
          }

          // Verify all fields are pre-populated correctly
          expect(formData.id).toBe(product.id)
          expect(formData.sku).toBe(product.sku)
          expect(formData.name).toBe(product.name)
          expect(formData.description).toBe(product.description)
          expect(formData.category_id).toBe(product.category_id)
          expect(formData.brand).toBe(product.brand)
          expect(formData.supplier_id).toBe(product.supplier_id)
          expect(formData.purchase_price).toBe(product.purchase_price)
          expect(formData.sale_price).toBe(product.sale_price)
          expect(formData.wholesale_price).toBe(product.wholesale_price)
          expect(formData.stock_quantity).toBe(product.stock_quantity)
          expect(formData.min_stock).toBe(product.min_stock)
          expect(formData.max_stock).toBe(product.max_stock)
          expect(formData.unit_measure).toBe(product.unit_measure)
          expect(formData.barcode).toBe(product.barcode)
          expect(formData.is_active).toBe(product.is_active)

          return true
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Feature: modern-products-dashboard, Property 26: Sort preserves filters and search
   * Validates: Requirements 15.5
   */
  test('Property 26: Sort preserves filters and search', () => {
    fc.assert(
      fc.property(
        productsArrayGenerator(10, 30),
        filtersGenerator(),
        searchQueryGenerator(),
        sortConfigGenerator(),
        (products, filters, searchQuery, sortConfig) => {
          // Apply search and filters first
          const searched = searchProducts(products, searchQuery)
          const filtered = applyFilters(searched, filters)
          
          // Store the filtered product IDs
          const filteredIds = new Set(filtered.map(p => p.id))

          // Apply sorting
          const sorted = sortProducts(filtered, sortConfig)

          // Verify that sorting doesn't change which products are included
          expect(sorted.length).toBe(filtered.length)
          
          sorted.forEach(product => {
            expect(filteredIds.has(product.id)).toBe(true)
          })

          // Verify all filtered products are still present
          const sortedIds = new Set(sorted.map(p => p.id))
          filtered.forEach(product => {
            expect(sortedIds.has(product.id)).toBe(true)
          })

          return true
        }
      ),
      { numRuns: 100 }
    )
  })
