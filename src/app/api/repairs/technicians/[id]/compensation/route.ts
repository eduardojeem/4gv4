import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { computeTechnicianEarnings } from '@/lib/technician/earnings-server'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

const compensationSchema = z.object({
  base_salary: z.coerce.number().min(0).max(1_000_000_000),
  commission_rate: z.coerce.number().min(0).max(100),
  commission_base: z.enum(['labor', 'final']),
  fixed_per_repair: z.coerce.number().min(0).max(1_000_000_000),
  accrual_status: z.enum(['listo', 'entregado']),
  salary_effective_from: z.string().optional().nullable().transform((v) => v || null),
})

async function resolveContext(req: NextRequest) {
  const auth = await requireStaff()
  const authResponse = getAuthResponse(auth)
  if (authResponse) return { response: authResponse as NextResponse }

  const staffAuth = auth as Extract<AuthResult, { authenticated: true }>
  const organization = await getCurrentOrganizationContext(staffAuth.user.id)
  if (!organization) {
    return { response: NextResponse.json({ error: 'organization_required' }, { status: 403 }) }
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
    const now = new Date()
    const from = url.searchParams.get('from') || new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const to = url.searchParams.get('to') || now.toISOString()

    // El prorrateo del sueldo base (según "vigente desde") se aplica dentro del helper.
    const { compensation, earnings } = await computeTechnicianEarnings(
      supabase, organization.id, technicianId, branchScope.branchId, from, to,
    )

    return NextResponse.json({ compensation, earnings, period: { from, to } })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener la compensación'
    console.error('[technician-compensation GET]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// PUT: guardar la config de compensación (solo admin/super_admin)
export async function PUT(req: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveContext(req)
    if ('response' in ctx) return ctx.response
    const { staffAuth, organization } = ctx
    const { id: technicianId } = await context.params

    if (staffAuth.role !== 'admin' && staffAuth.role !== 'super_admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = compensationSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'validation_failed', details: parsed.error.issues },
        { status: 400 },
      )
    }

    const supabase = createAdminSupabase()

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

    const { data, error } = await supabase
      .from('technician_compensation')
      .upsert(
        {
          organization_id: organization.id,
          technician_id: technicianId,
          ...parsed.data,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,technician_id' },
      )
      .select('base_salary, commission_rate, commission_base, fixed_per_repair, accrual_status, salary_effective_from')
      .single()

    if (error) throw error

    return NextResponse.json({ compensation: data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al guardar la compensación'
    console.error('[technician-compensation PUT]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
