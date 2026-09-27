import type { UnrepairedCloseoutRequest } from './unrepaired-closeout'

type RpcError = { message?: string; code?: string }
type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError | null }>
}

export type UnrepairedCloseoutRpcResult = {
  repair_id: string
  closeout_id: string
  payment_id: string | null
  store_credit_id: string | null
  idempotent: boolean
  final_charge: number
  paid_before: number
  settlement_amount: number
  payment_status: 'pendiente' | 'parcial' | 'pagado'
}

const ERROR_DETAILS: Record<string, { status: number; message: string }> = {
  REPAIR_FINANCIAL_PERMISSION_DENIED: { status: 403, message: 'No tenés permiso para cerrar esta reparación.' },
  REPAIR_NOT_FOUND: { status: 404, message: 'Reparación no encontrada.' },
  REPAIR_ALREADY_DELIVERED: { status: 409, message: 'La reparación ya fue entregada.' },
  REPAIR_CLOSEOUT_CONFLICT: { status: 409, message: 'El cierre ya fue usado con otros datos. Recargá la reparación.' },
  REPAIR_CASH_REGISTER_NOT_OPEN: { status: 409, message: 'No hay una caja abierta en esta sucursal. Abrí caja para continuar.' },
  REPAIR_PART_RESOLUTION_REQUIRED: { status: 422, message: 'Indicá qué sucede con cada repuesto antes de entregar.' },
  REPAIR_TRANSFER_REFERENCE_REQUIRED: { status: 422, message: 'Ingresá la referencia de la transferencia.' },
  REPAIR_SETTLEMENT_MISMATCH: { status: 422, message: 'La forma de conciliar el saldo ya no coincide con los importes actuales.' },
  REPAIR_DELIVERY_INVALID_STATE: { status: 422, message: 'El equipo debe estar listo antes de entregarlo.' },
  REPAIR_EXCEPTION_REASON_REQUIRED: { status: 422, message: 'Explicá el motivo del importe excepcional.' },
  REPAIR_INVENTORY_ROW_MISSING: { status: 409, message: 'Un repuesto ya no tiene inventario válido en esta sucursal.' },
}

export class UnrepairedCloseoutRpcError extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) {
    super(message)
    this.name = 'UnrepairedCloseoutRpcError'
  }
}

function stableError(error: RpcError) {
  const raw = error.message ?? ''
  const code = Object.keys(ERROR_DETAILS).find((candidate) => raw.includes(candidate))
    ?? 'REPAIR_CLOSEOUT_FAILED'
  return { code, ...(ERROR_DETAILS[code] ?? { status: 500, message: 'No se pudo cerrar la reparación.' }) }
}

export async function closeUnrepairedRepair(client: RpcClient, input: {
  repairId: string
  organizationId: string
  branchId: string
  actorId: string
  request: UnrepairedCloseoutRequest
  cashSessionId?: string | null
}) {
  const { request } = input
  const { data, error } = await client.rpc('close_unrepaired_repair', {
    p_repair_id: input.repairId,
    p_organization_id: input.organizationId,
    p_branch_id: input.branchId,
    p_actor_id: input.actorId,
    p_outcome: request.outcome,
    p_charge: request.charge,
    p_parts: request.parts,
    p_settlement: request.settlement,
    p_reason: request.reason ?? null,
    p_note: request.note ?? null,
    p_cash_session_id: input.cashSessionId ?? null,
    p_idempotency_key: request.idempotencyKey,
  })

  if (error) {
    const detail = stableError(error)
    throw new UnrepairedCloseoutRpcError(detail.message, detail.code, detail.status)
  }
  return data as UnrepairedCloseoutRpcResult
}
