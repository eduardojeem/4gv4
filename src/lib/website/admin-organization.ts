import type { AdminAuthContext } from '@/lib/api/withAdminAuth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { headers } from 'next/headers'

export async function resolveWebsiteAdminOrganizationId(context: AdminAuthContext) {
  if (context.organizationId) {
    return context.organizationId
  }

  const headerStore = await headers()
  const activeOrganizationId = headerStore.get('x-organization-id')
  if (activeOrganizationId) {
    const { data: organization } = await createAdminSupabase()
      .from('organizations')
      .select('id')
      .eq('id', activeOrganizationId)
      .maybeSingle()

    if (organization?.id) {
      return organization.id
    }
  }

  const organization = await getCurrentOrganizationContext(context.user.id)
  return organization?.id ?? null
}
