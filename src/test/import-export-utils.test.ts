import { describe, it, expect, vi } from 'vitest'
import {
  normalizeHeaderKey,
  parseSmartNumber,
  mapHeaderToField,
  exportCatalogToCSV,
} from '@/lib/products/import-export-utils'

describe('import-export-utils', () => {
  it('normaliza correctamente encabezados con tildes y caracteres especiales', () => {
    expect(normalizeHeaderKey('Código de Barras')).toBe('codigo_de_barras')
    expect(normalizeHeaderKey('Categoría')).toBe('categoria')
    expect(normalizeHeaderKey('Precio de Venta (Gs.)')).toBe('precio_de_venta_gs')
    expect(normalizeHeaderKey('  DESCRIPCIÓN  ')).toBe('descripcion')
  })

  it('mapea encabezados a los campos canónicos del producto', () => {
    expect(mapHeaderToField('producto')).toBe('name')
    expect(mapHeaderToField('nombre')).toBe('name')
    expect(mapHeaderToField('sku')).toBe('sku')
    expect(mapHeaderToField('codigo')).toBe('sku')
    expect(mapHeaderToField('precio')).toBe('sale_price')
    expect(mapHeaderToField('costo')).toBe('purchase_price')
    expect(mapHeaderToField('existencias')).toBe('stock_quantity')
    expect(mapHeaderToField('codigo_barras')).toBe('barcode')
    expect(mapHeaderToField('rubro')).toBe('category')
    expect(mapHeaderToField('cost_price')).toBe('purchase_price')
    expect(mapHeaderToField('supplier')).toBe('supplier')
    expect(mapHeaderToField('selling_price')).toBe('sale_price')
    expect(mapHeaderToField('quantity_ordered')).toBe('stock_quantity')
  })

  it('parsea números en distintos formatos con y sin moneda', () => {
    expect(parseSmartNumber(25000)).toBe(25000)
    expect(parseSmartNumber('150000')).toBe(150000)
    expect(parseSmartNumber('Gs. 50000')).toBe(50000)
    expect(parseSmartNumber('$ 200')).toBe(200)
    expect(parseSmartNumber('150,50')).toBe(150.5)
    expect(parseSmartNumber(null)).toBeUndefined()
    expect(parseSmartNumber('')).toBeUndefined()
  })

  it('genera CSV con cabeceras y valores formateados respetando permisos de costo', () => {
    // Mock de URL.createObjectURL y elementos DOM
    const createObjectURLMock = vi.fn(() => 'blob:url')
    const revokeObjectURLMock = vi.fn()
    window.URL.createObjectURL = createObjectURLMock
    window.URL.revokeObjectURL = revokeObjectURLMock

    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const removeSpy = vi.spyOn(document.body, 'removeChild')

    const products = [
      {
        sku: 'TEST-001',
        name: 'Producto de Prueba',
        sale_price: 50000,
        purchase_price: 25000,
        stock_quantity: 10,
        category: 'Accesorios',
      },
    ]

    const result = exportCatalogToCSV(products, { canViewCost: true })
    expect(result.success).toBe(true)
    expect(createObjectURLMock).toHaveBeenCalled()
    expect(appendSpy).toHaveBeenCalled()
    expect(removeSpy).toHaveBeenCalled()
  })
})
