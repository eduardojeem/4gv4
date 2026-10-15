import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('@/lib/config', () => ({ config: { supabase: { isConfigured: true } } }))
vi.mock('@/contexts/ActiveOrganizationContext', () => ({ useOptionalActiveOrganization: () => ({ organization: { id: 'org' } }) }))
import { useCustomersWithCredits } from '@/hooks/use-customer-credits'
import { mapRawToCustomer } from '@/hooks/use-customer-state'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const customers = [mapRawToCustomer({ id: 'customer', name: 'Ana', credit_limit: 1000 })]
it('invalidates figures and exposes an error when the batch query fails', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
  const { result } = renderHook(() => useCustomersWithCredits(customers))
  await waitFor(() => expect(result.current.error).toBeTruthy())
  expect(result.current.creditSummaries).toEqual({})
})
it('sums every overdue active installment and excludes completed credit debt', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ timeZone: 'America/Asuncion', repairDebts: {},
    credits: [{ id: 'active', customer_id: 'customer', status: 'active', principal: 300 },
      { id: 'done', customer_id: 'customer', status: 'completed', principal: 100 }],
    installments: [{ id: 'one', credit_id: 'active', status: 'pending', amount: 100, amount_paid: 0, due_date: '2026-01-01' },
      { id: 'two', credit_id: 'active', status: 'pending', amount: 200, amount_paid: 0, due_date: '2026-01-02' },
      { id: 'three', credit_id: 'done', status: 'pending', amount: 100, amount_paid: 75, due_date: '2026-01-03' }],
  }))))
  const { result } = renderHook(() => useCustomersWithCredits(customers))
  await waitFor(() => expect(result.current.creditSummaries.customer).toBeTruthy())
  expect(result.current.creditSummaries.customer.total_pending).toBe(300)
  expect(result.current.creditSummaries.customer.overdue_debt).toBe(300)
})
