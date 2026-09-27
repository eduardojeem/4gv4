import { describe, expect, it } from 'vitest'
import { buildFinanceSummaryFromRecords, type FinanceSummaryRecords } from '@/lib/finance/server'

describe('finance outstanding obligations', () => {
  it('shows remaining balances from earlier periods, excluding drafts and other branches', () => {
    const base = { branchId: 'a', accountingDate: '2026-01-01', dueDate: '2026-01-15', amount: 1000000 }
    const records: FinanceSummaryRecords = {
      sales: [], saleItems: [], repairs: [], repairParts: [], payrollEntries: [], financePayments: [], payrollPayments: [],
      obligations: [
        { ...base, id: 'rent', status: 'partially_paid', paidAmount: 600000, concept: 'Alquiler' },
        { ...base, id: 'draft', status: 'draft' },
        { ...base, id: 'other', branchId: 'b', status: 'pending' },
      ],
    }
    const report = buildFinanceSummaryFromRecords(records, { startDate: '2026-09-01', endDate: '2026-09-30', branchId: 'a' }, '2026-09-02')
    expect(report.overdue).toEqual([{ id: 'rent', dueDate: '2026-01-15', amount: 400000, concept: 'Alquiler' }])
    expect(report.accrued.operatingExpenses).toBe(0)
  })
})
