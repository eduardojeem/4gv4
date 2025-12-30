/**
 * Type definitions for the Modern Products Dashboard
 */

import { Product, ProductFilters as BaseProductFilters, ProductAlert, Category, Supplier } from './products'

// Extended filter interface for dashboard
export interface DashboardFilters extends BaseProductFilters {
  quick_filter?: 'all' | 'low_stock' | 'out_of_stock' | 'active' | null
}

// Sort configuration
export interface SortConfig {
  field: 'name' | 'sku' | 'sale_price' | 'stock_quantity' | 'created_at' | 'updated_at'
  direction: 'asc' | 'desc'
}

// View modes
export type ViewMode = 'grid' | 'table' | 'compact'

// Dashboard metrics
export interface DashboardMetrics {
  total_products: number
  low_stock_count: number
  out_of_stock_count: number
  inventory_value: number
  active_products: number
}

// Dashboard state
export interface DashboardState {
  // Data
  products: Product[]
  filteredProducts: Product[]
  categories: Category[]
  suppliers: Supplier[]
  alerts: ProductAlert[]
  
  // UI State
  viewMode: ViewMode
  searchQuery: string
  filters: DashboardFilters
  sortConfig: SortConfig
  selectedProductIds: string[]
  
  // Modal State
  isCreateModalOpen: boolean
  editingProduct: Product | null
  
  // Loading State
  isLoading: boolean
  isRefreshing: boolean
  
  // Filter Panel
  isFilterPanelOpen: boolean
}

// Bulk action types
export type BulkActionType = 'delete' | 'export' | 'activate' | 'deactivate' | 'edit'

// Alert types grouped
export interface GroupedAlerts {
  out_of_stock: ProductAlert[]
  low_stock: ProductAlert[]
  missing_data: ProductAlert[]
  other: ProductAlert[]
}

// Filter result
export interface FilterResult {
  products: Product[]
  count: number
}

// Export options
export interface ExportOptions {
  products: Product[]
  includeFields?: string[]
  filename?: string
}

// Search options
export interface SearchOptions {
  query: string
  fields: ('name' | 'sku' | 'brand' | 'description')[]
  caseSensitive?: boolean
}

// Inventory Alert type for compatibility
export interface InventoryAlert {
  id: string
  productId: string
  type: 'low_stock' | 'out_of_stock' | 'expiring' | 'price_change'
  message: string
  severity: 'low' | 'medium' | 'high'
  created_at: string
  resolved: boolean
}
