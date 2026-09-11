import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { calculateRepairCostAverages } from '@/lib/reports/repair-costs'

const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8')

const REPORTES = leer('src/components/admin/reports/operational-reports.tsx')
const ADMIN = leer('src/hooks/use-admin-analytics.ts')
const EXPORTADOR_SECCIONES = leer('src/lib/reports/section-pdf-exporter.ts')

/**
 * `/admin/analytics` y `/admin/reports` publicaban dos cifras que se leian
 * como la misma y no lo eran: «Total vendido» sumaba POS mas el ingreso del
 * taller, y «Ventas Totales» era solo POS. Sobre el mismo periodo y la misma
 * sucursal daban distinto, y nada decia por que.
 *
 * No se cambio ningun calculo: se cambio como se llaman, y admin publica la
 * cifra de POS por separado para que las dos secciones se puedan cuadrar.
 */
describe('las dos secciones se pueden cuadrar', () => {
  it('admin dice que incluye su total', () => {
    expect(ADMIN).toContain("label: 'Facturación total (POS + taller)'")
    expect(ADMIN).toContain('helper: `POS ${formatMoney(selectedPosRevenue)} · Taller ${formatMoney(selectedRepairRevenue)}`')
  })

  it('admin publica la cifra de POS, que es la que compara con reportes', () => {
    expect(ADMIN).toContain("id: 'pos-revenue',")
    expect(ADMIN).toContain("label: 'Facturado en POS'")
    expect(ADMIN).toContain('value: formatMoney(selectedPosRevenue)')
    expect(ADMIN).toContain("helper: 'Es la misma cifra que «Ventas Totales» en Reportes'")
  })

  it('reportes aclara que su cifra no incluye el taller', () => {
    expect(REPORTES).toContain('Solo ventas POS; las reparaciones van aparte')
    expect(REPORTES).toContain("'Ventas Totales (POS)': formatFullPrice(totalSales),")
    expect(EXPORTADOR_SECCIONES).toContain("'Ventas Totales (POS)': formatGs(params.metrics.totalSales),")
  })

  it('el promedio de admin dice sobre que se calcula', () => {
    // El total incluye taller y el promedio divide solo POS: sin decirlo,
    // promedio por cantidad no daba el total y parecia un error de cuentas.
    expect(ADMIN).toContain("label: 'Promedio por venta (POS)'")
    expect(ADMIN).toContain("helper: 'Facturado en POS dividido por cantidad de ventas'")
  })

  it('la cantidad de ventas aclara que no cuenta reparaciones', () => {
    expect(ADMIN).toContain("helper: 'Ventas POS del periodo, sin contar reparaciones'")
  })
})

/**
 * Admin excluye las canceladas del ingreso —nunca facturaron— pero los promedios
 * de costo de reportes las incluian si tenian un monto cargado. La misma
 * reparacion cancelada subia el promedio en una seccion y no existia en la otra.
 */
describe('las canceladas se tratan igual en las dos', () => {
  it('reportes las saca de los promedios de costo', () => {
    expect(REPORTES).toContain("String(repair.status || '').trim().toLowerCase() !== 'cancelado'")
  })

  it('admin las saca de los ingresos', () => {
    expect(ADMIN).toContain('const revenueRepairs = selectedRepairs.filter((repair) => !isCancelledRepairStatus(repair.status))')
  })

  it('sacarlas cambia el promedio, que es el punto', () => {
    const conCancelada = calculateRepairCostAverages([
      { final_cost: 100_000 },
      { final_cost: 900_000 },
    ])
    const sinCancelada = calculateRepairCostAverages([{ final_cost: 100_000 }])

    expect(conCancelada.avgFinal).toBe(500_000)
    expect(sinCancelada.avgFinal).toBe(100_000)
  })
})

/**
 * Las dos secciones filtran por el mismo campo y con el mismo criterio de estado.
 * Si alguna cambiara, los totales dejarian de ser comparables aunque los nombres
 * digan lo mismo.
 */
describe('las dos miran el mismo universo', () => {
  it('las ventas se filtran por created_at en las dos', () => {
    expect(REPORTES).toContain(".gte('created_at', dateRange.from.toISOString())")
    expect(ADMIN).toContain('isBetween(toDate(sale.created_at), selectedFrom, selectedTo)')
  })

  it('las dos cuentan solo ventas completadas, con el mismo helper', () => {
    expect(REPORTES).toContain('isCompletedSaleStatus')
    expect(ADMIN).toContain('.filter((sale) => isCompletedSaleStatus(sale.status))')
  })

  it('las reparaciones se filtran por created_at en las dos', () => {
    expect(REPORTES).toContain(".from('repairs')")
    expect(ADMIN).toContain(".gte('created_at', selectedFrom.toISOString())")
  })
})
