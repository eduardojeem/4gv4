import type { Database } from '@/lib/supabase/types'

// Tipos base de la base de datos
export type Product = Database['public']['Tables']['products']['Row'] & {
  category?: Database['public']['Tables']['categories']['Row']
  supplier?: Database['public']['Tables']['suppliers']['Row']
  margin_amount?: number
  margin_percentage?: number
  stock_value?: number
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock'
  // Added properties based on usage
  price: number
  stock: number
  cost: number
  createdAt: string
  isFeatured?: boolean
  minStock?: number
}

export type Category = Database['public']['Tables']['categories']['Row']
export type Supplier = Database['public']['Tables']['suppliers']['Row']
export type ProductMovement = Database['public']['Tables']['product_movements']['Row']
export type ProductAlert = Database['public']['Tables']['product_alerts']['Row']

// Interfaces para filtros y ordenamiento
export interface ProductFilters {
  search?: string
  category?: string
  supplier?: string
  stockStatus?: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  priceMin?: number
  priceMax?: number
  isActive?: boolean
  featured?: boolean
  // Added properties based on usage
  isFeatured?: boolean
  priceRange?: { min: number; max: number }
  stockRange?: { min: number; max: number }
  marginRange?: { min: number; max: number }
  dateRange?: { start: Date | null; end: Date | null }
}

export interface ProductSort {
  field: 'name' | 'sku' | 'category' | 'price' | 'stock' | 'supplier' | 'margin' | 'created_at'
  direction: 'asc' | 'desc'
}

export interface PaginationOptions {
  page: number
  limit: number
}

// Estadísticas del dashboard
export interface DashboardStats {
  totalProducts: number
  activeProducts: number
  totalStockValue: number
  totalCostValue: number
  totalMargin: number
  avgMarginPercentage: number
  lowStockCount: number
  outOfStockCount: number
  categoriesCount: number
  suppliersCount: number
}

// Estados de carga y error
export interface LoadingState {
  loading: boolean
  error: string | null
}

// Respuesta de operaciones
export interface OperationResult<T = any> {
  success: boolean
  data?: T
  error?: string
}

// Configuración de búsqueda
export interface SearchConfig {
  fields: string[]
  fuzzy?: boolean
  minLength?: number
  debounceMs?: number
}

// Configuración de analytics
export interface AnalyticsConfig {
  includeMovements?: boolean
  includeAlerts?: boolean
  dateRange?: {
    start: Date
    end: Date
  }
}

// Retorno mínimo utilizado por componentes de filtros avanzados
export interface ProductFilteringReturn {
  filteredProducts: Product[]
  filters: ProductFilters & Record<string, any>
  advancedFilters: {
    priceRange: { min: number; max: number }
    stockRange: { min: number; max: number }
    marginRange: { min: number; max: number }
    dateRange: { start: Date | null; end: Date | null }
    tags: string[]
  }
  filterPresets: Record<string, ProductFilters>
  searchTerm: string
  setSearchTerm: (term: string) => void
  updateFilter: (key: keyof ProductFilters, value: any) => void
  updateFilters: (partial: Partial<ProductFilters>) => void
  updateAdvancedFilter: (key: string, value: any) => void
  clearFilters: () => void
  applyPreset: (presetName: string) => void
  savePreset: (name: string, filters: ProductFilters) => void
  setFilters: (filters: ProductFilters | ((prev: ProductFilters) => ProductFilters)) => void
  setAdvancedFilters: (filters: any | ((prev: any) => any)) => void
  activeFiltersCount: number
  categories: Category[]
  suppliers: Supplier[]
  priceRange: { min: number; max: number }
  stockRange: { min: number; max: number }
  marginRange: { min: number; max: number }
  filterStats: {
    totalProducts: number
    filteredCount: number
    byCategory: Record<string, number>
    bySupplier: Record<string, number>
    byStockStatus: Record<string, number>
    priceRange: { min: number; max: number }
    stockRange: { min: number; max: number }
  }
  dataRanges: {
    price: { min: number; max: number }
    stock: { min: number; max: number }
    margin: { min: number; max: number }
  } | null

  // Added error handling and performance properties
  lastError: any
  retryLastOperation: () => Promise<{ success: boolean; error?: string }>
  clearError: () => void
  getPerformanceReport: () => any
  clearPerformanceData: () => void

  // Added utility properties
  debouncedSearch: string
  fuzzyMatch: (text: string, search: string) => boolean
  validateSearchConfig: (config: SearchConfig) => boolean
}
