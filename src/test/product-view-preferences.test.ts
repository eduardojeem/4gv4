import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  PRODUCT_VIEW_PREFERENCES_KEY,
  DEFAULT_PRODUCT_VIEW_PREFERENCES,
  loadProductViewPreferences,
  saveProductViewPreferences,
  clearProductViewPreferences,
  describeProductViewPreferences,
  type ProductViewPreferences,
} from '@/lib/products/product-view-preferences'

describe('product-view-preferences', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('devuelve la configuración por defecto si no hay nada guardado', () => {
    const prefs = loadProductViewPreferences()
    expect(prefs).toEqual(DEFAULT_PRODUCT_VIEW_PREFERENCES)
    expect(prefs.groupBy).toBe('none')
    expect(prefs.defaultScope).toBe('products')
    expect(prefs.viewMode).toBe('table')
  })

  it('guarda y recupera la configuración de desglose y filtro elegida por el usuario', () => {
    const customPrefs: ProductViewPreferences = {
      defaultScope: 'all',
      groupBy: 'none',
      viewMode: 'compact',
      itemsPerPage: 50,
      isMaximizedSpace: true,
    }

    saveProductViewPreferences(customPrefs)

    const loaded = loadProductViewPreferences()
    expect(loaded).toEqual(customPrefs)
    expect(loaded.groupBy).toBe('none') // Sin desglose (Lista continua)
    expect(loaded.defaultScope).toBe('all')
    expect(loaded.viewMode).toBe('compact')
    expect(loaded.itemsPerPage).toBe(50)
  })

  it('sanea valores inválidos en caso de datos corruptos en localStorage', () => {
    localStorage.setItem(
      PRODUCT_VIEW_PREFERENCES_KEY,
      JSON.stringify({
        defaultScope: 'invalid_scope',
        groupBy: 'unknown_group',
        viewMode: '3d_cube',
        itemsPerPage: 9999,
      })
    )

    const loaded = loadProductViewPreferences()
    expect(loaded.defaultScope).toBe('products')
    expect(loaded.groupBy).toBe('none')
    expect(loaded.viewMode).toBe('table')
    expect(loaded.itemsPerPage).toBe(20)
  })

  it('limpia las preferencias correctamente', () => {
    saveProductViewPreferences({
      defaultScope: 'services',
      groupBy: 'type',
      viewMode: 'grid',
      itemsPerPage: 10,
      isMaximizedSpace: false,
    })

    clearProductViewPreferences()
    expect(loadProductViewPreferences()).toEqual(DEFAULT_PRODUCT_VIEW_PREFERENCES)
  })

  it('genera una descripción humana legible de la configuración', () => {
    const desc = describeProductViewPreferences({
      defaultScope: 'products',
      groupBy: 'none',
      viewMode: 'table',
      itemsPerPage: 20,
      isMaximizedSpace: false,
    })

    expect(desc).toContain('Solo Productos')
    expect(desc).toContain('Sin desglose (Lista continua)')
    expect(desc).toContain('Vista Tabla')
  })
})
