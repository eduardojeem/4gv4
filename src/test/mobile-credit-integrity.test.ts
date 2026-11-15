import { describe, it, expect } from 'vitest';
import { creditDisplayDate,parseCreditAmount, formatCreditAmountInput, creditCollectionPayload, creditIsLate, creditTotals } from '../../mobile/src/lib/credit-model';
describe('mobile credit integrity', () => {
    it('preserves decimal input and never interprets cents as thousands', () => { expect(parseCreditAmount('100,50')).toBe(100.5); expect(parseCreditAmount('100.50')).toBe(100.5); for (const v of ['1.500,25', '100,', '-1', '1e3', '100.555'])
        expect(() => parseCreditAmount(v)).toThrow(); expect(formatCreditAmountInput(100.5)).toBe('100,50'); });
    it('sends the exact amount and manual allocation cents', () => { const body = creditCollectionPayload({ amount: 100.5, method: 'cash', allocations: [{ id: 'i', type: 'installment', amount: 100.5 }] }, 'stable-key'); expect(body.amount).toBe(100.5); expect(body.allocations?.[0].amount).toBe(100.5); });
    it('uses the business day instead of UTC to decide overdue status', () => { expect(creditIsLate('2026-11-11', 'pending', 'America/Asuncion', new Date('2026-11-12T01:00:00Z'))).toBe(false); });
    it('rejects invalid installment money instead of producing zero balances', () => { expect(() => creditTotals([{ amount: NaN, amount_paid: 0, status: 'pending' }])).toThrow(); expect(creditTotals([{ amount: 100.5, amount_paid: 25.25, status: 'pending' }])).toEqual({ total: 100.5, paid: 25.25, pending: 75.25 }); });
});

it('displays payment dates in the business calendar, not the UTC day',()=>{expect(creditDisplayDate('2026-11-12T01:00:00Z','America/Asuncion')).toContain('11');expect(creditDisplayDate('invalid','America/Asuncion')).toBe('Fecha no disponible')})
