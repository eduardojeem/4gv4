import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'

const context = vi.hoisted(() => ({ organizationId: 'org-a' }))
vi.mock('@/contexts/ActiveOrganizationContext', () => ({
  useOptionalActiveOrganization: () => ({ organization: { id: context.organizationId } }),
}))
vi.mock('@/hooks/use-auth', () => ({ useAuth: () => ({ user: { id: 'user' } }) }))
vi.mock('@/contexts/branch-context', () => ({ useOptionalBranch: () => undefined }))
vi.mock('@/lib/config', () => ({ config: { supabase: { isConfigured: false } } }))
import { useCredits, isInstallmentLate } from '@/hooks/use-credits'

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); sessionStorage.clear(); context.organizationId = 'org-a' })

it('exposes recovery for a completed credit with no pending installment', async () => {
  sessionStorage.setItem('collection-attempt:v1:org-a:user:customer-a', JSON.stringify({
    endpoint: '/api/credits', fingerprint: 'frozen', payload: { installmentId: 'paid-installment', amount: 100, idempotencyKey: 'saved-key' },
  }))
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ success: true, data: {
    credits: [{ id: 'credit-a', customer_id: 'customer-a', status: 'completed' }],
    installments: [{ id: 'paid-installment', credit_id: 'credit-a', status: 'paid', amount: 100, amount_paid: 100 }],
    payments: [], summary: [{credit_id:'credit-a',saldo_pendiente:25}], installmentsProgress: [], customers: [], sales: [], saleItems: [],
    globalSummary: { outstanding: 0 }, pagination: { complete: true },
  } }))))
  const { result } = renderHook(() => useCredits())
  await waitFor(() => expect(result.current.loading).toBe(false))
  expect(result.current.pendingCreditPayments).toEqual([expect.objectContaining({ creditId: 'credit-a', installmentId: 'paid-installment' })])
  expect(result.current.remainingByCredit['credit-a']).toBe(0)
})

it('uses the organization calendar when deciding whether an installment is overdue', () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-12T02:00:00Z'))
  expect(isInstallmentLate({ id: 'i', credit_id: 'c', installment_number: 1, due_date: '2026-10-11', amount: 100, status: 'pending' }, 'America/Asuncion')).toBe(false)
  expect(isInstallmentLate({ id: 'i', credit_id: 'c', installment_number: 1, due_date: '2026-10-11', amount: 100, status: 'pending' }, 'Asia/Tokyo')).toBe(true)
})

it('hides the previous organization portfolio while the next organization loads', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: {
    credits: [{ id: 'credit-a', customer_id: 'customer-a', status: 'active' }],
    installments: [], payments: [], summary: [], installmentsProgress: [], customers: [], sales: [], saleItems: [],
    globalSummary: { outstanding: 100 }, pagination: { complete: true },
  } }))).mockImplementation(() => new Promise(() => {}))
  vi.stubGlobal('fetch', fetcher)
  const { result, rerender } = renderHook(() => useCredits())
  await waitFor(() => expect(result.current.credits).toHaveLength(1))
  context.organizationId = 'org-b'
  rerender()
  expect(result.current.credits).toEqual([])
  expect(result.current.globalSummary).toBeNull()
  expect(result.current.creditById).toEqual({})
})
