import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ rpc: vi.fn(), settings: null as unknown }))
vi.mock('@/lib/api/withTenantAuth', () => ({
  withTenantAuth: (_options: unknown, handler: (request: Request, context: unknown) => Promise<Response>) =>
    (request: Request) => handler(request, { organization: { id: 'org' }, user: { id: 'actor', role: 'owner' } }),
}))
vi.mock('@/lib/branches/server', () => ({ getRequestedBranchId: () => null, resolveBranchScopeForUser: async () => ({ branchId: 'branch' }) }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    rpc: m.rpc,
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        in: async () => ({ data: [], error: null }),
        maybeSingle: async () => ({ data: table === 'website_settings' ? { value: m.settings } : null, error: null }),
      }
      return query
    },
  }),
}))

import { POST } from './route'

const id = '11111111-1111-4111-8111-111111111111'
const creditSale = (credit: Record<string, unknown>, amount = 100_000) => new NextRequest('http://x/api/pos/process-sale', {
  method: 'POST',
  headers: { 'x-idempotency-key': 'attempt' },
  body: JSON.stringify({
    p_session_id: id,
    p_sale_data: { customer_id: id },
    p_items: [{ product_id: id, quantity: 1 }],
    p_payments: [{ payment_method: 'credit', amount }],
    p_credit: { installment_count: 3, interest_rate: 10, frequency: 'monthly', ...credit },
  }),
})

describe('condiciones de crédito en la venta POS', () => {
  beforeEach(() => {
    m.rpc.mockReset()
    m.settings = null
  })

  it('explica el tope de interés en vez de un error genérico', async () => {
    const response = await POST(creditSale({ interest_rate: 150 }))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('entre 0% y 100%')
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it('explica el tope de cuotas', async () => {
    const response = await POST(creditSale({ installment_count: 61 }))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('entre 1 y 60')
  })

  it('rechaza más cuotas que unidades de moneda financiadas (cuotas en cero)', async () => {
    const response = await POST(creditSale({ installment_count: 12 }, 5))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('no alcanza para 12 cuotas')
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it('rechaza cuotas por monto que no cubren lo financiado', async () => {
    const response = await POST(creditSale({ schedule_mode: 'installment_amount', installment_amounts: [30_000, 30_000, 30_000] }))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain('no cubren')
    expect(m.rpc).not.toHaveBeenCalled()
  })

  it('aplica la política del negocio a un cajero', async () => {
    m.rpc.mockImplementation(async (name: string) => (
      name === 'credit_schedule_due_date' ? { data: '2026-11-04', error: null } : { data: null, error: { message: 'unexpected' } }
    ))
    m.settings = { posPolicy: { maxInstallments: 2 } }
    const response = await POST(creditSale({}))
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.code).toBe('CREDIT_POLICY')
    expect(body.error).toContain('máximo es de 2 cuotas')
    expect(m.rpc).not.toHaveBeenCalledWith('process_pos_sale_atomic_v6', expect.anything())
  })
})
