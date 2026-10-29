import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, getAuthResponse } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { listAccessibleBranchesForUser, resolveBranchScopeForUser } from '@/lib/branches/server'
import { getRequestedBranchId } from '@/lib/branches/server'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import { mapOrganizationRoleToDashboardRole } from '@/lib/auth/section-access'
import { getDashboardPermissionsForOrganizationRole } from '@/lib/auth/organization-dashboard-permissions'
import { filterDashboardNavGroups } from '@/config/dashboard-navigation'
import { fetchDashboardHomeSummary, type HomeSummaryRpcClient } from '@/lib/dashboard/home-summary'
import { buildMobileDashboardSummary, mergeDashboardActivity } from '@/lib/mobile/dashboard-summary'
import { logger } from '@/lib/logger'

const ACTIVITY_WINDOW_HOURS = 72
const ACTIVITY_LIMIT_PER_SOURCE = 10

export async function GET(request: NextRequest) {
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return authResponse
  if (!auth.authenticated) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const organization = await getCurrentOrganizationContext(auth.user.id)
  if (!organization) return NextResponse.json({ error: 'Organización activa no disponible' }, { status: 403 })

  const requestedBranch = getRequestedBranchId(request)
  let branchId: string | null = null
  if (requestedBranch) {
    try {
      const scope = await resolveBranchScopeForUser({
        userId: auth.user.id,
        role: auth.role,
        requestedBranchId: requestedBranch,
        organizationId: organization.id,
        strict: true,
      })
      branchId = scope.branchId
    } catch {
      return NextResponse.json({ error: 'Sucursal no autorizada' }, { status: 403 })
    }
  }

  try {
    const plan = await getOrganizationPlanInfo(organization.id)
    const role = auth.role === 'super_admin' ? 'super_admin' : mapOrganizationRoleToDashboardRole(organization.role)
    const permissions = new Set(getDashboardPermissionsForOrganizationRole(organization.role))
    const groups = filterDashboardNavGroups({
      role,
      effectiveModules: plan.effectiveModules,
      hasPermission: (permission) => role === 'super_admin' || permissions.has(permission),
      businessVertical: plan.businessVertical,
    })
    const visibleSections = new Set(groups.flatMap((group) => group.items.map((item) => item.key)))

    // This RPC is SECURITY INVOKER: forward the mobile Bearer session through the
    // existing server client so the database enforces membership and branch access.
    const supabase = await createClient()
    const home = await fetchDashboardHomeSummary(supabase as unknown as HomeSummaryRpcClient, {
      userId: auth.user.id,
      organizationId: organization.id,
      branchId,
      role: organization.role,
      modules: plan.effectiveModules,
    })

    const dashboard = buildMobileDashboardSummary(home, visibleSections)
    const admin = createAdminSupabase()
    const recentSince = new Date(Date.now() - ACTIVITY_WINDOW_HOURS * 60 * 60 * 1000).toISOString()
    const canReadSales = visibleSections.has('pos')
    const canReadRepairs = visibleSections.has('repairs')
    const canReadCustomers = visibleSections.has('customers')
    const allowedBranches = branchId
      ? [branchId]
      : (await listAccessibleBranchesForUser({ userId: auth.user.id, role: auth.role, organizationId: organization.id })).map((branch) => branch.id)

    const filterActivityBranch = <T extends { eq: (column: string, value: string) => T; or: (filters: string) => T; is: (column: string, value: null) => T }>(query: T) => {
      if (branchId) return query.eq('branch_id', branchId)
      if (allowedBranches.length === 0) return query.is('branch_id', null)
      return query.or(`branch_id.is.null,branch_id.in.(${allowedBranches.join(',')})`)
    }

    const [salesResult, repairsResult, customersResult] = await Promise.all([
      canReadSales
        ? filterActivityBranch(admin.from('sales').select('id,total_amount,status,created_at').eq('organization_id', organization.id).gte('created_at', recentSince).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT_PER_SOURCE))
        : Promise.resolve({ data: [], error: null }),
      canReadRepairs
        ? filterActivityBranch(admin.from('repairs').select('id,status,created_at').eq('organization_id', organization.id).gte('created_at', recentSince).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT_PER_SOURCE))
        : Promise.resolve({ data: [], error: null }),
      canReadCustomers
        ? admin.from('customers').select('id,created_at').eq('organization_id', organization.id).gte('created_at', recentSince).order('created_at', { ascending: false }).limit(ACTIVITY_LIMIT_PER_SOURCE)
        : Promise.resolve({ data: [], error: null }),
    ])

    const activityError = salesResult.error || repairsResult.error || customersResult.error
    if (activityError) {
      logger.error('[dashboard-summary] No se pudo cargar actividad reciente', { code: activityError.code })
      return NextResponse.json({ error: 'No se pudo cargar el resumen', retryable: true }, { status: 503 })
    }

    const recentActivity = mergeDashboardActivity({
      sales: (salesResult.data ?? []) as Array<{ id: string; status: string | null; total_amount: number | null; created_at: string }>,
      repairs: (repairsResult.data ?? []) as Array<{ id: string; status: string | null; created_at: string }>,
      customers: (customersResult.data ?? []) as Array<{ id: string; created_at: string }>,
    })

    return NextResponse.json({
      organizationId: organization.id,
      branchId,
      ...dashboard,
      recentActivity,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo cargar el resumen'
    logger.error('[dashboard-summary] No se pudo calcular el resumen', { message })
    return NextResponse.json({ error: message, retryable: true }, { status: 503 })
  }
}
