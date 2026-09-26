import type { CreateRepairInput } from './create-repair-input'

type RepairPartInput = CreateRepairInput['parts'][number]

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{
    data: unknown
    error: { message?: string; code?: string } | null
  }>
}

export class RepairPartsStockError extends Error {
  constructor(public readonly availableStock: number) {
    super(`El stock cambio mientras completabas la reparacion. Disponible: ${availableStock}.`)
    this.name = 'RepairPartsStockError'
  }
}

export async function replaceRepairPartsWithInventory(input: {
  supabase: unknown
  repairId: string
  organizationId: string
  branchId: string
  actorId: string
  parts: RepairPartInput[]
  pricing?: {
    laborCost: number
    finalCost: number
    estimatedCost: number
    mode: string
    discountAmount: number
    overrideReason: string | null
    updatedBy: string
  }
}) {
  const { data, error } = await (input.supabase as RpcClient).rpc(
    'replace_repair_parts_with_inventory',
    {
      p_repair_id: input.repairId,
      p_organization_id: input.organizationId,
      p_branch_id: input.branchId,
      p_parts: input.parts,
      p_actor_id: input.actorId,
      p_labor_cost: input.pricing?.laborCost,
      p_final_cost: input.pricing?.finalCost,
      p_estimated_cost: input.pricing?.estimatedCost,
      p_pricing_mode: input.pricing?.mode,
      p_discount_amount: input.pricing?.discountAmount,
      p_price_override_reason: input.pricing?.overrideReason,
      p_pricing_updated_by: input.pricing?.updatedBy,
    }
  )

  if (error) {
    const stockMatch = error.message?.match(/REPAIR_STOCK_CHANGED\|([^|]+)\|(\d+)/)
    if (stockMatch) {
      throw new RepairPartsStockError(Number(stockMatch[2]))
    }
    throw new Error(error.message || 'No se pudieron sincronizar los repuestos con el inventario.')
  }

  return Array.isArray(data) ? data[0] ?? null : data
}

export async function deleteRepairWithInventory(input: {
  supabase: unknown
  repairId: string
  organizationId: string
  branchId: string
  actorId: string
}) {
  const { data, error } = await (input.supabase as RpcClient).rpc(
    'delete_repair_with_inventory',
    {
      p_repair_id: input.repairId,
      p_organization_id: input.organizationId,
      p_branch_id: input.branchId,
      p_actor_id: input.actorId,
    }
  )

  if (error) throw new Error(error.message || 'No se pudo eliminar la reparacion.')
  return data === true
}
