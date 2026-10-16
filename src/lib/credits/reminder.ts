import { creditCalendarDate, daysUntilCreditDue } from './calendar'

export function creditReminderDebt(installments: Array<{ amount: number; amount_paid?: number | null; status: string; due_date: string }>, timeZone: string, now = new Date()) {
  let amount = 0
  let dueDate: string | null = null
  for (const row of installments) {
    const days = daysUntilCreditDue(row.due_date, timeZone, now)
    const pending = Math.max(0, Number(row.amount) - Math.max(0, Number(row.amount_paid || 0)))
    if (row.status === 'paid' || days === null || days >= 0 || pending <= 0) continue
    amount += pending
    const date = creditCalendarDate(row.due_date, timeZone)!
    if (!dueDate || date < dueDate) dueDate = date
  }
  return dueDate ? { amount, dueDate, daysOverdue: -(daysUntilCreditDue(dueDate, timeZone, now) ?? 0) } : null
}
