import { describe, expect, it, vi } from 'vitest'
import {
  RepairPartsStockError,
  deleteRepairWithInventory,
  replaceRepairPartsWithInventory,
} from './replace-parts'

const baseInput = {
  repairId: '00000000-0000-4000-8000-000000000001',
  organizationId: '00000000-0000-4000-8000-000000000002',
  branchId: '00000000-0000-4000-8000-000000000003',
  actorId: '00000000-0000-4000-8000-000000000004',
}

describe('repair parts inventory RPC adapter', () => {
  it('maps a concurrent stock change to a typed domain error', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'REPAIR_STOCK_CHANGED|product-id|3' },
    })

    await expect(replaceRepairPartsWithInventory({
      ...baseInput,
      supabase: { rpc },
      parts: [],
    })).rejects.toMatchObject<Partial<RepairPartsStockError>>({
      name: 'RepairPartsStockError',
      availableStock: 3,
    })
  })

  it('uses the transactional delete RPC with tenant and branch scope', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })

    await expect(deleteRepairWithInventory({
      ...baseInput,
      supabase: { rpc },
    })).resolves.toBe(true)

    expect(rpc).toHaveBeenCalledWith('delete_repair_with_inventory', {
      p_repair_id: baseInput.repairId,
      p_organization_id: baseInput.organizationId,
      p_branch_id: baseInput.branchId,
      p_actor_id: baseInput.actorId,
    })
  })
})
