import { describe, expect, it } from 'vitest'

import { buildUnpaidObligationUpdate } from './server'

describe('buildUnpaidObligationUpdate', () => {
  const current = {
    category_id: 'category-id',
    concept: 'Alquiler',
    amount: 100,
    vendor: 'Proveedor',
    accounting_date: '2026-08-01',
    due_date: '2026-08-10',
    notes: 'Original',
  }

  it('derives overdue and pending from the effective due date', () => {
    expect(
      buildUnpaidObligationUpdate(current, { branchId: 'branch-id' }, '2026-08-11'),
    ).toMatchObject({ status: 'overdue' })

    expect(
      buildUnpaidObligationUpdate(
        current,
        { branchId: 'branch-id', dueDate: '2026-08-12' },
        '2026-08-11',
      ),
    ).toMatchObject({ due_date: '2026-08-12', status: 'pending' })
  })

  it('clears nullable fields only when explicit null is supplied', () => {
    expect(
      buildUnpaidObligationUpdate(
        current,
        { branchId: 'branch-id', dueDate: null, vendor: null, notes: null },
        '2026-08-11',
      ),
    ).toMatchObject({
      due_date: null,
      vendor: null,
      notes: null,
      status: 'pending',
    })

    const omitted = buildUnpaidObligationUpdate(
      current,
      { branchId: 'branch-id' },
      '2026-08-11',
    )
    expect(omitted).not.toHaveProperty('due_date')
    expect(omitted).not.toHaveProperty('vendor')
    expect(omitted).not.toHaveProperty('notes')
  })

  it('does not reuse the old due date when it is cleared with an accounting-date change', () => {
    expect(
      buildUnpaidObligationUpdate(
        current,
        {
          branchId: 'branch-id',
          accountingDate: '2026-08-20',
          dueDate: null,
        },
        '2026-08-11',
      ),
    ).toMatchObject({
      accounting_date: '2026-08-20',
      due_date: null,
      status: 'pending',
    })
  })
})
