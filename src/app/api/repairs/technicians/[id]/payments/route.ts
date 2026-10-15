import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { computeTechnicianEarnings } from '@/lib/technician/earnings-server'
import { sumDisbursedPayments } from '@/lib/technician/payment-summary'
import { technicianPaymentError, validPaymentRequestKey } from '@/lib/technician/payments-server'
import { getTechnicianPeriod } from '@/lib/technician/period'
import { isNextResponse, resolveRepairModuleContext } from '@/app/api/repairs/_lib'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

const createSchema = z.object({
  period_from: z.iso.date(),
  period_to: z.iso.date(),
  amount: z.coerce.number().positive().max(1_000_000_000),
  base_amount: z.coerce.number().min(0).default(0),
  commission_amount: z.coerce.number().min(0).default(0),
  fixed_amount: z.coerce.number().min(0).default(0),
  method: z.enum(['efectivo', 'transferencia', 'otro']).default('efectivo'),
  status: z.enum(['pendiente', 'pagado']).default('pagado'),
  notes: z.string().max(500).optional().nullable(),
}).refine(input => input.period_from <= input.period_to, { message: 'Período inválido' })

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

// GET: pagos del período + resumen { devengado, pagado, saldo }
export async function GET(req: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveContext(req)
    if ('response' in ctx) return ctx.response
    const { staffAuth, organization, branchScope } = ctx
    const { id: technicianId } = await context.params

    // Admin ve cualquiera; el técnico solo lo suyo.
    const isAdmin = staffAuth.role === 'admin' || staffAuth.role === 'super_admin'
    if (!isAdmin && technicianId !== staffAuth.user.id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const supabase = createAdminSupabase()
    const url = new URL(req.url)
    const { from, to, fromDate, toDate } = await getTechnicianPeriod(supabase, organization.id, url)

    const { earnings } = await computeTechnicianEarnings(
      supabase, organization.id, technicianId, branchScope.branchId, from, to,
    )

    let paymentsQuery = supabase
      .from('technician_payments')
      .select('*')
      .eq('organization_id', organization.id)
      .eq('technician_id', technicianId)
      .gte('period_from', fromDate)
      .lt('period_from', toDate)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
    if (branchScope.branchId) paymentsQuery = paymentsQuery.or(`branch_id.eq.${branchScope.branchId},branch_id.is.null`)
    type PaymentRow = { id: string; status: string; amount: number | string; branch_id: string | null }
    const payments: PaymentRow[] = []
    for (let offset = 0; ; offset += 200) {
      const { data, error } = await paymentsQuery.range(offset, offset + 199)
      if (error) throw error
      const page = (data as PaymentRow[] | null) ?? []
      payments.push(...page)
      if (page.length < 200) break
    }

    type PayrollBalance = { id: string; branch_id: string | null; legacy_source_id: string | null; net_amount: number | string; paid_amount: number | string }
    const payroll: PayrollBalance[] = []
    for (let offset = 0; ; offset += 200) {
      let query = supabase.from('payroll_entries')
        .select('id, branch_id, legacy_source_id, net_amount, paid_amount, payroll_runs!inner(period_from, period_to, status)')
        .eq('organization_id', organization.id).eq('employee_id', technicianId)
        .eq('payroll_runs.status', 'approved')
        .gte('payroll_runs.period_from', fromDate).lt('payroll_runs.period_from', toDate)
        .lt('payroll_runs.period_to', toDate).order('id', { ascending: true })
      if (branchScope.branchId) query = query.or(`branch_id.eq.${branchScope.branchId},branch_id.is.null`)
      const result = await query.range(offset, offset + 199)
      if (result.error) throw result.error
      const page = (result.data as unknown as PayrollBalance[] | null) ?? []
      payroll.push(...page)
      if (page.length < 200) break
    }
    const mapped = new Set(payroll.map(entry => entry.legacy_source_id).filter(Boolean))
    const branchPayroll = payroll.filter(entry => !branchScope.branchId || entry.branch_id === branchScope.branchId)
    const branchPayments = (payments ?? []).filter(payment => !mapped.has(payment.id)
      && (!branchScope.branchId || payment.branch_id === branchScope.branchId))
    const incomplete = Boolean(branchScope.branchId && ((payments ?? []).some(payment => !payment.branch_id && !mapped.has(payment.id))
      || payroll.some(entry => !entry.branch_id)))
    const pagado = sumDisbursedPayments(branchPayments) + branchPayroll.reduce((sum, entry) => sum + Number(entry.paid_amount), 0)
    const devengado = branchPayroll.length ? branchPayroll.reduce((sum, entry) => sum + Number(entry.net_amount), 0) : earnings.total

    return NextResponse.json({
      payments: payments ?? [],
      summary: {
        devengado: Math.round(devengado * 100) / 100,
        pagado: Math.round(pagado * 100) / 100,
        saldo: Math.round((devengado - pagado) * 100) / 100,
        basis: branchPayroll.length ? 'payroll' : 'estimate',
        complete: !incomplete,
      },
      earnings,
      period: { from, to },
    })
  } catch (error: unknown) {
    return technicianPaymentError(error)
  }
}

// POST: payment and cash movement are committed together by the database.
export async function POST(req: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveContext(req)
    if ('response' in ctx) return ctx.response
    const { staffAuth, organization, branchScope } = ctx
    const { id: technicianId } = await context.params
    if (staffAuth.role !== 'admin' && staffAuth.role !== 'super_admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }
    const parsed = createSchema.safeParse(await req.json().catch(() => null))
    const key = req.headers.get('x-idempotency-key')
    if (!parsed.success || !validPaymentRequestKey(key) || !z.uuid().safeParse(technicianId).success || !branchScope.branchId) {
      return NextResponse.json({ error: 'invalid_request', message: 'Revisá el período, seleccioná una sucursal y enviá una clave de solicitud válida.' }, { status: 400 })
    }
    const { data, error } = await createAdminSupabase().rpc('server_create_technician_payment', {
      p_organization_id: organization.id, p_branch_id: branchScope.branchId,
      p_actor_user_id: staffAuth.user.id, p_technician_id: technicianId,
      p_request_key: key, p_input: parsed.data,
    })
    if (error) throw error
    return NextResponse.json({ payment: data }, { status: 201 })
  } catch (error) { return technicianPaymentError(error) }
}
