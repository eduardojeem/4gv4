// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ failPage: false, includeCancelled: false, scopes: [] as string[] }))
vi.mock('@/lib/api/withTenantAuth', () => ({
  withTenantAuth: (_options: unknown, handler: (request: NextRequest, context: unknown) => unknown) =>
    (request: NextRequest) => handler(request, { organization: { id: 'org-a', role: 'owner' } }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({
  from: (table: string) => {
    let from = 0, to = 499
    const builder = {
      select: () => builder,
      eq: (column: string, value: string) => { if (column === 'organization_id') fixture.scopes.push(value); return builder },
      in: () => builder, order: () => builder,
      range: (start: number, end: number) => { from = start; to = end; return builder },
      overrideTypes: () => builder,
      maybeSingle: async () => ({ data: { timezone: 'America/Asuncion' }, error: null }),
      then: (resolve: (result: unknown) => unknown) => {
        if (fixture.failPage && table === 'credit_installments' && from > 0) return Promise.resolve(resolve({ data: null, error: { message: 'Read failed' } }))
        const rows = table === 'credit_details' ? [
          { id: 'credit-a', customer_id: 'customer-a', customer_name: 'Ana', status: 'active' },
          ...(fixture.includeCancelled ? [{ id: 'credit-cancelled', customer_id: 'customer-b', customer_name: 'N/A', status: 'cancelled' }] : []),
        ] :
          table === 'credit_installments' ? [...Array.from({ length: 1201 }, (_, index) => ({
            id: String(index), credit_id: 'credit-a', installment_number: index + 1, amount: 100, amount_paid: 25,
            status: 'pending', due_date: '2099-10-10',
          })), ...(fixture.includeCancelled ? [
            { id: 'cancelled-installment', credit_id: 'credit-a', installment_number: 2000, amount: 50, amount_paid: 0, status: 'cancelled', due_date: '2020-01-01' },
            { id: 'cancelled-parent-installment', credit_id: 'credit-cancelled', installment_number: 1, amount: 900, amount_paid: 0, status: 'pending', due_date: '2020-01-01' },
          ] : [])] : []
        return Promise.resolve(resolve({ data: rows.slice(from, to + 1), error: null }))
      },
    }
    return builder
  },
}) }))
import { GET } from '@/app/api/credits/route'
beforeEach(() => { fixture.failPage = false; fixture.includeCancelled = false; fixture.scopes = [] })

it('keeps full global and filtered totals independent of the visible page', async () => {
  const response = await GET(new NextRequest('http://localhost/api/credits?page=2&per_page=10&status=pending'))
  const { data } = await response.json()
  expect(response.status).toBe(200)
  expect(data.installments).toHaveLength(10)
  expect(data.pagination.total).toBe(1201)
  expect(data.globalSummary.outstanding).toBe(90075)
  expect(data.filteredSummary.outstanding).toBe(90075)
  expect(fixture.scopes.every(id => id === 'org-a')).toBe(true)
})
it('does not return a partial portfolio after a later page fails', async () => {
  fixture.failPage = true
  expect((await GET(new NextRequest('http://localhost/api/credits'))).status).toBe(500)
})
it('excludes cancelled installments and cancelled parents consistently with and without pagination', async () => {
  fixture.includeCancelled = true
  const complete = await GET(new NextRequest('http://localhost/api/credits'))
  const completeData = (await complete.json()).data
  expect(completeData.installments).toHaveLength(1201)
  expect(completeData.installments.some((row: { status: string }) => row.status === 'cancelled')).toBe(false)
  expect(completeData.pagination.total).toBe(1201)
  expect(completeData.globalSummary.outstanding).toBe(90075)

  const page = await GET(new NextRequest('http://localhost/api/credits?page=1&per_page=10'))
  const pageData = (await page.json()).data
  expect(pageData.installments).toHaveLength(10)
  expect(pageData.pagination.total).toBe(1201)

  const cancelled = await GET(new NextRequest('http://localhost/api/credits?status=cancelled'))
  const cancelledData = (await cancelled.json()).data
  expect(cancelledData.installments).toHaveLength(1)
  expect(cancelledData.installments[0].status).toBe('cancelled')
  expect(cancelledData.filteredSummary.outstanding).toBe(0)
})
it.each(['status=unknown', 'fromDate=2026-02-30', 'minAmount=not-a-number'])('rejects invalid portfolio filters: %s', async query => {
  expect((await GET(new NextRequest('http://localhost/api/credits?' + query))).status).toBe(400)
})
