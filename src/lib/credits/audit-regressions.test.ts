import { describe, expect, it } from 'vitest'
import { getCustomerInstallmentView } from './customer-portal'
import { buildAccountStatusRows } from './payment-receipt'
import { buildCreditReport } from '../reports/credit-report'

describe('credit audit regressions', () => {
  it.each(['pending', 'late'] as const)('does not mark today overdue, including stale %s status', status => {
    expect(getCustomerInstallmentView({ id: 'i', installment_number: 1, amount: 100, amount_paid: 0,
      due_date: '2026-10-15T12:00:00Z', status }, new Date('2026-10-15T21:00:00Z')).status).toBe('pending')
  })
  it('never invents payments from a mismatched contract header', () => {
    const input = { paymentId: 'p', creditId: 'c', paymentAmount: 100, customerName: 'Prueba',
      totalCreditAmount: 2400000, currentCreditBalance: 927000 }
    expect(buildAccountStatusRows(input).map(row => row[0])).not.toContain('Total pagado')
    expect(buildAccountStatusRows({ ...input, totalPaidAmount: 0 })).toContainEqual(['Total pagado', expect.stringContaining('0')])
  })
  it('uses the plan components when the header already includes interest', () => {
    const report = buildCreditReport({ credits: [{ id: 'c', customerId: 'u', principal: 110000, interestRate: 10, createdAt: '2026-10-15' }],
      installments: [{ creditId: 'c', amount: 110000, principalComponent: 100000, interestComponent: 10000, amountPaid: 0, status: 'pending', dueDate: '2026-11-15' }],
      payments: [], from: new Date('2026-10-01'), to: new Date('2026-11-01'), today: '2026-10-15' })
    expect(report.period.principalGranted).toBe(100000)
    expect(report.period.scheduledInterest).toBe(10000)
  })
})
