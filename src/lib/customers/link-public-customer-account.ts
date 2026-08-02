import type { SupabaseClient } from '@supabase/supabase-js'

interface LinkPublicCustomerInput {
  organizationId: string
  profileId: string
  fullName: string
  email?: string | null
  phone?: string | null
  customerId?: string | null
}

interface LinkedPublicCustomer {
  customerId: string
  membershipRole: string
}

export async function linkPublicCustomerAccount(
  supabase: Pick<SupabaseClient, 'rpc'>,
  input: LinkPublicCustomerInput
): Promise<LinkedPublicCustomer> {
  const { data, error } = await supabase.rpc('link_public_customer_account', {
    p_organization_id: input.organizationId,
    p_profile_id: input.profileId,
    p_full_name: input.fullName,
    p_email: input.email || null,
    p_phone: input.phone || null,
    p_customer_id: input.customerId || null,
  })

  if (error) throw error

  const row = Array.isArray(data) ? data[0] : data
  const customerId = row?.customer_id

  if (typeof customerId !== 'string' || !customerId) {
    throw new Error('La vinculacion no devolvio un cliente valido.')
  }

  return {
    customerId,
    membershipRole: typeof row.membership_role === 'string' ? row.membership_role : 'customer',
  }
}
