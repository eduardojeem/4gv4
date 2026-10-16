import { expect, it } from 'vitest'
import { creditReminderDebt } from './reminder'

it('reminds only the overdue remainder and excludes paid and future installments', () => {
  const now = new Date('2026-10-15T21:00:00Z')
  expect(creditReminderDebt([
    { amount: 100, amount_paid: 30, status: 'late', due_date: '2026-10-10' },
    { amount: 200, amount_paid: 0, status: 'pending', due_date: '2026-10-15' },
    { amount: 300, amount_paid: 300, status: 'paid', due_date: '2026-10-01' },
  ], 'America/Asuncion', now)).toEqual({ amount: 70, dueDate: '2026-10-10', daysOverdue: 5 })
  expect(creditReminderDebt([], 'America/Asuncion', now)).toBeNull()
})
