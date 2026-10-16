/** Read-only reconciliation. A mismatch never authorizes rewriting a contract. */
export function reconcileCredit(
  credit: { principal: number; term_months: number },
  installments: Array<{ amount: number; amount_paid?: number | null; due_date: string }>,
) {
  const scheduled = installments.reduce((sum, row) => sum + Number(row.amount), 0)
  const paid = installments.reduce((sum, row) => sum + Math.min(Number(row.amount), Math.max(0, Number(row.amount_paid || 0))), 0)
  const lastDue = installments.map(row => new Date(row.due_date)).filter(date => Number.isFinite(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null
  return { scheduled, paid, remaining: Math.max(0, scheduled - paid), lastDue,
    count: installments.length,
    needsReview: installments.length === 0 || Math.abs(Number(credit.principal) - scheduled) > 0.01 || Number(credit.term_months) !== installments.length }
}
