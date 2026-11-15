import { beforeEach, describe, it, expect, vi } from 'vitest';
const state = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../../mobile/src/lib/api', () => ({ apiFetch: state.fetch, ApiError: class extends Error {
    } }));
import { collectPayment, fetchCustomerCredits, fetchPortfolio } from '../../mobile/src/lib/customers';
beforeEach(() => { state.fetch.mockReset(); });
describe('mobile credit adapters preserve values and failures', () => {
    it('sends cents unchanged through the actual collect adapter', async () => { state.fetch.mockResolvedValue({}); await collectPayment('customer', { amount: 100.5, method: 'cash', allocations: [{ id: 'i', type: 'installment', amount: 100.5 }] }, 'stable-key'); const body = JSON.parse(state.fetch.mock.calls[0][1].body); expect(body.amount).toBe(100.5); expect(body.allocations[0].amount).toBe(100.5); });
    it('rejects unsupported precision before sending a collection', async () => { await expect(collectPayment('customer', { amount: 100.555, method: 'cash' }, 'stable-key')).rejects.toThrow(); expect(state.fetch).not.toHaveBeenCalled(); });
    it('preserves network failures rather than returning an empty credit file', async () => { state.fetch.mockRejectedValue(new Error('Sin conexión')); await expect(fetchCustomerCredits('customer')).rejects.toThrow('Sin conexión'); });
    it('rejects malformed successful credit responses', async () => { state.fetch.mockResolvedValue({ credits: [], installments: [{ amount: NaN, amount_paid: 0, status: 'pending' }], payments: [], currency: 'USD', timeZone: 'America/Asuncion' }); await expect(fetchCustomerCredits('customer')).rejects.toThrow(); });
    it('requests compact, grouped and explicitly scoped data without missing overdue open debt', async () => { state.fetch.mockResolvedValue({ data: {} }); await fetchPortfolio({ status: 'open', page: 1, view: 'customers', branchId: 'all', creditId: 'CR-20' }); const url = new URL(state.fetch.mock.calls[0][0], 'http://localhost'); expect(url.searchParams.get('compact')).toBe('1'); expect(url.searchParams.get('view')).toBe('customers'); expect(url.searchParams.get('openOnly')).toBe('1'); expect(url.searchParams.get('status')).toBeNull(); expect(url.searchParams.get('creditId')).toBe('CR-20'); expect(url.searchParams.get('branchId')).toBe('all'); });
});

it('rejects a completed credit whose installments still have a balance',async()=>{state.fetch.mockResolvedValue({credits:[{id:'credit',principal:100,status:'completed'}],installments:[{credit_id:'credit',amount:100,amount_paid:0,status:'pending'}],payments:[],currency:'USD',timeZone:'America/Asuncion'});await expect(fetchCustomerCredits('customer')).rejects.toThrow('todavía tiene cuotas con saldo')})
