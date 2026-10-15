import { z } from 'zod'
import { collectionRequestSchema, collectionResultSchema, type CollectionResult } from './collection-contract'

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

export async function collectCustomerPayment(admin: RpcClient, input: {
  organizationId: string; customerId: string; actorId: string; branchId: string; request: unknown
}): Promise<CollectionResult> {
  const ids = z.array(z.string().uuid()).safeParse([input.organizationId, input.customerId, input.actorId, input.branchId])
  if (!ids.success) throw new CollectionError('No se pudo validar el cliente, la sucursal o quién cobra.', 403, 'COLLECTION_FORBIDDEN')
  const parsed = collectionRequestSchema.safeParse(input.request)
  if (!parsed.success) throw new CollectionError(parsed.error.issues[0]?.message || 'Cobro inválido.', 400, 'COLLECTION_INVALID_REQUEST')
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
