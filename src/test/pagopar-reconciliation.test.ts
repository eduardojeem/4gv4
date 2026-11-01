import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PagoparOrderStatusResult } from '@/lib/payments/pagopar'
import type { LocalPagoparSubscriptionPayment } from '@/lib/saas/pagopar-subscription-status'

const supabase = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
const queryPagoparOrder = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => supabase }))
vi.mock('@/lib/saas/subscription-autopay', () => ({ AUTOPAY_PAYMENT_METHOD: 'Pagopar Débito automático' }))
const sendReceipt = vi.hoisted(() => vi.fn())
vi.mock('@/lib/saas/subscription-notifications', () => ({ sendSubscriptionPaymentReceipt: sendReceipt }))
vi.mock('@/lib/payments/pagopar', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/payments/pagopar')>(),
  queryPagoparOrder,
}))

const { reconcilePendingPagoparPayments, syncPagoparPaymentStatus, PAGOPAR_RECONCILE_WINDOW_MS } =
  await import('@/lib/saas/pagopar-reconciliation')

const HASH = 'a'.repeat(64)

function query(result: unknown) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'update', 'eq', 'neq', 'gte', 'order', 'limit']) chain[method] = vi.fn(() => chain)
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve)
  return chain as Record<string, ReturnType<typeof vi.fn>>
}

function localPayment(over: Partial<LocalPagoparSubscriptionPayment> = {}): LocalPagoparSubscriptionPayment {
  return {
    id: 'pay-1',
    amount: 150000,
    currency: 'PYG',
    status: 'pending',
    plan_id: 'pro',
    provider_payment_id: '1234',
    external_reference: HASH,
    ...over,
  }
}

function providerOrder(over: Partial<PagoparOrderStatusResult> = {}): PagoparOrderStatusResult {
  return {
    hash: HASH,
    amount: 150000,
    providerOrderId: '1234',
    paymentMethod: 'Tarjetas de crédito',
    paidAt: '2026-10-31 10:00:00',
    maximumPaymentDate: null,
    message: null,
    status: 'approved',
    ...over,
  }
}

afterEach(() => {
  supabase.rpc.mockReset()
  supabase.from.mockReset()
  queryPagoparOrder.mockReset()
  vi.restoreAllMocks()
})

describe('syncPagoparPaymentStatus', () => {
  it('aplica un pago aprobado con la misma función que el webhook', async () => {
    supabase.rpc.mockResolvedValue({ data: [{ applied: true }], error: null })

    await expect(syncPagoparPaymentStatus(localPayment(), providerOrder())).resolves.toBe('applied')
    expect(sendReceipt).toHaveBeenCalledWith('pay-1')
    expect(supabase.rpc).toHaveBeenCalledWith('apply_paid_subscription_payment', expect.objectContaining({
      p_external_reference: HASH,
      p_provider_payment_id: '1234',
      p_payment_method: 'Tarjetas de crédito',
      p_amount: 150000,
    }))
  })

  it('no vuelve a aplicar un pago ya pagado', async () => {
    await expect(syncPagoparPaymentStatus(localPayment({ status: 'paid' }), providerOrder())).resolves.toBe('already_paid')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('marca como fallido solo si seguía pendiente', async () => {
    const update = query({ error: null })
    supabase.from.mockReturnValue(update)

    await expect(syncPagoparPaymentStatus(localPayment(), providerOrder({ status: 'cancelled' }))).resolves.toBe('failed')
    expect(update.update).toHaveBeenCalledWith({ status: 'failed' })
    expect(update.eq).toHaveBeenCalledWith('status', 'pending')
  })

  it('deja igual un pedido todavía pendiente', async () => {
    await expect(syncPagoparPaymentStatus(localPayment(), providerOrder({ status: 'pending' }))).resolves.toBe('unchanged')
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('propaga el error de la base', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } })
    await expect(syncPagoparPaymentStatus(localPayment(), providerOrder())).rejects.toThrow('boom')
  })
})

describe('reconcilePendingPagoparPayments', () => {
  it('consulta solo pagos únicos pendientes de la ventana y aplica los aprobados', async () => {
    const now = new Date('2026-10-31T12:00:00Z')
    const pending = query({
      data: [
        { ...localPayment(), amount: '150000' },
        { ...localPayment({ id: 'pay-2', external_reference: 'SUB123' }) },
      ],
      error: null,
    })
    supabase.from.mockReturnValueOnce(pending)
    supabase.rpc.mockResolvedValue({ data: [{ applied: true }], error: null })
    queryPagoparOrder.mockResolvedValue(providerOrder())

    const result = await reconcilePendingPagoparPayments(now)

    expect(result).toEqual({ checked: 1, applied: 1, failed: 0, unchanged: 0, errors: 0 })
    expect(queryPagoparOrder).toHaveBeenCalledTimes(1)
    expect(pending.eq).toHaveBeenCalledWith('status', 'pending')
    expect(pending.neq).toHaveBeenCalledWith('payment_method', 'Pagopar Débito automático')
    expect(pending.gte).toHaveBeenCalledWith(
      'created_at',
      new Date(now.getTime() - PAGOPAR_RECONCILE_WINDOW_MS).toISOString(),
    )
  })

  it('no aplica si el monto de Pagopar no coincide', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    supabase.from.mockReturnValueOnce(query({ data: [localPayment()], error: null }))
    queryPagoparOrder.mockResolvedValue(providerOrder({ amount: 1 }))

    const result = await reconcilePendingPagoparPayments()

    expect(result).toMatchObject({ checked: 1, applied: 0, errors: 1 })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('sigue con el resto cuando Pagopar no responde', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    supabase.from.mockReturnValueOnce(query({
      data: [localPayment(), localPayment({ id: 'pay-2', external_reference: 'b'.repeat(64) })],
      error: null,
    }))
    supabase.rpc.mockResolvedValue({ data: [{ applied: true }], error: null })
    queryPagoparOrder
      .mockRejectedValueOnce(new Error('Pagopar tardó demasiado en responder.'))
      .mockResolvedValueOnce(providerOrder({ hash: 'b'.repeat(64) }))

    const result = await reconcilePendingPagoparPayments()

    expect(result).toEqual({ checked: 2, applied: 1, failed: 0, unchanged: 0, errors: 1 })
  })
})
