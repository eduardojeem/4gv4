import { describe, expect, it } from 'vitest'
import { comparisonText, financeHeadline } from '@/lib/finance/headline'
import { financeWarningAction, financeWarningSourceHref, financeWarningTitle } from '@/lib/finance/warning-actions'

const accrued = { revenue: 1_000, directCosts: 400, grossProfit: 600, operatingExpenses: 200, payrollCost: 100, netProfit: 300 }

describe('el número grande de Finanzas', () => {
  it('usa la ganancia exacta cuando el servidor la tiene', () => {
    expect(financeHeadline(accrued)).toEqual({ profit: 300, estimated: false, marginPct: 30 })
  })

  it('con costos faltantes la estima en vez de mostrar «Pendiente»', () => {
    expect(financeHeadline({ ...accrued, grossProfit: null, netProfit: null })).toEqual({ profit: 300, estimated: true, marginPct: 30 })
  })

  it('sin ventas no hay margen', () => {
    expect(financeHeadline({ ...accrued, revenue: 0, directCosts: 0, operatingExpenses: 50, payrollCost: 0, netProfit: -50 }).marginPct).toBeNull()
  })
})

describe('comparación con el período anterior, en palabras', () => {
  it('dice cuánto más o menos', () => {
    expect(comparisonText(1_150, 1_000)).toBe('15 % más que el período anterior')
    expect(comparisonText(800, 1_000)).toBe('20 % menos que el período anterior')
    expect(comparisonText(1_001, 1_000)).toBe('Igual que el período anterior')
  })

  it('con una pérdida anterior compara contra su valor absoluto', () => {
    expect(comparisonText(100, -100)).toBe('200 % más que el período anterior')
  })

  it('sin base no inventa porcentajes', () => {
    expect(comparisonText(500, 0)).toBeNull()
    expect(comparisonText(500, undefined)).toBeNull()
    expect(comparisonText(null, 100)).toBeNull()
  })
})

describe('qué hacer con cada aviso', () => {
  it('lleva al lugar donde se corrige', () => {
    expect(financeWarningAction('MISSING_DIRECT_COST')).toEqual({ kind: 'link', label: 'Cargar costos en Productos', href: '/dashboard/products' })
    expect(financeWarningAction('MISSING_EMPLOYEE')).toMatchObject({ kind: 'section', section: 'payroll' })
    expect(financeWarningAction('MISSING_CASH_TIMING')).toBeNull()
  })

  it('abre la reparación puntual', () => {
    expect(financeWarningSourceHref('repair', 'r 1')).toBe('/dashboard/repairs?id=r%201&edit=true')
    expect(financeWarningSourceHref('sale', 's1')).toBeNull()
  })

  it('titula en palabras del comercio', () => {
    expect(financeWarningTitle('MISSING_REPAIR_PRICE', 1)).toBe('1 reparación entregada sin precio')
    expect(financeWarningTitle('MISSING_DIRECT_COST', 3)).toBe('3 ventas con productos sin costo cargado')
  })
})
