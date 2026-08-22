import { describe, expect, it, vi } from 'vitest'
import { closeUnrepairedRepair, UnrepairedCloseoutRpcError } from './unrepaired-closeout-rpc'

describe('unrepaired closeout RPC adapter', () => {
  it('sends only intent and server-resolved scope to the atomic RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { repair_id: 'repair-1', closeout_id: 'closeout-1', idempotent: false },
      error: null,
    })
    const request = {
      outcome: 'withdrawn' as const,
      charge: { mode: 'none' as const },
      parts: [{ repairPartId: '6d8238d2-fdc5-4939-85d7-130a823982b0', disposition: 'restocked' as const }],
      settlement: { kind: 'store_credit' as const },
      note: 'Retira el titular',
      idempotencyKey: 'repair-closeout-123',
    }

    await closeUnrepairedRepair({ rpc }, {
      repairId: 'repair-1', organizationId: 'org-1', branchId: 'branch-1', actorId: 'user-1',
      request, cashSessionId: null,
    })

    expect(rpc).toHaveBeenCalledWith('close_unrepaired_repair', {
      p_repair_id: 'repair-1', p_organization_id: 'org-1', p_branch_id: 'branch-1', p_actor_id: 'user-1',
      p_outcome: 'withdrawn', p_charge: { mode: 'none' }, p_parts: request.parts,
      p_settlement: { kind: 'store_credit' }, p_reason: null, p_note: 'Retira el titular',
      p_cash_session_id: null, p_idempotency_key: 'repair-closeout-123',
    })
  })

  it('maps a closed register to a stable recoverable error', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'REPAIR_CASH_REGISTER_NOT_OPEN' } })

    await expect(closeUnrepairedRepair({ rpc }, {
      repairId: 'repair-1', organizationId: 'org-1', branchId: 'branch-1', actorId: 'user-1',
      cashSessionId: null,
      request: {
        outcome: 'unrepairable', charge: { mode: 'none' }, parts: [],
        settlement: { kind: 'refund', method: 'cash' }, idempotencyKey: 'repair-closeout-456',
      },
    })).rejects.toMatchObject<Partial<UnrepairedCloseoutRpcError>>({
      code: 'REPAIR_CASH_REGISTER_NOT_OPEN', status: 409,
    })
  })
})
