import { commercePaymentControlsReady, requireCommercePaymentControlsReady } from '@/lib/payments/commerce-readiness'
import { NextResponse } from 'next/server'
import { withTenantAuth } from '@/lib/api/withTenantAuth'
import { commerceControlCatalog, controlUpdateSchema, PaymentControlError } from '@/lib/payments/control-contract'
import { readPaymentControlPolicy, updatePaymentControlPolicy } from '@/lib/payments/control-store'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { commerceControlHistory } from '@/lib/payments/control-history'
import { getBrowserRequestOrigin } from '@/lib/http/app-origin'

const snapshot = async (organizationId: string, canEdit = false, includeHistory = false) => {
  const policy = await readPaymentControlPolicy('commerce', organizationId)
  const ready = await commercePaymentControlsReady()
  const catalog = commerceControlCatalog(policy.flags)
  const methods = includeHistory ? await commerceControlHistory(catalog, organizationId) : catalog
  return { configurationNotice: ready ? undefined : 'Falta aplicar y verificar la migración de protección para guardar cambios.', organizationId, canEdit, scope: 'commerce', revision: policy.revision, methods: methods.map(method => ({ ...method, editable: canEdit })) }
}
function failure(error: unknown) {
  if (error instanceof PaymentControlError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { 'Cache-Control': 'private, no-store' } })
  return NextResponse.json({ error: 'No se pudo consultar o guardar los medios de cobro.' }, { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
}
export const GET = withTenantAuth({}, async (request, { organization }) => {
  try { return NextResponse.json(await snapshot(organization.id, ['owner', 'admin'].includes(organization.role), new URL(request.url).searchParams.get('includeHistory') === '1'), { headers: { 'Cache-Control': 'private, no-store' } }) }
  catch (error) { return failure(error) }
})
export const PATCH = withTenantAuth({}, async (request, { organization, user }) => {
  if (!['owner', 'admin'].includes(organization.role)) return NextResponse.json({ error: 'Permisos insuficientes.' }, { status: 403 })
  if (request.headers.get('x-organization-id') !== organization.id) return NextResponse.json({ error: 'El comercio activo cambió. Actualizá antes de guardar.', code: 'ORGANIZATION_CHANGED' }, { status: 409 })
  const origin = request.headers.get('origin')
  if (!origin || origin !== getBrowserRequestOrigin(request) || request.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ error: 'Origen inválido.' }, { status: 403 })
  const parsed = controlUpdateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Cambio inválido.' }, { status: 400 })
  try {
    await requireCommercePaymentControlsReady()
    await updatePaymentControlPolicy({ scope: 'commerce', actorId: user.id, organizationId: organization.id, ...parsed.data, revision: parsed.data.revision ?? null })
    const { error } = await createAdminSupabase().from('audit_log').insert({ user_id: user.id, action: 'update_organization_settings', resource: 'organization_settings', resource_id: organization.id, new_values: { scope: 'commerce', organization_id: organization.id, id: parsed.data.id, enabled: parsed.data.enabled } })
    if (error) logger.warn('Payment control audit failed', { organizationId: organization.id })
    return NextResponse.json(await snapshot(organization.id, true, true), { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) { return failure(error) }
})
