import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { roleHasPermission } from '@/lib/saas/permissions'
import { canCreateResource, getOrganizationPlanInfo } from '@/lib/saas/subscription-service'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { AgendaServiceCreateSchema } from '@/lib/agenda/service-creation'
import { serviceCreationFailure } from '@/lib/agenda/service-creation-server'

export const dynamic = 'force-dynamic'
export const POST = withTenantAuth({ permission: 'settings.manage', module: 'services' }, async (request, { organization, user }) => {
  if (!roleHasPermission(organization.role, 'products.create')) {
    return NextResponse.json({ error: 'Necesitás permiso para crear productos y administrar la agenda.' }, { status: 403 })
  }
  const plan = await getOrganizationPlanInfo(organization.id)
  if (!plan.modules.includes('inventory')) {
    return NextResponse.json({ error: 'Activá el módulo de productos para crear servicios.', code: 'INVENTORY_REQUIRED' }, { status: 403 })
  }
  const parsed = AgendaServiceCreateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Revisá los datos del servicio.', code: 'INVALID_SERVICE' }, { status: 422 })
  const admin = createAdminSupabase()
  const failure = (error: { code?: string; message?: string }) => {
    const { status, ...body } = serviceCreationFailure(error)
    return NextResponse.json(body, { status })
  }
  const before = await admin.rpc('agenda_service_policy_revision', { p_org: organization.id })
  if (before.error) return failure(before.error)
  const capacity = await canCreateResource(organization.id, 'services')
  if (capacity.blocked) return NextResponse.json({ error: 'La suscripción está bloqueada.', code: 'SUBSCRIPTION_BLOCKED' }, { status: 403 })
  const after = await admin.rpc('agenda_service_policy_revision', { p_org: organization.id })
  if (after.error) return failure(after.error)
  if (!before.data || before.data !== after.data) return failure({ message: 'SERVICE_POLICY_CHANGED' })
  const { requestKey, ...input } = parsed.data
  // Capacity denial is not an early exit: the RPC checks replay first, then
  // counts under its product lock. An occupied last slot must still replay.
  const result = await admin.rpc('create_agenda_service', {
    p_org: organization.id, p_actor: user.id, p_key: requestKey, p_input: input,
    p_limit: capacity.limit, p_policy_revision: after.data,
  })
  if (result.error) return failure(result.error)
  if (!result.data || typeof result.data.id !== 'string') return failure({})
  return NextResponse.json({ success: true, service: { id: result.data.id }, replayed: result.data.replayed === true })
})
