import { describe, expect, it } from 'vitest'
import { buildQuickItemPayload, getQuickItemApiError } from '../quick-item'

describe('buildQuickItemPayload', () => {
  it('normalizes a quick item for the products API', () => {
    expect(buildQuickItemPayload({
      name: '  Cambio de pin  ',
      price: '150000',
      quantity: '2',
      sku: '  pin-001  ',
      publishToCatalog: false,
    })).toEqual({
      name: 'Cambio de pin',
      sku: 'PIN-001',
      description: 'Item rapido creado desde POS',
      purchase_price: 0,
      sale_price: 150000,
      stock_quantity: 2,
      min_stock: 0,
      unit_measure: 'unidad',
      is_active: true,
      visibility: 'hidden',
    })
  })

  it('rejects invalid quick item values', () => {
    expect(() => buildQuickItemPayload({
      name: 'A',
      price: '0',
      quantity: '0',
      sku: '',
      publishToCatalog: true,
    })).toThrow('El nombre debe tener al menos 2 caracteres.')
  })
})

describe('getQuickItemApiError', () => {
  it('uses validation detail returned by the products API', () => {
    expect(getQuickItemApiError({
      error: 'Validation failed',
      details: [{ field: 'sku', message: 'SKU can only contain letters' }],
    })).toBe('sku: SKU can only contain letters')
  })
})
