import { describe, expect, it } from 'vitest'
import {
  buildGlobalPaymentAccountRows,
  buildGlobalPaymentAllocationRows,
  buildGlobalPaymentClientRows,
  buildGlobalPaymentDetailRows,
  type GlobalPaymentReceiptInput,
} from './global-payment-receipt'

const base: GlobalPaymentReceiptInput = {
  receiptNumber: 'ABN-0001',
  paidAt: '2026-10-14T12:00:00Z',
  totalAmount: 700_000,
  paymentMethod: 'cash',
  allocations: [
    { id: 'r1', type: 'repair', title: 'Reparación #12', allocatedAmount: 300_000, totalAmount: 500_000, newPending: 0 },
    { id: 'i1', type: 'installment', title: 'Crédito #abc123 · cuota 3', allocatedAmount: 300_000, totalAmount: 400_000, newPending: 100_000 },
    { id: 'i2', type: 'installment', title: 'Crédito #abc123 · cuota 4', allocatedAmount: 0, totalAmount: 400_000, newPending: 400_000 },
  ],
  excessToStoreCredit: 100_000,
  customerName: 'Ana Pérez',
  customerDocument: '1234567',
}

const labels = (rows: Array<{ label: string }>) => rows.map(row => row.label)
const digits = (value: string) => value.replace(/\D/g, '')

describe('global payment receipt rows', () => {
  it('identifies the customer', () => {
    expect(buildGlobalPaymentClientRows(base)).toEqual([
      { label: 'Cliente', value: 'Ana Pérez' },
      { label: 'RUC / CI / ID', value: '1234567' },
    ])
    expect(buildGlobalPaymentClientRows({ ...base, customerDocument: null })).toHaveLength(1)
  })

  it('leads the payment section with the highlighted amount and the method', () => {
    const rows = buildGlobalPaymentDetailRows(base)
    expect(rows[0]).toMatchObject({ label: 'MONTO PAGADO', strong: true })
    expect(digits(rows[0].value)).toBe('700000')
    expect(rows[1]).toEqual({ label: 'Método de Pago', value: 'Efectivo' })
  })

  it('prints the transfer and card proof that the cashier recorded', () => {
    const transfer = buildGlobalPaymentDetailRows({ ...base, paymentMethod: 'transfer', bankName: 'Ueno Bank', referenceNumber: '998' })
    expect(transfer.slice(1)).toEqual([
      { label: 'Método de Pago', value: 'Transferencia' },
      { label: 'Banco', value: 'Ueno Bank' },
      { label: 'Comprobante N°', value: '998' },
    ])

    const card = buildGlobalPaymentDetailRows({ ...base, paymentMethod: 'card', cardType: 'credit', voucherNumber: '55', lastFourDigits: '4321' }, { compacto: true })
    expect(card.slice(1)).toEqual([
      { label: 'Método', value: 'Tarjeta de crédito' },
      { label: 'Cupón', value: '55' },
      { label: 'Tarjeta', value: '**** 4321' },
    ])
  })

  it('lists only the debts the payment covered, plus the excess to store credit', () => {
    const rows = buildGlobalPaymentAllocationRows(base)
    expect(labels(rows)).toEqual(['Reparación #12', 'Crédito #abc123 · cuota 3', 'SALDO A FAVOR'])
    expect(rows[0].value).toMatch(/Saldada$/)
    expect(rows[1].value).toMatch(/Queda /)
    expect(rows[2].strong).toBe(true)
  })

  it('omits the store credit row when nothing was left over', () => {
    expect(labels(buildGlobalPaymentAllocationRows({ ...base, excessToStoreCredit: 0 }))).not.toContain('SALDO A FAVOR')
  })

  it('reports financed total, paid and balance of the covered debts', () => {
    const rows = buildGlobalPaymentAccountRows(base)
    expect(labels(rows)).toEqual(['Total financiado', 'Total pagado', 'SALDO PENDIENTE'])
    expect(rows.map(row => digits(row.value))).toEqual(['900000', '800000', '100000'])
    expect(rows[2].strong).toBe(true)
  })

  it('adds the untouched debts apart so the balance is not mistaken for the whole debt', () => {
    const rows = buildGlobalPaymentAccountRows({ ...base, otherPendingAmount: 400_000 })
    expect(labels(rows).slice(3)).toEqual(['Otras deudas pendientes', 'DEUDA TOTAL DEL CLIENTE'])
    expect(digits(rows[4].value)).toBe('500000')
  })

  it('marks the covered debts as settled when nothing is left', () => {
    const rows = buildGlobalPaymentAccountRows({ ...base, allocations: [base.allocations[0]] }, { compacto: true })
    expect(rows[2]).toMatchObject({ label: 'SALDO', strong: true })
    expect(rows[2].value).toMatch(/SALDADO/)
  })

  it('has no account section when only store credit was loaded', () => {
    expect(buildGlobalPaymentAccountRows({ ...base, allocations: [] })).toEqual([])
  })
})
