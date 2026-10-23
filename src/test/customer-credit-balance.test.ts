import { describe, expect, it } from 'vitest';

import { summarizeCustomerCreditBalances } from '@/lib/customers/credit-balance';

describe('customer credit balance excludes voided credits', () => {
  it('does not present cancelled installments as a balance or collectible debt', () => {
    const summary = summarizeCustomerCreditBalances(
      [
        { id: 'voided', status: 'cancelled' },
        { id: 'active', status: 'active' },
        { id: 'paid', status: 'completed' },
      ],
      [
        { credit_id: 'voided', amount: 100, amount_paid: 0, status: 'cancelled' },
        { credit_id: 'active', amount: 80, amount_paid: 20, status: 'pending' },
        { credit_id: 'active', amount: 50, amount_paid: 0, status: 'cancelled' },
        { credit_id: 'paid', amount: 50, amount_paid: 50, status: 'paid' },
      ],
    );

    expect(summary).toEqual({ totalInstallments: 2, pendingInstallments: 1, financedTotal: 130, paidTotal: 70, pendingBalance: 60 });
  });
});
