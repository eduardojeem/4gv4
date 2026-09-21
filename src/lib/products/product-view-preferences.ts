import type { GroupByMode, ViewMode } from '@/types/products-dashboard'

export interface ProductViewPreferences {
  /** Alcance del catálogo predeterminado */
  defaultScope: 'products' | 'services' | 'all'
  /** Desglose por secciones (none = Sin desglose / Lista continua) */
  groupBy: GroupByMode
  /** Modo de visualización (tabla, compacta, tarjetas) */
  viewMode: ViewMode
  /** Cantidad de productos por página */
  itemsPerPage: number
  /** Si arranca en modo de espacio maximizado */
  isMaximizedSpace: boolean
}

export const PRODUCT_VIEW_PREFERENCES_KEY = 'products.view_preferences.v1'

export const DEFAULT_PRODUCT_VIEW_PREFERENCES: ProductViewPreferences = {
  defaultScope: 'products',
  groupBy: 'none',
  viewMode: 'table',
  itemsPerPage: 20,
  isMaximizedSpace: false,
}

export function loadProductViewPreferences(): ProductViewPreferences {
  if (typeof window === 'undefined') return DEFAULT_PRODUCT_VIEW_PREFERENCES
  try {
    const raw = localStorage.getItem(PRODUCT_VIEW_PREFERENCES_KEY)
    if (!raw) return DEFAULT_PRODUCT_VIEW_PREFERENCES

    const parsed = JSON.parse(raw) as Partial<ProductViewPreferences>

    const validScope: ProductViewPreferences['defaultScope'] =
      parsed.defaultScope === 'services' || parsed.defaultScope === 'all'
        ? parsed.defaultScope
        : 'products'

    const validGroupBy: GroupByMode =
      parsed.groupBy === 'type' || parsed.groupBy === 'category'
        ? parsed.groupBy
        : 'none'

    const validViewMode: ViewMode =
      parsed.viewMode === 'grid' || parsed.viewMode === 'compact'
        ? parsed.viewMode
        : 'table'

    const validItemsPerPage =
      typeof parsed.itemsPerPage === 'number' && [10, 20, 50, 100].includes(parsed.itemsPerPage)
        ? parsed.itemsPerPage
        : 20

    return {
      defaultScope: validScope,
      groupBy: validGroupBy,
      viewMode: validViewMode,
      itemsPerPage: validItemsPerPage,
      isMaximizedSpace: Boolean(parsed.isMaximizedSpace),
    }
  } catch {
    return DEFAULT_PRODUCT_VIEW_PREFERENCES
  }
}

export function saveProductViewPreferences(prefs: ProductViewPreferences): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(PRODUCT_VIEW_PREFERENCES_KEY, JSON.stringify(prefs))
  } catch (error) {
    console.warn('Error saving product view preferences:', error)
  }
}

export function clearProductViewPreferences(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(PRODUCT_VIEW_PREFERENCES_KEY)
  } catch (error) {
    console.warn('Error clearing product view preferences:', error)
  }
}

export function describeProductViewPreferences(prefs: ProductViewPreferences): string {
  const scopeLabel =
    prefs.defaultScope === 'products'
      ? 'Solo Productos'
      : prefs.defaultScope === 'services'
      ? 'Solo Servicios'
      : 'Todo el catálogo'

  const groupLabel =
    prefs.groupBy === 'none'
      ? 'Sin desglose (Lista continua)'
      : prefs.groupBy === 'type'
      ? 'Desglose por tipo'
      : 'Desglose por categoría'

  const viewLabel =
    prefs.viewMode === 'table'
      ? 'Vista Tabla'
      : prefs.viewMode === 'compact'
      ? 'Vista Compacta'
      : 'Vista Cuadrícula'

  return `${scopeLabel} · ${groupLabel} · ${viewLabel} · ${prefs.itemsPerPage} ítems/pág`
}
