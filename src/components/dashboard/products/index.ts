// Índice principal de componentes de productos
// Permite imports limpios desde cualquier parte de la aplicación

// Core Components
export { ProductCard } from '../product-card'
export { ProductTable } from '../product-table'
export { default as EnhancedProductList } from '../enhanced-product-list'
export { default as SimpleProductList } from '../simple-product-list'

// Forms and Modals
export { ProductForm } from '../product-form'
export { ProductModal } from '../product-modal'
export { BulkProductActions } from '../bulk-product-actions'
export { ProductQuickView } from '../product-quick-view'

// Filters and Search
export { ProductFilters } from '../product-filters'
export { AdvancedProductFilters } from '../advanced-product-filters'

// Stats and Analytics
export { ProductStats } from '../product-stats'
export { InventoryAnalytics } from '../inventory-analytics'
export { ProductCharts } from '../product-charts'

// Alerts and Notifications
export { ProductNotifications } from '../product-notifications'
export { InventoryAlertsPanel } from '../inventory-alerts-panel'
export { ProductAlerts } from '../product-alerts'
export { LowStockAlert } from '../low-stock-alert'

// Shared Components
export { ProductCardSkeletonGrid, ProductCardSkeleton } from '../product-card-skeleton'

// Re-export types for convenience
export type { Product, ProductAlert, Category, Supplier } from '../../../types/products'