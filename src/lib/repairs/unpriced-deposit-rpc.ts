import { FinancialClosureRpcError } from './financial-closure-rpc'

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown
    error: { message?: string } | null
  }>
}

export type UnpricedRepairDepositInput = {
  repairId: string
  organizationId: string
  branchId: string
  actorId: string
  method: 'cash' | 'card' | 'transfer'
  amount: number
  reference?: string | null
  note?: string | null
  idempotencyKey: string
  cashSessionId: string
}

export type UnpricedRepairDepositResult = {
  repair_id: string
  payment_id: string
  paid_amount: number
  idempotent: boolean
}

const ERROR_DETAILS: Record<string, { status: number; message: string }> = {
  REPAIR_FINANCIAL_PERMISSION_DENIED: { status: 403, message: 'No tenés permiso para registrar anticipos.' },
  REPAIR_NOT_FOUND: { status: 404, message: 'Reparación no encontrada.' },
  REPAIR_PAYMENT_INVALID_STATE: { status: 422, message: 'No se puede registrar un anticipo en una reparación cancelada.' },
  REPAIR_PRICE_ALREADY_DEFINED: { status: 422, message: 'La reparación ya tiene precio. Registrá el importe como pago del saldo.' },
  REPAIR_PAYMENT_REFERENCE_REQUIRED: { status: 422, message: 'Ingresá la referencia del comprobante para este método de pago.' },
  REPAIR_CASH_REGISTER_NOT_OPEN: { status: 409, message: 'No hay una caja abierta en esta sucursal.' },
  REPAIR_IDEMPOTENCY_CONFLICT: { status: 409, message: 'La clave de esta operación ya fue utilizada con otros datos.' },
}

export async function registerUnpricedRepairDeposit(client: RpcClient, input: UnpricedRepairDepositInput) {
  const { data, error } = await client.rpc('register_unpriced_repair_deposit', {
    p_repair_id: input.repairId,
    p_organization_id: input.organizationId,
    p_branch_id: input.branchId,
    p_actor_id: input.actorId,
    p_payment_method: input.method,
    p_payment_amount: input.amount,
    p_payment_reference: input.reference ?? null,
    p_payment_note: input.note ?? null,
    p_idempotency_key: input.idempotencyKey,
    p_cash_session_id: input.cashSessionId,
  })

  if (error) {
    const rawMessage = error.message || 'REPAIR_DEPOSIT_OPERATION_FAILED'
    const code = Object.keys(ERROR_DETAILS).find(candidate => rawMessage.includes(candidate))
      || 'REPAIR_DEPOSIT_OPERATION_FAILED'
    const detail = ERROR_DETAILS[code]
    throw new FinancialClosureRpcError(detail?.message ?? 'No se pudo registrar el anticipo.', code, detail?.status ?? 500)
  }

  return data as UnpricedRepairDepositResult
}
