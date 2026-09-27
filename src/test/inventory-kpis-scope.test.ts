import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

import { calculateInventoryStats, resolveStockLevel } from '@/lib/inventory/stock-status'
import { exportInventoryCsvRows, toExportRow, INVENTORY_EXPORT_HEADERS } from '@/lib/inventory/export'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')
const PANTALLA = leer('src/components/admin/inventory/inventory-management.tsx')
const HOOK = leer('src/hooks/use-inventory.ts')
const STATS_API = leer('src/app/api/inventory/stats/route.ts')
const PROMOS = leer('src/components/admin/inventory/PromotionManager.tsx')
const REPORTES = leer('src/components/admin/reports/inventory-reports.tsx')

/**
 * El modal de producto crea con `max_stock: 0` y el campo es opcional, asi que
 * la mayoria del catalogo lo tiene en 0. La regla era `stock >= max_stock`: con
 * maximo 0 eso es verdadero en cuanto hay una unidad, y casi todo el catalogo
 * decia «Stock alto». La columna se volvia decorativa.
 */
describe('el nivel de stock con maximo sin configurar', () => {
  it('sin maximo, con stock por encima del minimo, es normal', () => {
    expect(resolveStockLevel({ stock_quantity: 10, min_stock: 2, max_stock: 0 })).toBe('normal')
    expect(resolveStockLevel({ stock_quantity: 10, min_stock: 2, max_stock: null })).toBe('normal')
    expect(resolveStockLevel({ stock_quantity: 10, min_stock: 2 })).toBe('normal')
  })

  it('con maximo configurado sigue detectando el exceso', () => {
    expect(resolveStockLevel({ stock_quantity: 40, min_stock: 2, max_stock: 30 })).toBe('high')
    expect(resolveStockLevel({ stock_quantity: 30, min_stock: 2, max_stock: 30 })).toBe('high')
    expect(resolveStockLevel({ stock_quantity: 29, min_stock: 2, max_stock: 30 })).toBe('normal')
  })

  it('agotado y bajo mandan sobre el maximo', () => {
    expect(resolveStockLevel({ stock_quantity: 0, min_stock: 5, max_stock: 0 })).toBe('out')
    expect(resolveStockLevel({ stock_quantity: 3, min_stock: 5, max_stock: 0 })).toBe('low')
    // El limite es inclusivo: estar EN el minimo ya es stock bajo.
    expect(resolveStockLevel({ stock_quantity: 5, min_stock: 5 })).toBe('low')
  })

  it('la tabla usa esa misma regla', () => {
    expect(PANTALLA).toContain('STOCK_LEVEL_BADGE[resolveStockLevel(product)]')
    expect(PANTALLA).not.toContain('product.stock_quantity >= product.max_stock')
  })
})

describe('los indicadores hablan de toda la empresa', () => {
  it('el margen se pondera por el valor del stock', () => {
    // Promediar porcentajes hacia que un accesorio de 15.000 pesara lo mismo
    // que un celular de 4.000.000.
    const stats = calculateInventoryStats([
      { stock_quantity: 100, purchase_price: 10_000, sale_price: 15_000 },
      { stock_quantity: 1, purchase_price: 3_000_000, sale_price: 3_100_000 },
    ])
    // Venta: 100*15.000 + 3.100.000 = 4.600.000; costo: 1.000.000 + 3.000.000.
    expect(stats.weightedMargin).toBeCloseTo(((4_600_000 - 4_000_000) / 4_600_000) * 100, 6)
  })

  it('sin stock valorizado no inventa un margen', () => {
    const stats = calculateInventoryStats([{ stock_quantity: 0, purchase_price: 1000, sale_price: 2000 }])
    expect(stats.weightedMargin).toBeNull()
  })

  it('cuenta agotados y bajos con la misma regla que la tabla', () => {
    const stats = calculateInventoryStats([
      { stock_quantity: 0, min_stock: 3 },
      { stock_quantity: 2, min_stock: 3 },
      { stock_quantity: 9, min_stock: 3 },
    ])
    expect(stats.outOfStock).toBe(1)
    expect(stats.lowStock).toBe(1)
    expect(stats.totalProducts).toBe(3)
    expect(stats.totalUnits).toBe(11)
  })

  it('vienen de un endpoint propio, no de la pagina cargada', () => {
    expect(HOOK).toContain("fetch('/api/inventory/stats'")
    expect(HOOK).toContain('branchHeaders(selectedBranchId)')
    expect(STATS_API).toContain(".eq('organization_id', organization.id)")
    expect(STATS_API).toContain('calculateInventoryStats(scopedProducts)')
  })

  it('el calculo sobre la pagina actual ya no existe', () => {
    expect(PANTALLA).not.toContain('const lowStock = products.filter')
    expect(PANTALLA).not.toContain('Stock bajo (Lote)')
    expect(PANTALLA).not.toContain('Valor del Lote (Costo)')
  })

  it('cada tarjeta dice de que universo habla', () => {
    expect(PANTALLA).toContain("? `En ${selectedBranch?.name || 'la sucursal activa'}`")
    expect(PANTALLA).toContain(": 'En toda la empresa'")
    expect(PANTALLA).toContain('{hint}')
  })

  it('sin cifras muestra «Sin datos» en vez de un cero', () => {
    // Un 0 se lee como «no hay nada agotado».
    expect(PANTALLA).toContain('Sin datos')
    expect(HOOK).toContain('setSnapshot(null)')
  })

  it('un indicador de sucursal no se calcula sobre el stock global', () => {
    expect(STATS_API).toContain('if (branchScope.branchId && failed) {')
    expect(STATS_API).toContain("code: 'BRANCH_STOCK_UNAVAILABLE'")
  })
})

describe('el listado avisa cuando esta incompleto', () => {
  it('el hook ya no tira el aviso de la API', () => {
    expect(HOOK).toContain('setListTruncated(Boolean(payload.data.truncated))')
  })

  it('y la paginacion lo dice', () => {
    expect(PANTALLA).toContain('{listTruncated && (')
    expect(PANTALLA).toContain('quedaron productos sin evaluar por el filtro de stock')
  })

  it('los indicadores tambien', () => {
    expect(PANTALLA).toContain('{snapshot?.truncated && (')
  })
})

/**
 * Exportaba el array `products` del hook —diez filas— en un archivo llamado
 * «inventario_<fecha>.csv». Quien lo abria en Excel creia tener el inventario.
 */
describe('la exportacion trae el inventario, no la pagina', () => {
  const responder = (productos: unknown[], total: number, truncated = false) =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, data: { products: productos, total, truncated } }),
    } as Response)

  it('recorre todas las paginas hasta completar el total', async () => {
    const pagina = (n: number) => Array.from({ length: 100 }, (_, i) => ({ name: `p${n}-${i}`, sku: `s${n}-${i}` }))
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => responder(pagina(1), 250))
      .mockImplementationOnce(() => responder(pagina(2), 250))
      .mockImplementationOnce(() => responder(pagina(3).slice(0, 50), 250))

    const rows = await exportInventoryCsvRows({}, null, fetchMock as unknown as typeof fetch)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(rows).toHaveLength(251) // cabecera + 250
    expect(rows[0]).toEqual([...INVENTORY_EXPORT_HEADERS])
  })

  it('lleva la sucursal activa para exportar su stock', async () => {
    const fetchMock = vi.fn(() => responder([{ name: 'a' }], 1))
    await exportInventoryCsvRows({}, 'sucursal-1', fetchMock as unknown as typeof fetch)
    const [url] = fetchMock.mock.calls[0] as [string]
    expect(url).toContain('strict_branch_stock=true')
  })

  it('se niega a exportar un recorrido parcial en vez de entregarlo como completo', async () => {
    const fetchMock = vi.fn(() => responder([{ name: 'a' }], 1, true))
    await expect(exportInventoryCsvRows({ stockStatus: 'low' }, null, fetchMock as unknown as typeof fetch))
      .rejects.toThrow(/parcialmente/)
  })

  it('propaga el error de lectura en vez de bajar un archivo vacio', async () => {
    const fetchMock = vi.fn(() => Promise.resolve({
      ok: false,
      json: () => Promise.resolve({ success: false, error: 'sin permiso' }),
    } as Response))
    await expect(exportInventoryCsvRows({}, null, fetchMock as unknown as typeof fetch))
      .rejects.toThrow('sin permiso')
  })

  it('el costo recortado por permisos sale vacio, no en cero', () => {
    // Un 0 en la columna Costo se lee como «me costo cero».
    expect(toExportRow({ name: 'x', sale_price: 100 })[5]).toBe('')
    expect(toExportRow({ name: 'x', purchase_price: 0 })[5]).toBe('0')
  })

  it('Excel en español necesita BOM y punto y coma', () => {
    expect(PANTALLA).toContain('const BOM_UTF8 = String.fromCharCode(0xfeff)')
    expect(PANTALLA).toContain('const LINE_BREAK_CRLF = String.fromCharCode(13, 10)')
    expect(PANTALLA).toContain(".join(';')")
    expect(PANTALLA).toContain('new Blob([BOM_UTF8 + csv]')
  })
})

describe('las alertas salen de la tabla que el trigger mantiene', () => {
  it('la pestaña usa el panel que lee product_alerts', () => {
    const PANEL = leer('src/components/admin/inventory/InventoryAlertsPanel.tsx')
    expect(PANTALLA).toContain('<InventoryAlertsPanel')
    expect(PANEL).toContain("useProductAlerts()")
  })

  it('el conteo sobre la pagina actual ya no existe', () => {
    // «Productos Agotados (2)» con trescientos agotados en la empresa.
    expect(PANTALLA).not.toContain('Productos Agotados ({products.filter')
    expect(PANTALLA).not.toContain('products.filter(p => p.stock_quantity === 0).length')
  })
})

describe('las promociones ya no muestran un descuento inventado', () => {
  it('«usos × 10» no esta mas', () => {
    expect(PROMOS).not.toContain('totalUsage * 10')
    expect(PROMOS).not.toContain('{stats.totalDiscountGiven}')
    // El nombre sobrevive en el comentario que explica por que se saco; lo que
    // no puede sobrevivir es la etiqueta pintada en pantalla.
    expect(PROMOS).not.toContain('>Descuento Total Est.<')
  })

  it('la pestaña que solo decia «proximamente» tampoco', () => {
    expect(PROMOS).not.toContain('Las analíticas detalladas estarán disponibles próximamente')
    expect(PROMOS).not.toContain('<TabsTrigger value="analytics">')
  })
})

describe('el informe de inventario cierra con /dashboard/reports', () => {
  it('cuenta solo las ventas completadas, como la otra pantalla', () => {
    expect(REPORTES).toContain("import { isCompletedSaleStatus } from '@/lib/sales-status'")
    expect(REPORTES).toContain('const completedSales = ((salesData || []) as ReportSaleRow[])')
    expect(REPORTES).toContain('isCompletedSaleStatus(')
  })

  it('avisa si el catalogo no entro entero en el barrido', () => {
    expect(REPORTES).toContain('.limit(PRODUCT_SCAN_CAP + 1)')
    expect(REPORTES).toContain('setIsPartial(productsTruncated)')
    expect(REPORTES).toContain('las cifras de inventario de este informe son parciales')
  })

  it('las tarjetas dicen que los filtros aplican a las tablas', () => {
    expect(REPORTES).toContain('De toda la empresa (los filtros aplican a las tablas)')
    expect(REPORTES).toContain('hint={kpiScopeHint}')
  })
})
