import { describe, expect, it } from 'vitest'

import { SALES_CSV_HEADERS, buildSalesCsv, salesCsvFileName } from './sales-csv'

const venta = (over: Record<string, unknown> = {}) => ({
  id: 'abcdef12-3456-4789-8abc-def012345678',
  code: 'V-0001',
  created_at: new Date(2026, 8, 10, 14, 30).toISOString(),
  customer: { name: 'Ana Villalba' },
  payment_method: 'efectivo',
  itemsCount: 3,
  total: 150_000,
  cost: 90_000,
  refundAmount: 0,
  profit: 60_000,
  ...over,
})

const filas = (csv: string) => csv.split('\r\n')

describe('exportar las ventas del período', () => {
  it('exporta todas las ventas que recibe, no un recorte', () => {
    // Antes exportaba las 10 más recientes aunque el período tuviera 200.
    const ventas = Array.from({ length: 25 }, (_, i) => venta({ id: `id-${i}-0000000`, code: `V-${i}` }))
    expect(filas(buildSalesCsv(ventas))).toHaveLength(26)
  })

  it('el cliente y los artículos salen con su valor, no «undefined»', () => {
    const csv = buildSalesCsv([venta()])
    expect(csv).not.toContain('undefined')
    expect(filas(csv)[1]).toContain('"Ana Villalba"')
    expect(filas(csv)[1]).toContain('"3"')
  })

  it('sin cliente dice «Consumidor Final», como la tabla', () => {
    expect(filas(buildSalesCsv([venta({ customer: null })]))[1]).toContain('"Consumidor Final"')
  })

  it('los importes van como números para que la planilla los pueda sumar', () => {
    const fila = filas(buildSalesCsv([venta({ total: 150_000.4 })]))[1]
    expect(fila).toContain('"150000"')
    expect(fila).not.toMatch(/₲|Gs/)
  })

  it('usa las mismas columnas que la tabla detallada', () => {
    expect(filas(buildSalesCsv([]))[0]).toBe(SALES_CSV_HEADERS.map((h) => `"${h}"`).join(','))
  })

  it('escapa las comillas de un nombre', () => {
    expect(buildSalesCsv([venta({ customer: { name: 'Taller "El Rayo"' } })])).toContain('"Taller ""El Rayo"""')
  })
})

describe('el nombre del archivo', () => {
  it('dice el período que trae', () => {
    expect(salesCsvFileName({ from: new Date(2026, 8, 4), to: new Date(2026, 8, 10) })).toBe('ventas_pos_2026-09-04_a_2026-09-10.csv')
  })

  it('con un solo día no repite la fecha', () => {
    expect(salesCsvFileName({ from: new Date(2026, 8, 10), to: new Date(2026, 8, 10) })).toBe('ventas_pos_2026-09-10.csv')
  })
})
