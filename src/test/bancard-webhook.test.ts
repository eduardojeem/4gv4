import { createHash } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const supabase = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))

vi.mock('next/server', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/server')>(),
  after: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => supabase }))
vi.mock('@/lib/health/webhook-log', () => ({ recordWebhookEvent: vi.fn() }))
vi.mock('@/lib/saas/subscription-notifications', () => ({ sendSubscriptionPaymentReceipt: vi.fn() }))

const PRIVATE_KEY = 'private-test-key'
const SHOP_PROCESS_ID = '100001'

function query(result: unknown) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'update', 'eq']) chain[method] = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => result)
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain as Record<string, ReturnType<typeof vi.fn>>
}

function notification(operation: Record<string, unknown> = {}) {
  const amount = (operation.amount as string | undefined) ?? '150000.00'
  return {
    operation: {
      token: createHash('md5').update(`${PRIVATE_KEY}${SHOP_PROCESS_ID}confirm${amount}PYG`).digest('hex'),
      shop_process_id: SHOP_PROCESS_ID,
      response: 'S',
      response_details: 'Procesado Satisfactoriamente',
      amount,
      currency: 'PYG',
      authorization_number: '123456',
      ticket_number: '123456789123456',
      response_code: '00',
      response_description: 'Transacción aprobada',
      ...operation,
    },
  }
}

async function post(body: unknown) {
  const { POST } = await import('@/app/api/payments/bancard/webhook/route')
  return POST(new Request('https://www.mitiendapy.com/api/payments/bancard/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

beforeEach(() => {
  vi.stubEnv('BANCARD_PUBLIC_KEY', 'public-test-key')
  vi.stubEnv('BANCARD_PRIVATE_KEY', PRIVATE_KEY)
})

afterEach(() => {
  vi.unstubAllEnvs()
  supabase.rpc.mockReset()
  supabase.from.mockReset()
})

describe('webhook de Bancard', () => {
  it('aplica un pago aprobado y responde status success', async () => {
    supabase.from.mockReturnValue(query({ data: { id: 'pay-1', status: 'pending', payment_method: 'Bancard Tarjeta' }, error: null }))
    supabase.rpc.mockResolvedValue({ data: [{ applied: true, payment_id: 'pay-1' }], error: null })

    const response = await post(notification())

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'success' })
    expect(supabase.rpc).toHaveBeenCalledWith('apply_paid_provider_subscription_payment', expect.objectContaining({
      p_provider: 'bancard',
      p_external_reference: SHOP_PROCESS_ID,
      p_provider_payment_id: '123456',
      p_payment_method: 'Bancard Tarjeta',
      p_amount: 150000,
    }))
  })

  it('rechaza un token inválido sin tocar la base', async () => {
    const response = await post(notification({ token: 'f'.repeat(32) }))

    expect(response.status).toBe(403)
    expect(supabase.from).not.toHaveBeenCalled()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('un monto alterado invalida el token', async () => {
    const body = notification()
    body.operation.amount = '1.00'
    const response = await post(body)
    expect(response.status).toBe(403)
  })

  it('marca como fallido un pago rechazado por la tarjeta', async () => {
    const lookup = query({ data: { id: 'pay-1', status: 'pending', payment_method: 'Bancard Tarjeta' }, error: null })
    const update = query({ error: null })
    supabase.from.mockReturnValueOnce(lookup).mockReturnValueOnce(update)

    const response = await post(notification({ response: 'N', response_code: '05', response_description: 'No autorizado' }))

    expect(response.status).toBe(200)
    expect(update.update).toHaveBeenCalledWith({ status: 'failed' })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('responde 404 si el pago no existe', async () => {
    supabase.from.mockReturnValue(query({ data: null, error: null }))
    const response = await post(notification())
    expect(response.status).toBe(404)
  })

  it('rechaza un cuerpo inválido', async () => {
    const response = await post({ foo: 'bar' })
    expect(response.status).toBe(400)
  })
})
