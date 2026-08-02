import { NextResponse, type NextRequest } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeSearchTerm } from '@/lib/api/sanitize-search'

type ReconciliationBody = {
  paymentId?: unknown
  status?: unknown
  feeAmount?: unknown
  provider?: unknown
  institution?: unknown
  channel?: unknown
  terminalId?: unknown
  notes?: unknown
  settledAt?: unknown
  branchId?: unknown
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const STATUSES = new Set(['pending', 'confirmed', 'rejected', 'refunded', 'disputed'])
const CHANNELS = new Set(['card_terminal', 'bank_transfer', 'qr', 'other'])

async function resolvePaymentBranch(
  request: NextRequest,
  user: { id: string; role?: string },
  organizationId: string,
  bodyBranchId?: unknown
) {
  return resolveBranchScopeForUser({
    userId: user.id,
    role: user.role as Parameters<typeof resolveBranchScopeForUser>[0]['role'],
    requestedBranchId: getRequestedBranchId(request, bodyBranchId),
    organizationId,
    strict: true,
  })
}

export const GET = withTenantAuth(
  { permission: 'pos.cash.manage', module: 'pos' },
  async (request: NextRequest, { organization, user }) => {
    try {
      const branch = await resolvePaymentBranch(request, user, organization.id)
      if (!branch.branchId) {
        return NextResponse.json({ success: false, error: 'Selecciona una sucursal.' }, { status: 400 })
      }

      const status = request.nextUrl.searchParams.get('status')
      const method = request.nextUrl.searchParams.get('method')
      const search = sanitizeSearchTerm(request.nextUrl.searchParams.get('q'), 80)
      const supabase = await createClient()
      let query = supabase
        .from('sale_payments')
        .select(`
          id, sale_id, payment_method, amount, reference, card_last4,
          channel, provider, institution, terminal_id, reconciliation_status,
          fee_amount, net_amount, settled_at, reconciled_at, reconciliation_notes,
          created_at, sales!inner(code, branch_id, created_at)
        `)
        .eq('organization_id', organization.id)
        .eq('branch_id', branch.branchId)
        .in('payment_method', ['card', 'transfer'])
        .order('created_at', { ascending: false })
        .limit(200)

      if (status && STATUSES.has(status)) query = query.eq('reconciliation_status', status)
      if (method === 'card' || method === 'transfer') query = query.eq('payment_method', method)
      if (search) {
        query = query.or(`reference.ilike.%${search}%,provider.ilike.%${search}%,institution.ilike.%${search}%`)
      }

      const { data, error } = await query
      if (error) {
        return NextResponse.json({ success: false, error: 'No se pudieron cargar los cobros electronicos.' }, { status: 500 })
      }

      return NextResponse.json({ success: true, data: data || [] })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar los cobros electronicos.'
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }
  }
)

export const PATCH = withTenantAuth(
  { permission: 'pos.cash.manage', module: 'pos' },
  async (request: NextRequest, { organization, user }) => {
    let body: ReconciliationBody
    try {
      body = await request.json() as ReconciliationBody
    } catch {
      return NextResponse.json({ success: false, error: 'La solicitud no es valida.' }, { status: 400 })
    }

    const paymentId = typeof body.paymentId === 'string' ? body.paymentId.trim() : ''
    const status = typeof body.status === 'string' && STATUSES.has(body.status) ? body.status : null
    const feeAmount = Number(body.feeAmount ?? 0)
    const channel = typeof body.channel === 'string' && CHANNELS.has(body.channel) ? body.channel : null
    const settledAt = typeof body.settledAt === 'string' && !Number.isNaN(Date.parse(body.settledAt))
      ? body.settledAt
      : null

    if (!UUID_PATTERN.test(paymentId) || !status) {
      return NextResponse.json({ success: false, error: 'El pago o estado no es valido.' }, { status: 400 })
    }
    if (!Number.isFinite(feeAmount) || feeAmount < 0) {
      return NextResponse.json({ success: false, error: 'La comision no es valida.' }, { status: 400 })
    }

    try {
      const branch = await resolvePaymentBranch(request, user, organization.id, body.branchId)
      if (!branch.branchId) {
        return NextResponse.json({ success: false, error: 'Selecciona una sucursal.' }, { status: 400 })
      }

      const supabase = await createClient()
      const { data, error } = await supabase.rpc('reconcile_sale_payment_atomic', {
        p_organization_id: organization.id,
        p_branch_id: branch.branchId,
        p_payment_id: paymentId,
        p_status: status,
        p_fee_amount: feeAmount,
        p_provider: typeof body.provider === 'string' ? body.provider : null,
        p_institution: typeof body.institution === 'string' ? body.institution : null,
        p_channel: channel,
        p_terminal_id: typeof body.terminalId === 'string' ? body.terminalId : null,
        p_notes: typeof body.notes === 'string' ? body.notes : null,
        p_settled_at: settledAt,
      })

      if (error) {
        const missing = error.message.includes('ELECTRONIC_PAYMENT_NOT_FOUND')
        return NextResponse.json(
          { success: false, error: missing ? 'El cobro no pertenece a esta sucursal.' : error.message },
          { status: missing ? 404 : 400 }
        )
      }

      return NextResponse.json({ success: true, data })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el cobro.'
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }
  }
)
