import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireStaff, getAuthResponse, type AuthResult } from '@/lib/auth/require-auth'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import { computeTechnicianEarnings } from '@/lib/technician/earnings-server'

export const dynamic = 'force-dynamic'

type RouteParams = { params: Promise<{ id: string }> }

const createSchema = z.object({
  period_from: z.string().min(8),
  period_to: z.string().min(8),
  amount: z.coerce.number().positive().max(1_000_000_000),
  base_amount: z.coerce.number().min(0).default(0),
  commission_amount: z.coerce.number().min(0).default(0),
  fixed_amount: z.coerce.number().min(0).default(0),
  method: z.enum(['efectivo', 'transferencia', 'otro']).default('efectivo'),
  status: z.enum(['pendiente', 'pagado']).default('pagado'),
  notes: z.string().max(500).optional().nullable(),
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
    const now = new Date()
    const from = url.searchParams.get('from') || new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const to = url.searchParams.get('to') || now.toISOString()
    const fromDate = from.slice(0, 10)
    const toDate = to.slice(0, 10)

    const { earnings } = await computeTechnicianEarnings(
      supabase, organization.id, technicianId, branchScope.branchId, from, to,
    )

    const { data: payments, error } = await supabase
      .from('technician_payments')
      .select('*')
      .eq('organization_id', organization.id)
      .eq('technician_id', technicianId)
      .gte('period_from', fromDate)
      .lte('period_from', toDate)
      .order('created_at', { ascending: false })

    if (error) throw error

    const pagado = (payments ?? [])
      .filter((p) => p.status !== 'anulado')
      .reduce((sum, p) => sum + Number(p.amount || 0), 0)

    return NextResponse.json({
      payments: payments ?? [],
      summary: {
        devengado: earnings.total,
        pagado: Math.round(pagado * 100) / 100,
        saldo: Math.round((earnings.total - pagado) * 100) / 100,
      },
      earnings,
      period: { from, to },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al obtener pagos'
    console.error('[technician-payments GET]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST: registrar un pago (+ egreso de caja best-effort si es efectivo)
export async function POST(req: NextRequest, context: RouteParams) {
  try {
    const ctx = await resolveContext(req)
    if ('response' in ctx) return ctx.response
    const { staffAuth, organization } = ctx
    const { id: technicianId } = await context.params

    // Registrar un pago: solo admin/super_admin.
    if (staffAuth.role !== 'admin' && staffAuth.role !== 'super_admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    const parsed = createSchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'validation_failed', details: parsed.error.issues }, { status: 400 })
    }
    const input = parsed.data

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

    // Egreso de caja (best-effort): solo si efectivo y ya pagado.
    let cashMovementId: string | null = null
    if (input.method === 'efectivo' && input.status === 'pagado') {
      try {
        const { data: openSessions } = await supabase
          .from('cash_closures')
          .select('id, register_id')
          .eq('organization_id', organization.id)
          .is('date', null)
          .order('created_at', { ascending: false })

        const targetSession =
          (openSessions ?? []).find((s) => s.register_id?.toLowerCase() === 'principal') ??
          (openSessions ?? [])[0]

        if (targetSession) {
          const { data: mv } = await supabase
            .from('cash_movements')
            .insert({
              organization_id: organization.id,
              session_id: targetSession.id,
              type: 'cash_out',
              amount: input.amount,
              reason: `Pago a técnico${input.notes ? ` - ${input.notes}` : ''}`,
              payment_method: input.method,
              created_by: staffAuth.user.id,
              created_at: new Date().toISOString(),
            })
            .select('id')
            .single()
          cashMovementId = mv?.id ?? null
        }
      } catch (cashError) {
        console.warn('[technician-payments] cash movement skipped:', cashError)
      }
    }

    const { data, error } = await supabase
      .from('technician_payments')
      .insert({
        organization_id: organization.id,
        technician_id: technicianId,
        period_from: input.period_from,
        period_to: input.period_to,
        amount: input.amount,
        base_amount: input.base_amount,
        commission_amount: input.commission_amount,
        fixed_amount: input.fixed_amount,
        method: input.method,
        status: input.status,
        notes: input.notes ?? null,
        paid_by: staffAuth.user.id,
        // Si nace 'pagado', el admin que lo registra es también quien lo aprueba.
        approved_by: input.status === 'pagado' ? staffAuth.user.id : null,
        approved_at: input.status === 'pagado' ? new Date().toISOString() : null,
        cash_movement_id: cashMovementId,
      })
      .select('*')
      .single()

    if (error) throw error

    return NextResponse.json({ payment: data }, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al registrar el pago'
    console.error('[technician-payments POST]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
