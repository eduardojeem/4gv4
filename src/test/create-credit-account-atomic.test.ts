import { describe, expect, it, vi } from 'vitest'
import { createCreditAccount, CreditAccountError } from '@/lib/credits/create-credit-account'
import type { CreateCreditAccountInput } from '@/lib/credits/create-credit-account'

const actor = 'cf010000-0000-4000-8000-000000000001'
function input(rpc: ReturnType<typeof vi.fn>): CreateCreditAccountInput {
  return {
    supabase: { rpc, from: vi.fn(() => { throw new Error('Non-atomic table access must not be used') }) } as unknown as CreateCreditAccountInput['supabase'],
    organizationId: 'cf110000-0000-4000-8000-000000000001',
    customerId: 'cf210000-0000-4000-8000-000000000001',
    actorId: actor,
    creditLimit: 1, // Stale UI/caller limit is NOT financial authority.
    amount: 100, interestRate: 10, installmentCount: 2, frequency: 'monthly',
    label: 'Fixture', creditType: 'manual', originType: 'manual',
  }
}

describe('atomic customer credit creation', () => {
  it('sends the validated plan and actor to one transaction, ignoring caller limit', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { creditId: 'created', financedTotal: 110, interestAmount: 10, installmentCount: 2 }, error: null })
    expect(await createCreditAccount(input(rpc))).toEqual({ creditId: 'created', financedTotal: 110, interestAmount: 10, installmentCount: 2 })
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc).toHaveBeenCalledWith('create_customer_credit_account_atomic', expect.objectContaining({
      p_actor_id: actor,
      p_header: expect.objectContaining({ principal: 110, term_months: 2 }),
      p_installments: expect.arrayContaining([expect.objectContaining({ installment_number: 1, amount: 55 })]),
    }))
    expect(rpc.mock.calls[0][1]).not.toHaveProperty('creditLimit')
  })

  it.each([
    ['CREDIT_LIMIT_EXCEEDED', 400], ['CREDIT_FILE_REQUIRED', 409], ['CREDIT_FILE_FORBIDDEN', 403],
  ])('maps %s to an actionable HTTP error', async (message, status) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: '23514', message } })
    await expect(createCreditAccount(input(rpc))).rejects.toMatchObject({ name: 'CreditAccountError', status })
  })

  it('does not silently fallback to separate inserts if the migration is absent', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'RPC missing' } })
    await expect(createCreditAccount(input(rpc))).rejects.toMatchObject({ status: 503 })
  })

  it('requires a valid actor before calling the privileged transaction', async () => {
    const rpc = vi.fn()
    await expect(createCreditAccount({ ...input(rpc), actorId: '' })).rejects.toBeInstanceOf(CreditAccountError)
    expect(rpc).not.toHaveBeenCalled()
  })
})
