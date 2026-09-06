import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { calculateRepairCostAverages } from './repair-costs'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

/**
 * Los tres promedios compartian un solo contador, que subia si la reparacion
 * tenia CUALQUIERA de los tres montos. Una con repuestos cargados pero sin
 * precio final sumaba 0 al numerador del promedio de precio y 1 a su
 * denominador: los tres salian por debajo de lo real.
 */
describe('cada promedio divide por lo suyo', () => {
  it('una reparacion sin precio final no hunde el promedio de precio', () => {
    const resultado = calculateRepairCostAverages([
      { final_cost: 300_000, labor_cost: 100_000, parts_cost: 200_000 },
      // Repuestos comprados, todavia sin cotizar el trabajo.
      { final_cost: 0, labor_cost: 0, parts_cost: 50_000 },
    ])

    // Antes: 300.000 / 2 = 150.000.
    expect(resultado.avgFinal).toBe(300_000)
    expect(resultado.finalCount).toBe(1)
    // Los repuestos si son dos.
    expect(resultado.avgParts).toBe(125_000)
    expect(resultado.partsCount).toBe(2)
  })

  it('la mano de obra tiene su propio contador', () => {
    const resultado = calculateRepairCostAverages([
      { final_cost: 100_000, labor_cost: 80_000, parts_cost: 0 },
      { final_cost: 200_000, labor_cost: 0, parts_cost: 0 },
    ])

    expect(resultado.avgLabor).toBe(80_000)
    expect(resultado.laborCount).toBe(1)
    expect(resultado.avgFinal).toBe(150_000)
  })

  it('las que estan en diagnostico, sin ningun monto, no entran en nada', () => {
    const resultado = calculateRepairCostAverages([
      { final_cost: 400_000, labor_cost: 400_000, parts_cost: 400_000 },
      { final_cost: null, labor_cost: null, parts_cost: null },
      { final_cost: 0, labor_cost: 0, parts_cost: 0 },
    ])

    expect(resultado.avgFinal).toBe(400_000)
    expect(resultado.finalCount).toBe(1)
    expect(resultado.laborCount).toBe(1)
    expect(resultado.partsCount).toBe(1)
  })

  it('sin reparaciones no divide por cero', () => {
    const resultado = calculateRepairCostAverages([])
    expect(resultado.avgFinal).toBe(0)
    expect(resultado.avgLabor).toBe(0)
    expect(resultado.avgParts).toBe(0)
  })

  it('los montos negativos o basura se ignoran', () => {
    const resultado = calculateRepairCostAverages([
      { final_cost: -5000, labor_cost: 'nada' as unknown as number, parts_cost: '75000' },
      { final_cost: 100_000, labor_cost: 0, parts_cost: 0 },
    ])

    expect(resultado.avgFinal).toBe(100_000)
    expect(resultado.laborCount).toBe(0)
    // Un numero que viene como texto desde la base sigue siendo un numero.
    expect(resultado.avgParts).toBe(75_000)
  })
})

/**
 * El KPI «Clientes» del bloque de ventas se llenaba desde la consulta a
 * `customers` filtrada por `created_at`: eran las ALTAS del periodo, no la gente
 * que compro. El dato real ya se calculaba para la tasa de retencion y se
 * tiraba.
 */
describe('clientes que compraron y clientes nuevos son dos cosas', () => {
  const PAGINA = leer('src/app/dashboard/reports/page.tsx')
  const EXPORTADOR = leer('src/lib/reports/section-pdf-exporter.ts')

  it('la pantalla guarda los compradores en vez de descartarlos', () => {
    expect(PAGINA).toContain('setBuyersCount(uniqueCustomersCount)')
  })

  it('el resumen integral separa los dos', () => {
    expect(PAGINA).toContain("'Clientes que compraron': buyersCount,")
    expect(PAGINA).toContain("'Clientes nuevos': totalCustomers,")
    expect(PAGINA).not.toContain("'Clientes': totalCustomers,")
  })

  it('el PDF de ventas tambien, y con nombres que no se confunden', () => {
    expect(EXPORTADOR).toContain("'Clientes que compraron': formatNumber(params.metrics.buyers)")
    expect(EXPORTADOR).toContain("'Clientes nuevos': formatNumber(params.metrics.newCustomers)")
    // `totalCustomers` era el nombre ambiguo que permitia pasar cualquiera.
    expect(EXPORTADOR).not.toContain('totalCustomers')
  })
})

/**
 * La pantalla calculaba el margen sobre la facturacion con costo conocido y el
 * PDF sobre la facturacion entera: con cobertura parcial, el PDF mostraba un
 * margen bastante mas bajo. Y el PDF es el que se comparte.
 */
describe('el margen del PDF es el mismo que el de la pantalla', () => {
  const EXPORTADOR = leer('src/lib/reports/section-pdf-exporter.ts')
  const PAGINA = leer('src/app/dashboard/reports/page.tsx')

  it('divide por la facturacion con costo conocido', () => {
    expect(EXPORTADOR).toContain('((params.metrics.totalProfit! / coveredRevenue) * 100).toFixed(1)')
    expect(EXPORTADOR).not.toContain('(params.metrics.totalProfit / params.metrics.totalSales)')
  })

  it('sin costos cargados no inventa un margen', () => {
    expect(EXPORTADOR).toContain(": 'Sin costos',")
  })

  it('dice sobre cuantos items se calculo', () => {
    expect(EXPORTADOR).toContain('items con costo historico registrado')
  })

  it('la pantalla le pasa la cobertura', () => {
    expect(PAGINA).toContain('profitCoveredRevenue: profitCoverage.coveredRevenue,')
    expect(PAGINA).toContain('profitCoveredItems: profitCoverage.coveredItems,')
    expect(PAGINA).toContain('profitTotalItems: profitCoverage.totalItems,')
  })
})
