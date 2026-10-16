import { expect, it } from 'vitest'
import { reconcileCredit } from './financials'

it('reports mismatches without fabricating payments or changing the contract', () => {
  const credit = { principal: 2400000, term_months: 8 }
  const plan = reconcileCredit(credit, [
    { amount: 309000, amount_paid: 0, due_date: '2026-10-15' },
    { amount: 309000, amount_paid: 0, due_date: '2026-10-22' },
    { amount: 309000, amount_paid: 0, due_date: '2026-10-29' },
  ])
  expect(plan).toMatchObject({ scheduled: 927000, paid: 0, remaining: 927000, count: 3, needsReview: true })
  expect(plan.lastDue?.toISOString().slice(0, 10)).toBe('2026-10-29')
  expect(credit.principal).toBe(2400000)
})
