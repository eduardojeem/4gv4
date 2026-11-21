import { recoverCollectionReplay } from '@/lib/payments/collection-replay'
import { assertCommercePayments } from '@/lib/payments/control-store'
import { PaymentControlError } from '@/lib/payments/control-contract'
import { z } from 'zod'
import { collectionRequestSchema, collectionResultSchema, type CollectionRequest, type CollectionResult } from './collection-contract'
import { isCurrencyAmount, moneyFractionDigits } from './money-input'

type RpcClient = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
  data: unknown; error: { message?: string; code?: string } | null
}> }
export class CollectionError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) {
    super(message)
    this.name = 'CollectionError'
  }
}
const errors: Record<string, [number, string]> = {
  COLLECTION_BALANCE_CHANGED: [409, 'El saldo cambió. Actualizá las deudas y revisá el reparto antes de cobrar.'],
  COLLECTION_IDEMPOTENCY_CONFLICT: [409, 'Este intento corresponde a otro cobro. Verificá el comprobante antes de continuar.'],
  COLLECTION_FORBIDDEN: [403, 'No tenés permiso para cobrar en esta organización o sucursal.'],
  COLLECTION_CASH_CLOSED: [409, 'Abrí la caja de esta sucursal antes de cobrar.'],
  COLLECTION_CUSTOMER_NOT_FOUND: [404, 'El cliente no pertenece a la organización activa.'],
  COLLECTION_INVALID_REQUEST: [400, 'Revisá el monto, comprobante y reparto del cobro.'],
  COLLECTION_EXCESS_CONFIRMATION: [422, 'Confirmá el excedente a saldo a favor o ajustá el monto.'],
}

type SettingsClient = { from: (table: 'organization_settings') => { select: (columns: 'currency') => { eq: (column: 'organization_id', value: string) => {
  maybeSingle: () => PromiseLike<{ data: { currency?: string | null } | null; error: unknown }> } } } }
/** Moneda de la organización para validar cobros; PYG si no se configuró. */
export async function readCollectionCurrency(admin: SettingsClient, organizationId: string): Promise<string> {
  const { data, error } = await admin.from('organization_settings').select('currency').eq('organization_id', organizationId).maybeSingle()
  if (error) throw new CollectionError('No se pudo validar la moneda de la organización. Reintentá.', 503, 'COLLECTION_CURRENCY_UNAVAILABLE')
  const currency = String(data?.currency || 'PYG').toUpperCase()
  return /^[A-Z]{3}$/.test(currency) ? currency : 'PYG'
}

/**
 * Monto y reparto en la unidad de la moneda: en guaraníes, enteros. Una deuda
 * vieja con céntimos se puede saldar solo por su saldo exacto, elegida a mano,
 * para que ningún cobro nuevo deje restos que no se pueden cobrar.
 */
export function collectionAmountsMatchCurrency(request: CollectionRequest, currency: string, pendingById: Record<string, number> = {}): boolean {
  const allocations = request.allocations ?? []
  if (isCurrencyAmount(request.amount, currency) && allocations.every(row => isCurrencyAmount(row.amount, currency))) return true
  if (request.mode !== 'manual' || !allocations.length) return false
  const settlesExactly = allocations.every(row => isCurrencyAmount(row.amount, currency)
    || (pendingById[row.id] !== undefined && Math.abs(pendingById[row.id] - row.amount) < 1e-9))
  const allocated = allocations.reduce((sum, row) => sum + row.amount, 0)
  return settlesExactly && isCurrencyAmount(Math.round((request.amount - allocated) * 100) / 100, currency)
}

export async function collectCustomerPayment(admin: RpcClient, input: {
  organizationId: string; customerId: string; actorId: string; branchId: string; request: unknown
  /** Moneda de la organización. Sin ella solo se exige el máximo de dos decimales. */
  currency?: string
  /** Saldo actual de las deudas elegidas, para aceptar el pago exacto de una deuda vieja con céntimos. */
  pendingById?: Record<string, number>
}): Promise<CollectionResult> {
  const ids = z.array(z.string().uuid()).safeParse([input.organizationId, input.customerId, input.actorId, input.branchId])
  if (!ids.success) throw new CollectionError('No se pudo validar el cliente, la sucursal o quién cobra.', 403, 'COLLECTION_FORBIDDEN')
  const parsed = collectionRequestSchema.safeParse(input.request)
  if (!parsed.success) throw new CollectionError(parsed.error.issues[0]?.message || 'Cobro inválido.', 400, 'COLLECTION_INVALID_REQUEST')
  if (input.currency && !collectionAmountsMatchCurrency(parsed.data, input.currency, input.pendingById)) {
    // An attempt sent before this rule may already be committed: return its receipt instead of rejecting it.
    let replay: CollectionResult | null = null
    try { replay = await recoverCollectionReplay({ ...input, request: parsed.data }) }
    catch { throw new CollectionError('No se pudo comprobar el resultado del cobro. Reintentá con el mismo identificador.', 503, 'COLLECTION_REPLAY_UNAVAILABLE') }
    if (replay) return replay
    throw new CollectionError(moneyFractionDigits(input.currency) === 0
      ? 'Los guaraníes no llevan decimales. Ingresá el monto entero o elegí la cuota para saldarla exacta.'
      : `El monto admite hasta ${moneyFractionDigits(input.currency)} decimales.`, 400, 'COLLECTION_INVALID_REQUEST')
  }
  try { await assertCommercePayments(input.organizationId, [{ method: parsed.data.paymentMethod }]) }
  catch (error) {
    if (error instanceof PaymentControlError) {
      try {
        const replay = await recoverCollectionReplay({ ...input, request: parsed.data })
        if (replay) return replay
      } catch { throw new CollectionError('No se pudo comprobar el resultado del cobro. Reintentá con el mismo identificador.', 503, 'COLLECTION_REPLAY_UNAVAILABLE') }
      throw new CollectionError(error.message, error.status, error.code)
    }
    throw error
  }
  const { data, error } = await admin.rpc('collect_customer_payment_atomic', {
    p_organization_id: input.organizationId, p_customer_id: input.customerId,
    p_actor_id: input.actorId, p_branch_id: input.branchId, p_request: parsed.data,
  })
  if (error) {
    if (['PGRST202', '42883', '42P01'].includes(error.code || '')) {
      throw new CollectionError('El cobro seguro requiere actualizar la base de datos.', 503, 'COLLECTION_MIGRATION_REQUIRED')
    }
    const code = Object.keys(errors).find(key => error.message?.includes(key))
    if (code) throw new CollectionError(errors[code][1], errors[code][0], code)
    throw new CollectionError('No se pudo confirmar el cobro. Verificá el resultado antes de reintentar.', 500, 'COLLECTION_FAILED')
  }
  const result = collectionResultSchema.safeParse(data)
  if (!result.success) throw new CollectionError('No se pudo validar el comprobante. Reintentá el mismo cobro para recuperar el resultado.', 502, 'COLLECTION_RESULT_INVALID')
  return result.data
}
