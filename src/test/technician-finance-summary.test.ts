import { describe, expect, it, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { buildFinanceSummaryFromRecords, toFinanceApiError, type FinanceSummaryRecords } from '@/lib/finance/server'
const records = { sales: [], saleItems: [], repairs: [], repairParts: [], obligations: [], payrollEntries: [], financePayments: [], payrollPayments: [], salePayments: [], creditPayments: [] } as unknown as FinanceSummaryRecords
describe('legacy technician payments in Finance', () => {
  it('reports unreconciled technician payments as a recoverable Finance conflict', () => {
    const error = toFinanceApiError({ code: 'P0001', message: 'TECHNICIAN_RECONCILIATION_REQUIRED' })
    expect(error.status).toBe(409)
    expect(error.code).toBe('PAYROLL_RECONCILIATION_REQUIRED')
  })
  it('does not count a mapped payroll payment twice', () => {
    const summary = buildFinanceSummaryFromRecords({ ...records,
      payrollPayments: [{ branchId: 'branch', paymentDate: '2026-10-05', direction: 'payment', amount: 50 }],
      technicianPayments: [{ id: 'legacy', paidAt: '2026-10-05', amount: 50, method: 'transferencia', status: 'pagado', payrollMapped: true }],
    } as FinanceSummaryRecords, { startDate: '2026-10-01', endDate: '2026-10-31', branchId: null })
    expect(summary.cash.paid).toBe(50)
  })
  it('does not attribute payments from another branch to the selected one', () => {
    const summary = buildFinanceSummaryFromRecords({ ...records,
      technicianPayments: [{ id: 'other-branch', branchId: 'branch-2', paidAt: '2026-10-05', amount: 100, method: 'efectivo', status: 'pagado' }],
    } as FinanceSummaryRecords, { startDate: '2026-10-01', endDate: '2026-10-31', branchId: 'branch-1' })
    expect(summary.cash.paid).toBe(0)
  })
})
