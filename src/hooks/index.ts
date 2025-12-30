// Hooks principales
export { useAuth } from './use-auth'
export { useProducts } from './use-products'
export { useMobile } from './use-mobile'
export { useDebounce } from './use-debounce'
export { usePermissions } from './use-permissions'

// Hooks de productos
export { useProducts as useProductsHook } from './useProducts'
export { useProductsSupabase } from './useProductsSupabase'
export { usePOSProducts } from './usePOSProducts'
export { useProductAlerts } from './useProductAlerts'

// Hooks de rendimiento
export { useVirtualScroll } from './use-virtual-scroll'
export { useVirtualList } from './use-virtual-list'

// Hooks de administración
export { useAdminDashboard } from './use-admin-dashboard'
export { useAccessibility } from './use-accessibility'
export { useAccessibilityImprovements } from './use-accessibility-improvements'

// Hooks de configuración
export { useConfigurationManager } from './use-configuration-manager'
export { useConfigurationSearch } from './use-configuration-search'

// Hooks de clientes
export { useCustomerActions } from './use-customer-actions'
export { useCustomerState } from './use-customer-state'

// Hooks de utilidades
export { useIntervalManager } from './use-interval-manager'
export { useOptimizedNotifications } from './use-optimized-notifications'
export { useCatalogSync } from './use-catalog-sync'