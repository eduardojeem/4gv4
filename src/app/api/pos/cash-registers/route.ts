import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { canCreateResource } from '@/lib/saas/subscription-service'
import { getRequestedBranchId, resolveBranchScopeForUser } from '@/lib/branches/server'

export const POST = withTenantAuth({ permission: 'pos.cash.manage', module: 'pos' }, async (request, { organization, user }) => {
  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const requestedBranchId = typeof body.branch_id === 'string' ? body.branch_id.trim() : ''

  if (name.length < 2) {
    return NextResponse.json({ success: false, error: 'Ingresa un nombre valido para la caja.' }, { status: 400 })
  }

  if (!requestedBranchId || requestedBranchId === 'all') {
    return NextResponse.json({ success: false, error: 'Selecciona una sucursal antes de crear una caja.' }, { status: 400 })
  }

  let branchScope
  try {
    branchScope = await resolveBranchScopeForUser({
      userId: user.id,
      role: user.role as Parameters<typeof resolveBranchScopeForUser>[0]['role'],
      requestedBranchId: getRequestedBranchId(request, requestedBranchId),
      organizationId: organization.id,
      strict: true,
    })
  } catch {
    return NextResponse.json({ success: false, error: 'No tenes acceso a la sucursal seleccionada.' }, { status: 403 })
  }

  if (!branchScope.branchId) {
    return NextResponse.json({ success: false, error: 'No tenes una sucursal asignada para crear cajas.' }, { status: 403 })
  }

  const branchId = branchScope.branchId
  const supabase = createAdminSupabase()

  const planGate = await canCreateResource(organization.id, 'cashRegisters')

  if (!planGate.allowed) {
    const planName = planGate.plan?.name || planGate.plan?.code || 'actual'
    const limitText = planGate.limit === null ? 'ilimitadas' : String(planGate.limit)
    const error = planGate.blocked
      ? 'No se puede crear una caja porque la suscripcion esta suspendida o cancelada. Reactiva la suscripcion para habilitar mas cajas.'
      : planGate.expired
        ? `No hay cupo para crear esta caja. Como el plan vencio, la organizacion quedo con el limite Free de ${limitText} caja(s). Elimina una caja que no uses o actualiza el plan.`
        : `No hay cupo para crear esta caja. El plan ${planName} permite ${limitText} caja(s). Elimina una caja que no uses o actualiza el plan.`

    return NextResponse.json(
      {
        success: false,
        error,
        code: planGate.blocked ? 'SUBSCRIPTION_BLOCKED' : 'PLAN_LIMIT_REACHED',
        resource: 'cashRegisters',
        current: planGate.current,
        limit: planGate.limit,
        plan: {
          code: planGate.plan?.code,
          name: planGate.plan?.name,
        },
      },
      { status: planGate.blocked ? 402 : 409 }
    )
  }

  const { data, error } = await supabase
    .from('cash_registers')
    .insert({ name, is_open: false, balance: 0, branch_id: branchId, organization_id: organization.id })
    .select('id, name')
    .single()

  if (error) {
    return NextResponse.json({ success: false, error: 'No se pudo crear la caja.' }, { status: 500 })
  }

  return NextResponse.json({ success: true, data })
})
