import type { RepairTaxRate } from './cost-breakdown'

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown
    error: { message?: string; code?: string } | null
  }>
}

export type RepairCostPartIntent = {
  productId?: string | null
  name: string
  partNumber?: string | null
  supplier?: string | null
  quantity: number
  unitPrice: number
  unitCost?: number
  discountAmount: number
  taxRate?: RepairTaxRate
}

export type RepairCostSaveIntent = {
  laborAmount: number
  parts: RepairCostPartIntent[]
  additionalCharges: number
  deductions: number
  discountAmount: number
  overrideReason?: string | null
  idempotencyKey: string
}

export type RepairCostScope = {
  repairId: string
  organizationId: string
  branchId: string
  actorId: string
}

export type RepairCostRpcResult = {
  revisionId: string
  revisionNumber?: number
  summary: Record<string, unknown>
  parts: Array<Record<string, unknown>>
}

const ERROR_MAP: Record<string, { message: string; status: number }> = {
  REPAIR_DISCOUNT_LIMIT_EXCEEDED: {
    message: 'El descuento supera el límite permitido y requiere autorización administrativa.',
    status: 403,
  },
  REPAIR_PART_BELOW_COST: {
    message: 'Una pieza queda por debajo de su costo y requiere autorización administrativa.',
    status: 403,
  },
  REPAIR_OVERRIDE_REASON_REQUIRED: {
    message: 'Ingresá un motivo de al menos 5 caracteres para autorizar la excepción.',
    status: 422,
  },
  REPAIR_COST_IDEMPOTENCY_CONFLICT: {
    message: 'La confirmación ya fue utilizada con datos diferentes. Volvé a revisar los costos.',
    status: 409,
  },
  REPAIR_COST_NOT_EDITABLE: {
    message: 'La reparación ya no admite cambios de costos.',
    status: 422,
  },
  REPAIR_FINAL_BELOW_PAID_AMOUNT: {
    message: 'El total no puede quedar por debajo del monto ya pagado.',
    status: 422,
  },
  REPAIR_DISCOUNT_EXCEEDS_SUBTOTAL: {
    message: 'Los descuentos y deducciones superan el subtotal de la reparación.',
    status: 422,
  },
}

export class RepairCostRpcError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'RepairCostRpcError'
  }
}

function mapRpcError(message?: string) {
  const stock = message?.match(/REPAIR_STOCK_CHANGED\|([^|]+)\|(\d+)/)
  if (stock) {
    return new RepairCostRpcError(
      `El stock cambió mientras editabas. Disponible: ${stock[2]}.`,
      'REPAIR_STOCK_CHANGED',
      409,
      { productId: stock[1], availableStock: Number(stock[2]) },
    )
  }
  const code = Object.keys(ERROR_MAP).find((candidate) => message?.includes(candidate))
  if (code) return new RepairCostRpcError(ERROR_MAP[code].message, code, ERROR_MAP[code].status)
  return new RepairCostRpcError(
    message || 'No se pudieron guardar los costos de la reparación.',
    'REPAIR_COST_SAVE_FAILED',
    500,
  )
}

export async function saveRepairCostRevision(
  client: unknown,
  scope: RepairCostScope,
  intent: RepairCostSaveIntent,
): Promise<RepairCostRpcResult> {
  const { data, error } = await (client as RpcClient).rpc('save_repair_cost_revision', {
    p_repair_id: scope.repairId,
    p_organization_id: scope.organizationId,
    p_branch_id: scope.branchId,
    p_actor_id: scope.actorId,
    p_labor_amount: intent.laborAmount,
    p_parts: intent.parts.map((part) => ({
      product_id: part.productId ?? null,
      part_name: part.name,
      part_number: part.partNumber ?? null,
      supplier: part.supplier ?? null,
      quantity: part.quantity,
      unit_price: part.unitPrice,
      unit_cost: part.unitCost ?? null,
      discount_amount: part.discountAmount,
      tax_rate: part.taxRate ?? null,
    })),
    p_additional_charges: intent.additionalCharges,
    p_deductions: intent.deductions,
    p_discount_amount: intent.discountAmount,
    p_override_reason: intent.overrideReason?.trim() || null,
    p_idempotency_key: intent.idempotencyKey,
  })

  if (error) throw mapRpcError(error.message)
  if (!data || typeof data !== 'object') throw mapRpcError()
  return data as RepairCostRpcResult
}
