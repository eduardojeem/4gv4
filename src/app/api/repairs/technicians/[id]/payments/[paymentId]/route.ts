import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { isNextResponse, resolveRepairModuleContext } from '@/app/api/repairs/_lib'
import { technicianPaymentError, validPaymentRequestKey } from '@/lib/technician/payments-server'

export const dynamic = 'force-dynamic'
type RouteParams = { params: Promise<{ id: string; paymentId: string }> }
const schema = z.object({ action: z.enum(['confirmar', 'confirmar_recibo', 'anular']) })

export async function PATCH(req: NextRequest, context: RouteParams) {
  try {
    const moduleContext = await resolveRepairModuleContext()
    if (isNextResponse(moduleContext)) return moduleContext
    const auth = await requireStaff()
    const authResponse = getAuthResponse(auth)
    if (authResponse) return authResponse
    const staff = auth as Extract<AuthResult, { authenticated: true }>
    const organization = await getCurrentOrganizationContext(staff.user.id)
    if (!organization) return NextResponse.json({ error: 'organization_required' }, { status: 403 })
    const requestedOrganization = req.headers.get('x-organization-id')
    if (requestedOrganization && requestedOrganization !== organization.id) return NextResponse.json({ error: 'organization_changed' }, { status: 409 })
    const { id, paymentId } = await context.params
    const input = schema.safeParse(await req.json().catch(() => null))
    const key = req.headers.get('x-idempotency-key')
    if (!input.success || !validPaymentRequestKey(key) || !z.uuid().safeParse(id).success || !z.uuid().safeParse(paymentId).success) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
    }
    const requestedBranchId = getRequestedBranchId(req)
    const branch = await resolveBranchScopeForUser({ userId: staff.user.id, role: staff.role,
      organizationId: organization.id, requestedBranchId, strict: Boolean(requestedBranchId) })
    if (!branch.branchId) return NextResponse.json({ error: 'branch_required' }, { status: 400 })
    const { data, error } = await createAdminSupabase().rpc('server_transition_technician_payment', {
      p_organization_id: organization.id, p_branch_id: branch.branchId, p_actor_user_id: staff.user.id,
      p_technician_id: id, p_payment_id: paymentId, p_request_key: key, p_action: input.data.action,
    })
    if (error) throw error
    return NextResponse.json({ payment: data })
  } catch (error) { return technicianPaymentError(error) }
}
