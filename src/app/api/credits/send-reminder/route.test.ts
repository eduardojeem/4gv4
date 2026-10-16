// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ sendEmail: vi.fn(), select: vi.fn(), rows: [] as unknown[] }))
vi.mock('@/lib/api/withTenantAuth', () => ({ withTenantAuth: (_guard: unknown, handler: (req: Request, ctx: { organization: { id: string; name: string } }) => Promise<Response>) => (req: Request) => handler(req, { organization: { id: 'org', name: 'Tienda' } }) }))
vi.mock('@/lib/email/resend', () => ({ sendEmail: mocks.sendEmail }))
vi.mock('@/lib/email/templates', () => ({ renderPaymentReminderEmail: (value: unknown) => JSON.stringify(value) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: () => {
  const query: Record<string, unknown> = {}
  for (const method of ['eq', 'in', 'order']) query[method] = () => query
  query.select = mocks.select.mockImplementation(() => query)
  query.maybeSingle = async () => ({ data: { timezone: 'America/Asuncion' }, error: null })
  query.range = async () => ({ data: mocks.rows, error: null })
  return query
} }) }))
import { POST } from './route'
const request = (body: unknown) => new NextRequest('http://localhost/api/credits/send-reminder', { method: 'POST', body: JSON.stringify(body) })
const id = 'ca810000-0000-4000-8000-000000000001'
beforeEach(() => { mocks.sendEmail.mockReset().mockResolvedValue({ ok: true }); mocks.rows = []; mocks.select.mockClear() })

it('rejects invalid identifiers without sending anything', async () => {
  expect((await POST(request({ customerId: 'invalid' }))).status).toBe(400)
  expect(mocks.sendEmail).not.toHaveBeenCalled()
})
it('uses actual overdue installments and deducts partial payments', async () => {
  mocks.rows = [{ id, customer_id: id, customers: { name: 'Cliente prueba', email: 'fixture@example.test' }, credit_installments: [
    { amount: 100, amount_paid: 30, status: 'late', due_date: '2026-01-01' },
    { amount: 900, amount_paid: 0, status: 'pending', due_date: '2999-12-01' },
  ] }]
  const response = await POST(request({ creditId: id }))
  expect(response.status).toBe(200)
  expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ html: expect.stringContaining('"amount":70') }))
  expect(mocks.select.mock.calls.flat().join(' ')).not.toContain('remaining_amount')
})
it('does not send a reminder when there is no overdue balance', async () => {
  mocks.rows = [{ id, customer_id: id, customers: { email: 'fixture@example.test' }, credit_installments: [
    { amount: 100, amount_paid: 100, status: 'paid', due_date: '2026-01-01' },
  ] }]
  expect((await (await POST(request({ creditId: id }))).json()).data.skipped).toBe(1)
  expect(mocks.sendEmail).not.toHaveBeenCalled()
})
