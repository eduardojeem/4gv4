import { afterEach, describe, expect, it, vi } from 'vitest'
import type { BancardOrderStatusResult } from '@/lib/payments/bancard'
import type { LocalBancardSubscriptionPayment } from '@/lib/saas/bancard-subscription-status'

const supabase = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
const queryBancardPayment = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => supabase }))
vi.mock('@/lib/saas/subscription-notifications', () => ({ sendSubscriptionPaymentReceipt: vi.fn() }))
vi.mock('@/lib/payments/bancard', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/payments/bancard')>(),
  queryBancardPayment,
}))

const { reconcilePendingBancardPayments, syncBancardPaymentStatus, BANCARD_RECONCILE_WINDOW_MS } =
  await import('@/lib/saas/bancard-subscription-status')

function query(result: unknown) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'update', 'eq', 'neq', 'gte', 'order', 'limit']) chain[method] = vi.fn(() => chain)
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain as Record<string, ReturnType<typeof vi.fn>>
}

function localPayment(over: Partial<LocalBancardSubscriptionPayment> = {}): LocalBancardSubscriptionPayment {
  return {
    id: 'pay-1',
    amount: 150000,
    currency: 'PYG',
    status: 'pending',
    plan_id: 'PRO',
    payment_method: 'Bancard Tarjeta',
    provider_payment_id: 'process-123',
    external_reference: '100001',
    created_at: '2026-11-07T10:00:00Z',
    ...over,
  }
}

function providerOrder(over: Partial<BancardOrderStatusResult> = {}): BancardOrderStatusResult {
  return {
    shopProcessId: '100001',
    status: 'approved',
    amount: 150000,
    authorizationNumber: '123456',
    ticketNumber: '987',
    message: null,
    ...over,
  }
}

afterEach(() => {
  supabase.rpc.mockReset()
  supabase.from.mockReset()
  queryBancardPayment.mockReset()
  vi.restoreAllMocks()
})

describe('syncBancardPaymentStatus', () => {
  it('aplica un pago aprobado con el proveedor bancard', async () => {
    supabase.rpc.mockResolvedValue({ data: [{ applied: true }], error: null })

    await expect(syncBancardPaymentStatus(localPayment(), providerOrder())).resolves.toBe('applied')
    expect(supabase.rpc).toHaveBeenCalledWith('apply_paid_provider_subscription_payment', expect.objectContaining({
      p_provider: 'bancard',
      p_external_reference: '100001',
      p_provider_payment_id: '123456',
      p_amount: 150000,
    }))
  })

  it('no toca un pago ya pagado', async () => {
    await expect(syncBancardPaymentStatus(localPayment({ status: 'paid' }), providerOrder())).resolves.toBe('already_paid')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('marca como fallido un pago rechazado o abandonado', async () => {
    supabase.from.mockReturnValue(query({ error: null }))
    await expect(syncBancardPaymentStatus(localPayment(), providerOrder({ status: 'rejected' }))).resolves.toBe('failed')
    await expect(syncBancardPaymentStatus(localPayment(), providerOrder({ status: 'cancelled' }))).resolves.toBe('failed')
  })

  it('deja igual un pago todavía pendiente', async () => {
    await expect(syncBancardPaymentStatus(localPayment(), providerOrder({ status: 'pending', amount: null }))).resolves.toBe('unchanged')
  })
})

describe('reconcilePendingBancardPayments', () => {
  it('consulta los pendientes de la ventana sin incluir el débito automático', async () => {
    const now = new Date('2026-11-07T12:00:00Z')
    const pending = query({ data: [localPayment()], error: null })
    supabase.from.mockReturnValue(pending)
    supabase.rpc.mockResolvedValue({ data: [{ applied: true }], error: null })
    queryBancardPayment.mockResolvedValue(providerOrder())

    const result = await reconcilePendingBancardPayments(now)

    expect(result).toMatchObject({ checked: 1, applied: 1, errors: 0 })
    expect(pending.eq).toHaveBeenCalledWith('provider', 'bancard')
    expect(pending.neq).toHaveBeenCalledWith('payment_method', 'Bancard Débito automático')
    expect(pending.gte).toHaveBeenCalledWith('created_at', new Date(now.getTime() - BANCARD_RECONCILE_WINDOW_MS).toISOString())
  })

  it('no aplica si el monto no coincide', async () => {
    supabase.from.mockReturnValue(query({ data: [localPayment()], error: null }))
    queryBancardPayment.mockResolvedValue(providerOrder({ amount: 1 }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await reconcilePendingBancardPayments()

    expect(result).toMatchObject({ checked: 1, applied: 0, errors: 1 })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('sigue con el resto cuando Bancard no responde', async () => {
    supabase.from.mockReturnValue(query({
      data: [localPayment(), localPayment({ id: 'pay-2', external_reference: '100002' })],
      error: null,
    }))
    supabase.rpc.mockResolvedValue({ data: [{ applied: true }], error: null })
    queryBancardPayment
      .mockRejectedValueOnce(new Error('Bancard tardó demasiado en responder.'))
      .mockResolvedValueOnce(providerOrder({ shopProcessId: '100002' }))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await reconcilePendingBancardPayments()

    expect(result).toMatchObject({ checked: 2, applied: 1, errors: 1 })
  })
})
