import { describe, expect, it } from 'vitest'
import { buildQuickItemPayload, getQuickItemApiError, getQuickItemMargin } from '../quick-item'

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

describe('buildQuickItemPayload — precios de compra y mayorista', () => {
  const base = {
    name: 'Cargador',
    price: '150000',
    quantity: '1',
    sku: 'CRG-1',
    publishToCatalog: false,
  }

  it('incluye compra y mayorista cuando se cargan', () => {
    const payload = buildQuickItemPayload({
      ...base,
      purchasePrice: '80000',
      wholesalePrice: '120000',
    })

    expect(payload.purchase_price).toBe(80000)
    expect(payload.wholesale_price).toBe(120000)
    expect(payload.sale_price).toBe(150000)
  })

  it('omite el mayorista cuando se deja vacio', () => {
    const payload = buildQuickItemPayload({ ...base, purchasePrice: '80000', wholesalePrice: '   ' })

    expect(payload.purchase_price).toBe(80000)
    expect('wholesale_price' in payload).toBe(false)
  })

  it('mantiene el costo en 0 si no se carga, como antes', () => {
    const payload = buildQuickItemPayload(base)

    expect(payload.purchase_price).toBe(0)
    expect('wholesale_price' in payload).toBe(false)
  })

  it('rechaza precios negativos', () => {
    expect(() => buildQuickItemPayload({ ...base, purchasePrice: '-1' }))
      .toThrow(/precio de compra no puede ser negativo/i)
    expect(() => buildQuickItemPayload({ ...base, wholesalePrice: '-1' }))
      .toThrow(/precio mayorista no puede ser negativo/i)
  })

  it('rechaza texto que no es un numero', () => {
    expect(() => buildQuickItemPayload({ ...base, purchasePrice: 'abc' }))
      .toThrow(/numero valido/i)
  })

  // Mismas reglas cruzadas que aplica la API: si no se validan aca, el error
  // vuelve del servidor apuntando a un campo que el dialogo no muestra.
  it('exige que la venta supere a la compra', () => {
    expect(() => buildQuickItemPayload({ ...base, price: '80000', purchasePrice: '80000' }))
      .toThrow(/venta debe ser mayor al precio de compra/i)
  })

  it('exige que el mayorista quede entre la compra y la venta', () => {
    expect(() => buildQuickItemPayload({ ...base, purchasePrice: '80000', wholesalePrice: '150000' }))
      .toThrow(/mayorista debe ser menor al precio de venta/i)

    expect(() => buildQuickItemPayload({ ...base, purchasePrice: '80000', wholesalePrice: '70000' }))
      .toThrow(/mayorista debe ser mayor al precio de compra/i)
  })

  it('acepta un mayorista valido justo entre ambos', () => {
    expect(() => buildQuickItemPayload({
      ...base,
      purchasePrice: '80000',
      wholesalePrice: '80001',
    })).not.toThrow()
  })
})

describe('getQuickItemMargin', () => {
  it('calcula ganancia y porcentaje sobre el costo', () => {
    expect(getQuickItemMargin(100000, 150000)).toEqual({ profit: 50000, percent: 50 })
  })

  it('no calcula margen sin costo cargado', () => {
    expect(getQuickItemMargin(0, 150000)).toBeNull()
  })

  it('no rompe con valores invalidos', () => {
    expect(getQuickItemMargin(Number.NaN, 150000)).toBeNull()
  })
})
