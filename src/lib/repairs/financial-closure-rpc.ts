export type FinancialClosurePaymentInput = {
  method: 'cash' | 'card' | 'transfer' | 'credit'
  amount: number
  reference?: string | null
  note?: string | null
  idempotencyKey: string
}

export type FinancialClosureRpcInput = {
  repairId: string
  organizationId: string
  branchId: string
  actorId: string
  deliver: boolean
  outcome?: 'repaired' | 'withdrawn' | 'unrepairable' | null
  note?: string | null
  allowOutstandingBalance: boolean
  payment?: FinancialClosurePaymentInput | null
  cashSessionId?: string | null
  creditId?: string | null
  saleId?: string | null
  source?: 'repairs' | 'delivery' | 'pos'
  idempotencyKey?: string
}

export type FinancialClosureRpcResult = {
  repair_id: string
  payment_id: string | null
  idempotent: boolean
  total: number
  paid_amount: number
  balance: number
  payment_status: 'pendiente' | 'parcial' | 'pagado'
  delivered: boolean
}

type RpcError = { message?: string; code?: string }
type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown
    error: RpcError | null
  }>
}

const ERROR_STATUS: Record<string, number> = {
  REPAIR_FINANCIAL_PERMISSION_DENIED: 403,
  REPAIR_NOT_FOUND: 404,
  REPAIR_ALREADY_DELIVERED: 409,
  REPAIR_IDEMPOTENCY_CONFLICT: 409,
  REPAIR_DELIVERY_INVALID_STATE: 422,
  REPAIR_PAYMENT_INVALID_STATE: 422,
  REPAIR_DELIVERY_OUTCOME_INVALID: 422,
  REPAIR_FINAL_COST_REQUIRED: 422,
  REPAIR_PAYMENT_EXCEEDS_BALANCE: 422,
  REPAIR_CREDIT_MUST_COVER_BALANCE: 422,
  REPAIR_OUTSTANDING_CONFIRMATION_REQUIRED: 422,
  REPAIR_CASH_REGISTER_NOT_OPEN: 409,
}

export class FinancialClosureRpcError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'FinancialClosureRpcError'
  }
}

function extractStableCode(error: RpcError) {
  const message = error.message || 'REPAIR_FINANCIAL_OPERATION_FAILED'
  return Object.keys(ERROR_STATUS).find((code) => message.includes(code))
    || 'REPAIR_FINANCIAL_OPERATION_FAILED'
}

export async function closeRepairAndRegisterPayment(
  client: RpcClient,
  input: FinancialClosureRpcInput,
) {
  const payment = input.payment ?? null
  const idempotencyKey = payment?.idempotencyKey ?? input.idempotencyKey
  if (!idempotencyKey) {
    throw new FinancialClosureRpcError(
      'La operación necesita una clave de idempotencia.',
      'REPAIR_IDEMPOTENCY_KEY_REQUIRED',
      400,
    )
  }

  const { data, error } = await client.rpc('close_repair_and_register_payment', {
    p_repair_id: input.repairId,
    p_organization_id: input.organizationId,
    p_branch_id: input.branchId,
    p_actor_id: input.actorId,
    p_deliver: input.deliver,
    p_delivery_outcome: input.outcome ?? null,
    p_delivery_note: input.note ?? null,
    p_allow_outstanding_balance: input.allowOutstandingBalance,
    p_payment_method: payment?.method ?? null,
    p_payment_amount: payment?.amount ?? null,
    p_payment_reference: payment?.reference ?? null,
    p_payment_note: payment?.note ?? null,
    p_idempotency_key: idempotencyKey,
    p_cash_session_id: input.cashSessionId ?? null,
    p_credit_id: input.creditId ?? null,
    p_sale_id: input.saleId ?? null,
    p_source: input.source ?? (input.deliver ? 'delivery' : 'repairs'),
  })

  if (error) {
    const code = extractStableCode(error)
    throw new FinancialClosureRpcError(error.message || code, code, ERROR_STATUS[code] ?? 500)
  }

  return data as FinancialClosureRpcResult
}
