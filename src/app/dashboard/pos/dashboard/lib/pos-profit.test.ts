import { describe, expect, it } from 'vitest'
import { calculateProfit, calculateSalesCost, figuresForMode, type SaleItemRow } from './pos-profit'

const item = (
  name: string,
  quantity: number,
  subtotal: number,
  purchase_price: number | null,
): SaleItemRow => ({ quantity, subtotal, product: { name, purchase_price } })

describe('calculateSalesCost', () => {
  it('multiplica costo por cantidad', () => {
    const result = calculateSalesCost([item('Cargador', 3, 150_000, 20_000)])

    expect(result.totalCost).toBe(60_000)
  })

  it('agrega varias líneas del mismo producto', () => {
    const result = calculateSalesCost([
      item('Cargador', 2, 100_000, 20_000),
      item('Cargador', 1, 50_000, 20_000),
    ])

    expect(result.products).toHaveLength(1)
    expect(result.products[0].sales).toBe(3)
    expect(result.products[0].revenue).toBe(150_000)
    expect(result.totalCost).toBe(60_000)
  })

  it('ordena los productos por unidades vendidas', () => {
    const result = calculateSalesCost([
      item('Funda', 1, 10_000, 3_000),
      item('Cargador', 5, 250_000, 20_000),
    ])

    expect(result.products.map((p) => p.name)).toEqual(['Cargador', 'Funda'])
  })

  it('cuenta los productos sin costo cargado en vez de tomarlos como gratis', () => {
    // Un producto sin purchase_price infla el margen: hay que poder avisarlo.
    const result = calculateSalesCost([
      item('Con costo', 1, 50_000, 20_000),
      item('Sin costo', 1, 50_000, null),
      item('Costo cero', 1, 50_000, 0),
    ])

    expect(result.itemsWithoutCost).toBe(2)
    expect(result.totalCost).toBe(20_000)
  })

  it('no rompe con producto borrado ni con valores no numéricos', () => {
    const result = calculateSalesCost([
      { quantity: 2, subtotal: 100, product: null },
      { quantity: 'x', subtotal: null, product: { name: 'Raro', purchase_price: 'abc' } },
    ])

    expect(result.totalCost).toBe(0)
    expect(result.products.some((p) => p.name === 'Producto eliminado')).toBe(true)
  })

  it('sin ítems devuelve cero y lista vacía', () => {
    expect(calculateSalesCost([]).totalCost).toBe(0)
    expect(calculateSalesCost(null).products).toEqual([])
    expect(calculateSalesCost(undefined).itemsWithoutCost).toBe(0)
  })
})

describe('calculateProfit', () => {
  // Facturacion de 1.100.000 con 100.000 de IVA -> neto 1.000.000.
  const base = {
    totalSales: 1_100_000,
    netSales: 1_000_000,
    totalCost: 600_000,
    repairDeliveredAmount: 0,
  }

  it('con IVA resta el costo de la facturación bruta', () => {
    const result = calculateProfit(base)

    expect(result.withTax.revenue).toBe(1_100_000)
    expect(result.withTax.salesProfit).toBe(500_000)
  })

  it('sin IVA usa la base neta y da un margen menor', () => {
    const result = calculateProfit(base)

    expect(result.withoutTax.revenue).toBe(1_000_000)
    expect(result.withoutTax.salesProfit).toBe(400_000)
    // El IVA inflaba el margen: esa es la diferencia entre las dos vistas.
    expect(result.withoutTax.profitMargin).toBeLessThan(result.withTax.profitMargin)
  })

  it('expone el IVA contenido en el período', () => {
    expect(calculateProfit(base).taxTotal).toBe(100_000)
  })

  it('el IVA nunca es negativo aunque el neto venga mal', () => {
    const result = calculateProfit({ ...base, netSales: 2_000_000 })
    expect(result.taxTotal).toBe(0)
  })

  it('si no vino el neto usa el bruto en vez de inventar un IVA', () => {
    const result = calculateProfit({ ...base, netSales: 0 })

    expect(result.withoutTax.revenue).toBe(1_100_000)
    expect(result.taxTotal).toBe(0)
  })

  it('suma la recaudación de taller en ambos modos', () => {
    const result = calculateProfit({ ...base, repairDeliveredAmount: 250_000 })

    expect(result.withTax.totalProfit).toBe(750_000)
    expect(result.withoutTax.totalProfit).toBe(650_000)
  })

  it('devuelve la pérdida en negativo, no recortada a cero', () => {
    // Antes se recortaba: un periodo con perdida se veia igual que uno sin
    // actividad, que es justo cuando hay que avisar.
    const result = calculateProfit({ ...base, totalSales: 500_000, netSales: 500_000, totalCost: 800_000 })

    expect(result.withTax.salesProfit).toBe(-300_000)
    expect(result.withTax.profitMargin).toBe(-60)
  })

  it('no inventa una ganancia cuando el costo no se pudo obtener', () => {
    // Este es el bug original: con la consulta rota el costo quedaba en 0 y la
    // ganancia salia igual a la facturacion, con margen 100%.
    const result = calculateProfit({ ...base, totalCost: 0, costUnavailable: true })

    expect(result.costUnavailable).toBe(true)
    expect(result.withTax.salesProfit).toBe(0)
    expect(result.withoutTax.salesProfit).toBe(0)
    expect(result.withTax.profitMargin).toBe(0)
  })

  it('sin ventas el margen es cero, no una división por cero', () => {
    const result = calculateProfit({ totalSales: 0, netSales: 0, totalCost: 0, repairDeliveredAmount: 0 })

    expect(result.withTax.profitMargin).toBe(0)
    expect(Number.isFinite(result.withTax.profitMargin)).toBe(true)
  })

  it('un costo real de cero sí produce margen 100 %, y eso es correcto', () => {
    // Distinto de costUnavailable: aca sabemos que el costo es cero.
    const result = calculateProfit({ ...base, totalCost: 0 })

    expect(result.withTax.profitMargin).toBe(100)
    expect(result.costUnavailable).toBe(false)
  })
})

describe('figuresForMode', () => {
  const result = calculateProfit({
    totalSales: 1_100_000,
    netSales: 1_000_000,
    totalCost: 600_000,
    repairDeliveredAmount: 0,
  })

  it('con IVA es el modo por defecto del negocio', () => {
    expect(figuresForMode(result, 'with-tax').revenue).toBe(1_100_000)
  })

  it('sin IVA devuelve la base neta', () => {
    expect(figuresForMode(result, 'without-tax').revenue).toBe(1_000_000)
  })
})
