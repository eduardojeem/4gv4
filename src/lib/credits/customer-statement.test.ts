import { describe, expect, it } from 'vitest'
import type { CreditRow, InstallmentRow } from '@/hooks/use-credits'
import { buildCustomerStatement } from './customer-statement'

const AHORA = new Date('2026-06-15T12:00:00Z')

function credito(over: Partial<CreditRow> & { id: string }): CreditRow {
  return {
    customer_id: 'cli-1',
    principal: 1_000_000,
    interest_rate: 0,
    term_months: 3,
    start_date: '2026-01-10',
    status: 'active',
    ...over,
  } as CreditRow
}

function cuota(over: Partial<InstallmentRow> & { id: string; credit_id: string }): InstallmentRow {
  return {
    installment_number: 1,
    due_date: '2026-02-10',
    amount: 100_000,
    status: 'pending',
    ...over,
  } as InstallmentRow
}

describe('buildCustomerStatement', () => {
  it('suma el saldo pendiente de todos los creditos del cliente', () => {
    const r = buildCustomerStatement(
      [credito({ id: 'c1' }), credito({ id: 'c2', start_date: '2026-03-01' })],
      [
        cuota({ id: 'i1', credit_id: 'c1', amount: 100_000, amount_paid: 40_000 }),
        cuota({ id: 'i2', credit_id: 'c2', amount: 200_000, amount_paid: 0 }),
      ],
      AHORA
    )
    expect(r.totalPaid).toBe(40_000)
    expect(r.totalDebt).toBe(60_000 + 200_000)
  })

  it('no cobra como deuda el saldo de un credito anulado', () => {
    const r = buildCustomerStatement(
      [credito({ id: 'c1', status: 'cancelled' })],
      [cuota({ id: 'i1', credit_id: 'c1', amount: 500_000, amount_paid: 100_000 })],
      AHORA
    )
    // El credito sigue en el historial, pero la tienda ya lo dio de baja: no se
    // le puede reclamar al cliente.
    expect(r.credits).toHaveLength(1)
    expect(r.totalDebt).toBe(0)
    expect(r.credits[0].remainingBalance).toBe(0)
    // Lo que pago antes de la anulacion lo pago igual.
    expect(r.totalPaid).toBe(100_000)
  })

  it('marca vencida la cuota que la base sigue teniendo como pendiente', () => {
    const r = buildCustomerStatement(
      [credito({ id: 'c1' })],
      [
        cuota({ id: 'i1', credit_id: 'c1', due_date: '2026-02-10', status: 'pending' }),
        cuota({ id: 'i2', credit_id: 'c1', installment_number: 2, due_date: '2026-12-10', status: 'pending' }),
      ],
      AHORA
    )
    // Es el mismo estado que ve el usuario en pantalla: un documento impreso que
    // dijera "Pendiente" sobre una cuota vencida contradiria lo que acaba de mirar.
    expect(r.credits[0].installments?.[0].status).toBe('overdue')
    expect(r.credits[0].installments?.[1].status).toBe('pending')
  })

  it('ordena los creditos del mas nuevo al mas viejo', () => {
    const r = buildCustomerStatement(
      [
        credito({ id: 'viejo', start_date: '2025-01-01' }),
        credito({ id: 'nuevo', start_date: '2026-05-01' }),
      ],
      [],
      AHORA
    )
    expect(r.credits.map((c) => c.id)).toEqual(['nuevo', 'viejo'])
  })

  it('ordena las cuotas por numero, no por como vinieron de la base', () => {
    const r = buildCustomerStatement(
      [credito({ id: 'c1' })],
      [
        cuota({ id: 'i3', credit_id: 'c1', installment_number: 3 }),
        cuota({ id: 'i1', credit_id: 'c1', installment_number: 1 }),
        cuota({ id: 'i2', credit_id: 'c1', installment_number: 2 }),
      ],
      AHORA
    )
    expect(r.credits[0].installments?.map((i) => i.number)).toEqual([1, 2, 3])
  })

  it('no deja saldo negativo cuando se pago de mas', () => {
    const r = buildCustomerStatement(
      [credito({ id: 'c1' })],
      [cuota({ id: 'i1', credit_id: 'c1', amount: 100_000, amount_paid: 150_000 })],
      AHORA
    )
    expect(r.totalDebt).toBe(0)
    expect(r.credits[0].remainingBalance).toBe(0)
  })

  it('un credito sin cuotas no rompe el resumen', () => {
    const r = buildCustomerStatement([credito({ id: 'c1' })], [], AHORA)
    expect(r.credits[0].installments).toEqual([])
    expect(r.totalDebt).toBe(0)
  })

  it('ignora cuotas de otros creditos que se cuelen en la lista', () => {
    const r = buildCustomerStatement(
      [credito({ id: 'c1' })],
      [
        cuota({ id: 'i1', credit_id: 'c1', amount: 100_000 }),
        cuota({ id: 'ajeno', credit_id: 'otro-credito', amount: 900_000 }),
      ],
      AHORA
    )
    expect(r.credits[0].installments).toHaveLength(1)
    expect(r.totalDebt).toBe(100_000)
  })
})
