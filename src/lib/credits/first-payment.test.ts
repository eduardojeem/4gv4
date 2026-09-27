import { describe, expect, it } from 'vitest'
import { buildPosCreditSummary } from './pos-credit-summary'
import { firstPaymentError } from './first-payment'

describe('primera cuota cobrada al crear el crédito', () => {
  const terms = { count: 3, frequency: 'monthly' as const, interestRate: 0, startDate: '2026-09-02' }
  it('no cobra nada por defecto', () => {
    const plan = buildPosCreditSummary(100000, terms)
    expect(plan.firstPaymentAmount).toBe(0)
    expect(plan.remainingBalance).toBe(100000)
  })
  it('cancela una cuota sin cambiar el capital ni recalcular las restantes', () => {
    const plan = buildPosCreditSummary(100000, { ...terms, firstPayment: { method: 'cash', cashReceived: 40000 } })
    expect(plan.firstPaymentAmount).toBe(33333)
    expect(plan.remainingBalance).toBe(66667)
    expect(plan.financedTotal).toBe(100000)
    expect(plan.installments.map(i => i.amount)).toEqual([33333, 33333, 33334])
  })
  it('una cuota única pagada deja saldo cero', () => {
    const plan = buildPosCreditSummary(100000, { ...terms, count: 1, firstPayment: { method: 'transfer', bank: 'Banco', reference: 'ABC123' } })
    expect(plan.remainingBalance).toBe(0)
  })
  it('rechaza cobro diferido, efectivo insuficiente y transferencia sin referencia', () => {
    expect(firstPaymentError({ method: 'cash', cashReceived: 50000 }, 30000, 'next_cycle')).toBeTruthy()
    expect(firstPaymentError({ method: 'cash', cashReceived: 5000 }, 30000, 'at_start')).toBeTruthy()
    expect(firstPaymentError({ method: 'transfer', bank: 'Banco' }, 30000, 'at_start')).toBeTruthy()
    expect(firstPaymentError({ method: 'transfer', bank: 'Banco', reference: 'REF123' }, 30000, 'at_start')).toBeNull()
  })
})
