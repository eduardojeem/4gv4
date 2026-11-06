// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => vi.fn())
vi.mock('../../mobile/src/lib/api', () => ({ apiFetch: api }))
vi.mock('../../mobile/src/lib/customers', () => ({ fetchCustomerDebts: vi.fn() }))
import { fetchCreditPolicy, OPEN_POLICY } from '../../mobile/src/lib/pos-credit'
beforeEach(() => { api.mockReset() })
describe('mobile credit policy catalog', () => {
  it('retains configured global plans from the server', async () => {
    api.mockResolvedValue({ data: { policy: OPEN_POLICY.policy, canOverride: false, defaultPlans: [{ count: 6, rate: 10, frequency: 'weekly' }] } })
    expect(await fetchCreditPolicy()).toMatchObject({ defaultPlans: [{ count: 6, rate: 10, frequency: 'weekly' }] })
  })
  it('reports failures instead of silently enabling every term', async () => {
    api.mockRejectedValue(new Error('offline'))
    await expect(fetchCreditPolicy()).rejects.toThrow()
  })
})

it('keeps the configured fixed amount in the native catalog', async () => {
 const fixed={count:6,rate:0,frequency:'monthly',mode:'amount',installmentAmount:200000}
 api.mockResolvedValue({data:{policy:OPEN_POLICY.policy,defaultPlans:[fixed]}})
 expect((await fetchCreditPolicy()).defaultPlans).toEqual([fixed])
})
