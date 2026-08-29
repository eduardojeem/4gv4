import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { getAuthResponse, requireStaff, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { roleHasPermission, type OrganizationRole, type Permission } from '@/lib/saas/permissions'
import { getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import type { AppRole } from '@/lib/auth/role-utils'

export const FULL_REPAIR_SELECT = `
  *,
  customer:customers!customer_id(id, customer_code, name, first_name, last_name, phone, email, customer_type),
  technician:profiles!technician_id(id, full_name),
  images:repair_images(id, image_url, description),
  parts:repair_parts(*),
  notes:repair_notes(*),
  payments:repair_payments(*),
  closeout:repair_closeouts(*),
  currentCostRevision:repair_cost_revisions!repairs_current_cost_revision_fk(*)
`

export type RepairRouteContext = {
  supabase: ReturnType<typeof createAdminSupabase>
  userId: string
  role: AppRole
  organizationRole: OrganizationRole
  organizationId: string
  branchId: string
}

export type RepairModuleContext = {
  userId: string
  role: AppRole
  organizationId: string
  organizationRole: OrganizationRole
}

export function organizationRequiredResponse() {
  return NextResponse.json(
    {
      error: 'No se pudo resolver la organizacion activa para operar con reparaciones.',
      code: 'ACTIVE_ORGANIZATION_REQUIRED',
    },
    { status: 403 }
  )
}

export async function resolveRepairModuleContext(): Promise<RepairModuleContext | NextResponse> {
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return authResponse

  const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
  const organization = await getCurrentOrganizationContext(staffAuth.user.id)
  if (!organization) return organizationRequiredResponse()

  const planInfo = await getOrganizationPlanInfo(organization.id)
  if (!planInfo.effectiveModules.includes('repairs')) {
    const commerciallyAvailable = planInfo.entitledModules.includes('repairs')
      || planInfo.moduleTrials.some(trial => trial.module === 'repairs')
    return NextResponse.json(
      {
        error: commerciallyAvailable
          ? 'El módulo de reparaciones está desactivado para esta organización.'
          : 'El módulo de reparaciones no está incluido en el plan actual.',
        code: commerciallyAvailable ? 'MODULE_DISABLED' : 'MODULE_NOT_ENTITLED',
      },
      { status: commerciallyAvailable ? 403 : 402 },
    )
  }

  return {
    userId: staffAuth.user.id,
    role: staffAuth.role,
    organizationId: organization.id,
    organizationRole: organization.role,
  }
}

export async function resolveRepairRouteContext(
  request: Request,
  permission: Permission = 'repairs.orders.read'
): Promise<RepairRouteContext | NextResponse> {
  const moduleContext = await resolveRepairModuleContext()
  if (isNextResponse(moduleContext)) return moduleContext

  if (!roleHasPermission(moduleContext.organizationRole, permission)) {
    return NextResponse.json(
      { error: 'No tenes permiso para realizar esta accion sobre reparaciones.' },
      { status: 403 }
    )
  }

  const requestedBranchId = getRequestedBranchId(request)
  let branchScope
  try {
    branchScope = await resolveBranchScopeForUser({
      userId: moduleContext.userId,
      role: moduleContext.role,
      requestedBranchId,
      organizationId: moduleContext.organizationId,
      strict: Boolean(requestedBranchId),
    })
  } catch {
    return NextResponse.json(
      { error: 'No tenes acceso a la sucursal seleccionada.' },
      { status: 403 }
    )
  }

  if (!branchScope.branchId) {
    return NextResponse.json(
      { error: 'No tenes una sucursal asignada para operar con reparaciones.' },
      { status: 403 }
    )
  }

  return {
    supabase: createAdminSupabase(),
    userId: moduleContext.userId,
    role: moduleContext.role,
    organizationRole: moduleContext.organizationRole,
    organizationId: moduleContext.organizationId,
    branchId: branchScope.branchId,
  }
}

export function isNextResponse(value: RepairRouteContext | RepairModuleContext | NextResponse): value is NextResponse {
  return value instanceof NextResponse
}

export async function fetchRepairById(ctx: RepairRouteContext, repairId: string) {
  return ctx.supabase
    .from('repairs')
    .select(FULL_REPAIR_SELECT)
    .eq('id', repairId)
    .eq('organization_id', ctx.organizationId)
    .eq('branch_id', ctx.branchId)
    .maybeSingle()
}

export async function assertRepairExists(ctx: RepairRouteContext, repairId: string) {
  const { data, error } = await ctx.supabase
    .from('repairs')
    .select('id')
    .eq('id', repairId)
    .eq('organization_id', ctx.organizationId)
    .eq('branch_id', ctx.branchId)
    .maybeSingle()

  if (error) throw error
  return Boolean(data)
}
