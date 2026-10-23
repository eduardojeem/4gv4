type CreditIdentity = { id: string; status?: string | null };
type InstallmentBalance = { credit_id: string; amount: number | string | null; amount_paid?: number | string | null; status: string };

const CANCELLED = new Set(['cancelled', 'cancelado', 'canceled']);

/** Active customer balance excludes obligations whose parent credit was voided. */
export function summarizeCustomerCreditBalances(credits: CreditIdentity[], installments: InstallmentBalance[]) {
  const billableCreditIds = new Set(credits
    .filter((credit) => !CANCELLED.has(String(credit.status ?? '').toLowerCase()))
    .map((credit) => credit.id));
  const billableInstallments = installments.filter((row) =>
    billableCreditIds.has(row.credit_id) && !CANCELLED.has(String(row.status ?? '').toLowerCase()));
  let pendingBalance = 0;
  let financedTotal = 0;
  let paidTotal = 0;

  for (const installment of billableInstallments) {
    const amount = Math.max(0, Number(installment.amount || 0));
    const amountPaid = Math.max(0, Number(installment.amount_paid || 0));
    financedTotal += amount;
    pendingBalance += Math.max(0, amount - amountPaid);
    paidTotal += installment.status === 'paid' ? amount : Math.min(amount, amountPaid);
  }

  return {
    totalInstallments: billableInstallments.length,
    pendingInstallments: billableInstallments.filter((row) => row.status !== 'paid').length,
    financedTotal,
    paidTotal,
    pendingBalance,
  };
}
