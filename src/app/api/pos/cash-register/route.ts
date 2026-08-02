import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createClient } from '@/lib/supabase/server'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'

type CashRegisterBody = {
  registerId?: unknown
  sessionId?: unknown
  openingBalance?: unknown
  closingBalance?: unknown
  note?: unknown
  branchId?: unknown
}

async function resolveCashBranch(
  request: Request,
  body: CashRegisterBody,
  user: { id: string; role?: string },
  organizationId: string
) {
  return resolveBranchScopeForUser({
    userId: user.id,
    role: user.role as Parameters<typeof resolveBranchScopeForUser>[0]['role'],
    requestedBranchId: getRequestedBranchId(request, body.branchId),
    organizationId,
    strict: true,
  })
}

export const POST = withTenantAuth(
  { permission: 'pos.cash.manage', module: 'pos' },
  async (request, { organization, user }) => {
    const body = await request.json() as CashRegisterBody
    const registerId = typeof body.registerId === 'string' ? body.registerId.trim() : ''
    const openingBalance = Number(body.openingBalance)
    const note = typeof body.note === 'string' ? body.note.trim() : null

    if (!registerId) {
      return NextResponse.json({ success: false, error: 'La caja es obligatoria.' }, { status: 400 })
    }
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      return NextResponse.json({ success: false, error: 'El saldo inicial no es valido.' }, { status: 400 })
    }

    try {
      const branch = await resolveCashBranch(request, body, user, organization.id)
      if (!branch.branchId) {
        return NextResponse.json({ success: false, error: 'Selecciona una sucursal para abrir la caja.' }, { status: 400 })
      }

      const supabase = await createClient()
      const { data, error } = await supabase.rpc('open_cash_register_atomic', {
        p_organization_id: organization.id,
        p_branch_id: branch.branchId,
        p_register_id: registerId,
        p_opening_balance: openingBalance,
        p_note: note,
      })

      if (error) {
        const alreadyOpen = error.message.includes('already open')
        const invalidRegister = error.message.includes('REGISTER_NOT_IN_BRANCH')
        const incompatibleSchema = error.code === '42703' && error.message.includes('is_active')
        const message = incompatibleSchema
          ? 'La configuración de cajas está desactualizada. Aplica la migración pendiente y vuelve a intentar.'
          : invalidRegister
            ? 'La caja seleccionada no pertenece a esta sucursal.'
            : error.message
        return NextResponse.json(
          { success: false, error: message, code: error.code },
          { status: incompatibleSchema ? 503 : alreadyOpen ? 409 : 400 }
        )
      }

      return NextResponse.json({ success: true, data })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo abrir la caja.'
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }
  }
)

export const PATCH = withTenantAuth(
  { permission: 'pos.cash.manage', module: 'pos' },
  async (request, { organization, user }) => {
    const body = await request.json() as CashRegisterBody
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
    const closingBalance = Number(body.closingBalance)

    if (!sessionId) {
      return NextResponse.json({ success: false, error: 'La sesion de caja es obligatoria.' }, { status: 400 })
    }
    if (!Number.isFinite(closingBalance) || closingBalance < 0) {
      return NextResponse.json({ success: false, error: 'El saldo contado no es valido.' }, { status: 400 })
    }

    try {
      const branch = await resolveCashBranch(request, body, user, organization.id)
      if (!branch.branchId) {
        return NextResponse.json({ success: false, error: 'Selecciona una sucursal para cerrar la caja.' }, { status: 400 })
      }

      const supabase = await createClient()
      const { data, error } = await supabase.rpc('close_cash_register_atomic', {
        p_organization_id: organization.id,
        p_branch_id: branch.branchId,
        p_session_id: sessionId,
        p_closing_balance: closingBalance,
      })

      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 })
      }

      return NextResponse.json({ success: true, data })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cerrar la caja.'
      return NextResponse.json({ success: false, error: message }, { status: 400 })
    }
  }
)
