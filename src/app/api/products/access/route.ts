import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { resolveOrganizationProductCostAccess } from '@/lib/products/cost-access'

export const GET = withTenantAuth({ permission: 'products.read', module: 'inventory' }, async (_request, { user, organization }) => {
  const access = await resolveOrganizationProductCostAccess(createAdminSupabase(), { userId: user.id, organizationId: organization.id })
  return NextResponse.json({
    organizationId: organization.id,
    canReadCost: access.canReadCost,
    canUpdateCost: access.canWriteCost,
  }, { headers: { 'Cache-Control': 'no-store' } })
})
