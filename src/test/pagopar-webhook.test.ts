import { createHash } from 'crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const supabase = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))

vi.mock('next/server', async (importOriginal) => ({
  ...await importOriginal<typeof import('next/server')>(),
  after: vi.fn(),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => supabase }))
vi.mock('@/lib/health/webhook-log', () => ({ recordWebhookEvent: vi.fn() }))

const PRIVATE_KEY = 'private-test-key'
const HASH = 'a'.repeat(64)

function query(result: unknown) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'update', 'eq']) chain[method] = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(async () => result)
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain as Record<string, ReturnType<typeof vi.fn>>
}

function notification(item: Record<string, unknown> = {}) {
  return {
    resultado: [{
      pagado: true,
      cancelado: false,
      monto: '150.000',
      numero_pedido: '1234',
      forma_pago: 'Tarjetas de crédito',
      fecha_pago: '2026-10-31 10:00:00',
      hash_pedido: HASH,
      token: createHash('sha1').update(`${PRIVATE_KEY}${HASH}`).digest('hex'),
      ...item,
    }],
    respuesta: true,
  }
}

async function post(body: unknown) {
  const { POST } = await import('@/app/api/payments/pagopar/webhook/route')
  return POST(new Request('https://www.mitiendapy.com/api/payments/pagopar/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

beforeEach(() => {
  vi.stubEnv('PAGOPAR_PRIVATE_KEY', PRIVATE_KEY)
})

afterEach(() => {
  vi.unstubAllEnvs()
  supabase.rpc.mockReset()
  supabase.from.mockReset()
})

describe('webhook de Pagopar', () => {
  it('aplica el pago y devuelve el mismo resultado que envió Pagopar', async () => {
    supabase.rpc.mockResolvedValue({ data: [{ applied: true, plan_id: 'pro' }], error: null })
    const body = notification()

    const response = await post(body)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(body.resultado)
    expect(supabase.rpc).toHaveBeenCalledWith('apply_paid_subscription_payment', expect.objectContaining({
      p_external_reference: HASH,
      p_provider_payment_id: '1234',
      p_amount: 150000,
    }))
  })

  it('confirma también las notificaciones repetidas de un pago ya aplicado', async () => {
    supabase.rpc.mockResolvedValue({ data: [{ applied: false, plan_id: 'pro' }], error: null })
    const body = notification()

    const response = await post(body)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(body.resultado)
  })

  it('rechaza un token que no corresponde sin tocar la base', async () => {
    const response = await post(notification({ token: 'b'.repeat(40) }))

    expect(response.status).toBe(403)
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('rechaza un token de otro largo', async () => {
    const response = await post(notification({ token: 'corto' }))
    expect(response.status).toBe(403)
  })

  it('marca como fallido un pedido cancelado', async () => {
    const lookup = query({ data: { id: 'pay-1', status: 'pending' }, error: null })
    const update = query({ error: null })
    supabase.from.mockReturnValueOnce(lookup).mockReturnValueOnce(update)
    const body = notification({ pagado: false, cancelado: true })

    const response = await post(body)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(body.resultado)
    expect(update.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }))
    expect(update.eq).toHaveBeenCalledWith('id', 'pay-1')
  })

  it('no vuelve a pendiente un pago que ya estaba aplicado', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const lookup = query({ data: { id: 'pay-1', status: 'paid' }, error: null })
    supabase.from.mockReturnValueOnce(lookup)
    const body = notification({ pagado: false, cancelado: false })

    const response = await post(body)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(body.resultado)
    expect(supabase.from).toHaveBeenCalledTimes(1)
  })

  it('responde 404 cuando el pedido no es de este sistema', async () => {
    supabase.from.mockReturnValueOnce(query({ data: null, error: null }))

    const response = await post(notification({ pagado: false }))

    expect(response.status).toBe(404)
  })
})
