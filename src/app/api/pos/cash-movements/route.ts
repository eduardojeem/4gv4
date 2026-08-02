import { NextResponse, type NextRequest } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'
import { createClient } from '@/lib/supabase/server'

type MovementBody = {
  sessionId?: unknown
  type?: unknown
  amount?: unknown
  reason?: unknown
  branchId?: unknown
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const POST = withTenantAuth(
  { permission: 'pos.cash.manage', module: 'pos' },
  async (request: NextRequest, { organization, user }) => {
    let body: MovementBody
    try {
      body = await request.json() as MovementBody
    } catch {
      return NextResponse.json({ success: false, error: 'La solicitud no es valida.' }, { status: 400 })
    }

    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
    const type = body.type === 'cash_in' || body.type === 'cash_out' ? body.type : null
    const amount = Number(body.amount)
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''

    if (!UUID_PATTERN.test(sessionId) || !type) {
      return NextResponse.json({ success: false, error: 'La sesion o el tipo de movimiento no es valido.' }, { status: 400 })
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: 'El monto debe ser mayor que cero.' }, { status: 400 })
    }
    if (!reason) {
      return NextResponse.json({ success: false, error: 'Indica el motivo del movimiento.' }, { status: 400 })
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
        return NextResponse.json({ success: false, error: 'Selecciona una sucursal.' }, { status: 400 })
      }

      const supabase = await createClient()
      const { data, error } = await supabase.rpc('record_cash_movement_atomic', {
        p_organization_id: organization.id,
        p_branch_id: branch.branchId,
        p_session_id: sessionId,
        p_type: type,
        p_amount: amount,
        p_reason: reason,
      })

      if (error) {
        const sessionClosed = error.message.includes('OPEN_CASH_SESSION_NOT_FOUND')
        return NextResponse.json(
          { success: false, error: sessionClosed ? 'La caja ya no esta abierta.' : error.message },
          { status: sessionClosed ? 409 : 400 }
        )
      }

      return NextResponse.json({ success: true, data })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo registrar el movimiento.'
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }
  }
)
