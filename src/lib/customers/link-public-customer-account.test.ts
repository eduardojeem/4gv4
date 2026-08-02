import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { linkPublicCustomerAccount } from './link-public-customer-account'

const input = {
  organizationId: '11111111-1111-4111-8111-111111111111',
  profileId: '22222222-2222-4222-8222-222222222222',
  fullName: 'Cliente Publico',
  email: 'cliente@example.com',
  phone: '0981000000',
}

describe('linkPublicCustomerAccount', () => {
  it('returns the linked customer produced by the atomic RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ customer_id: '33333333-3333-4333-8333-333333333333', membership_role: 'customer' }],
      error: null,
    })

    await expect(linkPublicCustomerAccount({ rpc } as unknown as Pick<SupabaseClient, 'rpc'>, input)).resolves.toEqual({
      customerId: '33333333-3333-4333-8333-333333333333',
      membershipRole: 'customer',
    })
    expect(rpc).toHaveBeenCalledWith('link_public_customer_account', expect.objectContaining({
      p_organization_id: input.organizationId,
      p_profile_id: input.profileId,
      p_customer_id: null,
    }))
  })

  it('propagates database errors instead of accepting a partial link', async () => {
    const databaseError = new Error('membership insert failed')
    const rpc = vi.fn().mockResolvedValue({ data: null, error: databaseError })

    await expect(linkPublicCustomerAccount({ rpc } as unknown as Pick<SupabaseClient, 'rpc'>, input)).rejects.toBe(databaseError)
  })

  it('rejects an empty RPC result', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null })

    await expect(linkPublicCustomerAccount({ rpc } as unknown as Pick<SupabaseClient, 'rpc'>, input)).rejects.toThrow(
      'La vinculacion no devolvio un cliente valido.'
    )
  })
})
