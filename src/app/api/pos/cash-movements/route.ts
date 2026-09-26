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
      let movementData: unknown = null

      const { data, error } = await supabase.rpc('record_cash_movement_atomic', {
        p_organization_id: organization.id,
        p_branch_id: branch.branchId,
        p_session_id: sessionId,
        p_type: type,
        p_amount: amount,
        p_reason: reason,
      })

      if (!error && data) {
        movementData = data
      } else if (error) {
        const sessionClosed = error.message.includes('OPEN_CASH_SESSION_NOT_FOUND')
        if (sessionClosed) {
          return NextResponse.json({ success: false, error: 'La caja ya no está abierta.' }, { status: 409 })
        }

        // Si el error es de casteo de enum 'cash_movement_type' o la función RPC no existe
        const spanishType = type === 'cash_in' ? 'ingreso' : 'egreso'
        
        let insertRes = await supabase
          .from('cash_movements')
          .insert({
            session_id: sessionId,
            type: type,
            amount: amount,
            reason: reason,
            created_by: user.id,
            created_at: new Date().toISOString(),
            organization_id: organization.id,
            branch_id: branch.branchId
          })
          .select('*')
          .single()

        if (insertRes.error && (insertRes.error.message.includes('cash_movement_type') || insertRes.error.message.includes('invalid input value for enum'))) {
          insertRes = await supabase
            .from('cash_movements')
            .insert({
              session_id: sessionId,
              type: spanishType,
              amount: amount,
              reason: reason,
              created_by: user.id,
              created_at: new Date().toISOString(),
              organization_id: organization.id,
              branch_id: branch.branchId
            })
            .select('*')
            .single()
        }

        if (insertRes.error) {
          console.error('Error inserting cash movement:', insertRes.error)
          return NextResponse.json(
            { success: false, error: insertRes.error.message || error.message },
            { status: 400 }
          )
        }

        // Actualizar actividad de la sesión
        await supabase
          .from('cash_closures')
          .update({ last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq('id', sessionId)
          .eq('organization_id', organization.id)

        movementData = insertRes.data
      }

      return NextResponse.json({ success: true, data: movementData })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo registrar el movimiento.'
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }
  }
)
