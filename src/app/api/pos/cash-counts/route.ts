import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'

type CashCountBody = {
  sessionId?: unknown
  total?: unknown
  bills?: unknown
  coins?: unknown
  branchId?: unknown
}

export const POST = withTenantAuth(
  { permission: 'pos.cash.manage', module: 'pos' },
  async (request, { organization, user }) => {
    const body = await request.json() as CashCountBody
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
    const total = Number(body.total)

    if (!sessionId || !Number.isFinite(total) || total < 0) {
      return NextResponse.json({ success: false, error: 'Los datos del arqueo no son validos.' }, { status: 400 })
    }

    try {
      const branch = await resolveBranchScopeForUser({
        userId: user.id,
        role: user.role as Parameters<typeof resolveBranchScopeForUser>[0]['role'],
        requestedBranchId: getRequestedBranchId(request, body.branchId),
        organizationId: organization.id,
        strict: true,
      })

      if (!branch.branchId) {
        return NextResponse.json({ success: false, error: 'Selecciona una sucursal para registrar el arqueo.' }, { status: 400 })
      }

      const supabase = await createClient()
      const { data, error } = await supabase.rpc('record_cash_count_atomic', {
        p_organization_id: organization.id,
        p_branch_id: branch.branchId,
        p_session_id: sessionId,
        p_counted_total: total,
        p_denominations: {
          bills: body.bills && typeof body.bills === 'object' ? body.bills : {},
          coins: body.coins && typeof body.coins === 'object' ? body.coins : {},
        },
      })

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 })
      }

      return NextResponse.json({ success: true, data })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo registrar el arqueo.'
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }
  }
)
