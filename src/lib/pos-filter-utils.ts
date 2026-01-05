/**
 * Utilidades para gestión de filtros POS
 */

export interface POSFilters {
  searchTerm: string
  selectedCategory: string
  showFeatured: boolean
  stockFilter: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  priceRange: { min: number; max: number }
  sortBy: 'name' | 'price' | 'stock' | 'category'
  sortOrder: 'asc' | 'desc'
  itemsPerPage: number
  currentPage: number
}

export const DEFAULT_POS_FILTERS: POSFilters = {
  searchTerm: '',
  selectedCategory: 'all',
  showFeatured: false,
  stockFilter: 'all',
  priceRange: { min: 0, max: 1000000 }, // Rango amplio por defecto
  sortBy: 'name',
  sortOrder: 'asc',
  itemsPerPage: 48, // Más productos por página
  currentPage: 1
}

/**
 * Limpia todos los filtros y restaura valores por defecto
 */
export function clearAllPOSFilters(): POSFilters {
  // Limpiar localStorage
  if (typeof window !== 'undefined') {
    localStorage.removeItem('pos.prefs')
    localStorage.removeItem('pos.cart')
  }
  
  return { ...DEFAULT_POS_FILTERS }
}

/**
 * Detecta si hay filtros activos que puedan estar limitando resultados
 */
export function detectActiveFilters(filters: Partial<POSFilters>): string[] {
  const activeFilters: string[] = []
  
  if (filters.searchTerm && filters.searchTerm.trim() !== '') {
    activeFilters.push(`Búsqueda: "${filters.searchTerm}"`)
  }
  
  if (filters.selectedCategory && filters.selectedCategory !== 'all') {
    activeFilters.push(`Categoría: ${filters.selectedCategory}`)
  }
  
  if (filters.showFeatured) {
    activeFilters.push('Solo productos destacados')
  }
  
  if (filters.stockFilter && filters.stockFilter !== 'all') {
    const stockLabels = {
      'in_stock': 'Solo en stock',
      'low_stock': 'Solo stock bajo',
      'out_of_stock': 'Solo sin stock'
    }
    activeFilters.push(`Stock: ${stockLabels[filters.stockFilter]}`)
  }
  
  if (filters.priceRange && (filters.priceRange.min > 0 || filters.priceRange.max < 1000000)) {
    activeFilters.push(`Precio: ${filters.priceRange.min} - ${filters.priceRange.max}`)
  }
  
  return activeFilters
}

/**
 * Calcula estadísticas de filtrado
 */
export function calculateFilterStats(totalProducts: number, filteredProducts: number) {
  const filteredCount = filteredProducts
  const hiddenCount = totalProducts - filteredProducts
  const visibilityPercentage = totalProducts > 0 ? Math.round((filteredProducts / totalProducts) * 100) : 0
  
  return {
    total: totalProducts,
    visible: filteredCount,
    hidden: hiddenCount,
    visibilityPercentage
  }
}

/**
 * Genera recomendaciones para mejorar la visibilidad de productos
 */
export function generateFilterRecommendations(
  stats: ReturnType<typeof calculateFilterStats>,
  activeFilters: string[]
): string[] {
  const recommendations: string[] = []
  
  if (stats.visibilityPercentage < 50) {
    recommendations.push('Considera limpiar algunos filtros para ver más productos')
  }
  
  if (activeFilters.length > 2) {
    recommendations.push('Tienes muchos filtros activos, prueba reducirlos')
  }
  
  if (stats.hidden > 20) {
    recommendations.push(`${stats.hidden} productos están ocultos por los filtros actuales`)
  }
  
  if (activeFilters.some(f => f.includes('Precio'))) {
    recommendations.push('Verifica que el rango de precios no sea muy restrictivo')
  }
  
  return recommendations
}
