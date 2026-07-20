import { NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { getAuthResponse, requireStaff, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'

export const FULL_REPAIR_SELECT = `
  *,
  customer:customers(id, customer_code, name, first_name, last_name, phone, email),
  technician:profiles(id, full_name),
  images:repair_images(id, image_url, description),
  parts:repair_parts(*),
  notes:repair_notes(*)
`

export type RepairRouteContext = {
  supabase: ReturnType<typeof createAdminSupabase>
  userId: string
  role: string
  organizationId: string
  branchId: string
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

export async function resolveRepairRouteContext(request: Request): Promise<RepairRouteContext | NextResponse> {
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return authResponse

  const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
  const organization = await getCurrentOrganizationContext(staffAuth.user.id)

  if (!organization) {
    return organizationRequiredResponse()
  }

  const requestedBranchId = getRequestedBranchId(request)
  const branchScope = await resolveBranchScopeForUser({
    userId: staffAuth.user.id,
    role: staffAuth.role,
    requestedBranchId,
    organizationId: organization.id,
    strict: Boolean(requestedBranchId),
  })

  if (!branchScope.branchId) {
    return NextResponse.json(
      { error: 'No hay una sucursal operativa disponible para esta reparacion.' },
      { status: 400 }
    )
  }

  return {
    supabase: createAdminSupabase(),
    userId: staffAuth.user.id,
    role: staffAuth.role,
    organizationId: organization.id,
    branchId: branchScope.branchId,
  }
}

export function isNextResponse(value: RepairRouteContext | NextResponse): value is NextResponse {
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

