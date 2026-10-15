import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { computeTechnicianEarnings } from '@/lib/technician/earnings-server'
import { technicianPaymentError, validPaymentRequestKey } from '@/lib/technician/payments-server'
import { getTechnicianPeriod } from '@/lib/technician/period'
import { isNextResponse, resolveRepairModuleContext } from '@/app/api/repairs/_lib'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

const compensationSchema = z.object({
  base_salary: z.coerce.number().min(0).max(1_000_000_000),
  commission_rate: z.coerce.number().min(0).max(100),
  commission_base: z.enum(['labor', 'final']),
  fixed_per_repair: z.coerce.number().min(0).max(1_000_000_000),
  accrual_status: z.enum(['listo', 'entregado']),
  salary_effective_from: z.union([z.iso.date(), z.literal('')]).optional().nullable().transform((v) => v || null),
  effective_from: z.iso.date().optional(),
})

async function resolveContext(req: NextRequest) {
  const moduleContext = await resolveRepairModuleContext()
  if (isNextResponse(moduleContext)) return { response: moduleContext }
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return { response: authResponse as NextResponse }

  const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
  const organization = await getCurrentOrganizationContext(staffAuth.user.id)
  if (!organization) {
    return { response: NextResponse.json({ error: 'organization_required' }, { status: 403 }) }
  }
  const requestedOrganization = req.headers.get('x-organization-id')
  if (requestedOrganization && requestedOrganization !== organization.id) {
    return { response: NextResponse.json({ error: 'organization_changed' }, { status: 409 }) }
  }

  const requestedBranchId = getRequestedBranchId(req)
  const branchScope = await resolveBranchScopeForUser({
    userId: staffAuth.user.id,
    role: staffAuth.role,
    requestedBranchId,
    organizationId: organization.id,
    strict: Boolean(requestedBranchId),
  })

  return { staffAuth, organization, branchScope }
}

// GET: config del técnico + ganancia del período (default: mes actual)
export async function GET(req: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveContext(req)
    if ('response' in ctx) return ctx.response
    const { staffAuth, organization, branchScope } = ctx
    const { id: technicianId } = await context.params

    // Compensación = dato sensible: solo admin/super_admin lo consultan.
    if (staffAuth.role !== 'admin' && staffAuth.role !== 'super_admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const supabase = createAdminSupabase()

    // Verificar que el técnico pertenece a la organización.
    const { data: member } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', organization.id)
      .eq('user_id', technicianId)
      .eq('status', 'active')
      .maybeSingle()

    if (!member) {
      return NextResponse.json({ error: 'technician_not_found' }, { status: 404 })
    }

    // Período: query ?from&to (ISO) o mes actual por defecto.
    const url = new URL(req.url)
    const { from, to } = await getTechnicianPeriod(supabase, organization.id, url)

    // El prorrateo del sueldo base (según "vigente desde") se aplica dentro del helper.
    const { compensation, earnings } = await computeTechnicianEarnings(
      supabase, organization.id, technicianId, branchScope.branchId, from, to,
    )

    return NextResponse.json({ compensation, earnings, period: { from, to } })
  } catch (error: unknown) {
    return technicianPaymentError(error)
  }
}

// PUT: conditions and both Finance components are committed together.
export async function PUT(req: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveContext(req)
    if ('response' in ctx) return ctx.response
    const { staffAuth, organization } = ctx
    const { id: technicianId } = await context.params
    if (staffAuth.role !== 'admin' && staffAuth.role !== 'super_admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    const input = compensationSchema.safeParse(await req.json().catch(() => null))
    const key = req.headers.get('x-idempotency-key')
    if (!input.success || !validPaymentRequestKey(key) || !z.uuid().safeParse(technicianId).success) {
      return NextResponse.json({ error: 'invalid_request', message: 'Revisá las condiciones y la fecha de vigencia.' }, { status: 400 })
    }
    const { data, error } = await createAdminSupabase().rpc('server_save_technician_compensation', {
      p_organization_id: organization.id, p_actor_user_id: staffAuth.user.id,
      p_technician_id: technicianId, p_request_key: key, p_input: input.data,
    })
    if (error) throw error
    return NextResponse.json(data)
  } catch (error) { return technicianPaymentError(error) }
}
