import { describe, expect, it, vi } from 'vitest'
import { RepairCostRpcError, saveRepairCostRevision } from './save-cost-revision'

const scope = {
  repairId: 'repair-1',
  organizationId: 'org-1',
  branchId: 'branch-1',
  actorId: 'user-1',
}

const intent = {
  laborAmount: 110_000,
  parts: [{
    productId: 'product-1', name: 'Pantalla', partNumber: 'OLED-1', supplier: null,
    quantity: 1, unitPrice: 200_000, unitCost: 150_000, discountAmount: 0, taxRate: 10 as const,
    lineType: 'charged_part' as const,
  }],
  additionalCharges: 0,
  deductions: 0,
  discountAmount: 20_000,
  overrideReason: null,
  idempotencyKey: 'cost-edit-1',
}

describe('saveRepairCostRevision', () => {
  it('passes server scope and cost intent to the atomic RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { revisionId: 'revision-1', summary: { finalTotal: 290_000 }, parts: [] },
      error: null,
    })

    await saveRepairCostRevision({ rpc }, scope, intent)

    expect(rpc).toHaveBeenCalledWith('save_repair_cost_revision', {
      p_repair_id: 'repair-1', p_organization_id: 'org-1', p_branch_id: 'branch-1',
      p_actor_id: 'user-1', p_labor_amount: 110_000,
      p_parts: [expect.objectContaining({ product_id: 'product-1', part_name: 'Pantalla', line_type: 'charged_part' })],
      p_additional_charges: 0, p_deductions: 0, p_discount_amount: 20_000,
      p_override_reason: null, p_idempotency_key: 'cost-edit-1',
    })
  })

  it.each([
    ['REPAIR_DISCOUNT_LIMIT_EXCEEDED', 403],
    ['REPAIR_PART_BELOW_COST', 403],
    ['REPAIR_OVERRIDE_REASON_REQUIRED', 422],
    ['REPAIR_STOCK_CHANGED|product-1|2', 409],
    ['REPAIR_COST_IDEMPOTENCY_CONFLICT', 409],
  ])('maps %s to a stable domain error', async (message, status) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message } })

    await expect(saveRepairCostRevision({ rpc }, scope, intent))
      .rejects.toMatchObject<Partial<RepairCostRpcError>>({ status })
  })
})
