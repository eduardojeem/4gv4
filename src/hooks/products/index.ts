// Hooks compuestos para productos
export { useProductManagement } from './useProductManagement'
export { useProductFiltering } from './useProductFiltering'
export { useProductAnalytics } from './useProductAnalytics'
export { useProductOperations } from './useProductOperations'
export { useProductSearch } from './useProductSearch'

// Re-exportar hooks individuales existentes
export { useProductsSupabase } from '../useProductsSupabase'
export { usePOSProducts } from '../usePOSProducts'
export { useProducts } from '../useProducts'
export { useCatalogSync } from '../use-catalog-sync'

// Tipos compartidos
export type {
  ProductFilters,
  ProductSort,
  PaginationOptions,
  DashboardStats
} from './types'