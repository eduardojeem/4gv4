import 'server-only'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { requireCommercePaymentControlsReady } from './commerce-readiness'
import {
  controlFlags, controlIds, objectValue, PaymentControlError, validateCommercePayments,
  type ControlScope, type ControlledPayment,
} from './control-contract'

/** No cache: the mutation boundaries must re-read the effective policy. */
export async function readPaymentControlPolicy(scope: ControlScope, organizationId?: string) {
  if (scope === 'commerce' && !organizationId) throw new PaymentControlError('No hay un comercio activo.', 403)
  const table = scope === 'subscriptions' ? 'system_settings' : 'organization_settings'
  const column = scope === 'subscriptions' ? 'features' : 'modules'
  const key = scope === 'subscriptions' ? 'id' : 'organization_id'
  const id = scope === 'subscriptions' ? 'system' : organizationId!
  const { data, error } = await createAdminSupabase().from(table).select(`${column}, updated_at`).eq(key, id).maybeSingle()
  if (error) throw new PaymentControlError('No se pudieron consultar los medios de pago. Reintentá.')
  const container = objectValue(data?.[column])
  return { table, column, key, id, exists: Boolean(data), container, revision: typeof data?.updated_at === 'string' ? data.updated_at : null, flags: controlFlags(container, scope) }
}

export async function updatePaymentControlPolicy(params: {
  scope: ControlScope; organizationId?: string; id: string; enabled: boolean; revision: string | null; actorId: string
}) {
  if (!controlIds(params.scope).includes(params.id)) throw new PaymentControlError('El medio de pago no es configurable.', 400)
  const current = await readPaymentControlPolicy(params.scope, params.organizationId)
  if (!current.exists) throw new PaymentControlError('Primero completá la configuración inicial.', 409)
  if (current.revision !== params.revision) throw new PaymentControlError('La configuración cambió. Actualizá antes de guardar.', 409, 'PAYMENT_CONTROLS_CONFLICT')
  await requireCommercePaymentControlsReady()
  const { data, error } = await createAdminSupabase().rpc('update_payment_control_policy', {
    p_scope: params.scope, p_organization_id: params.organizationId ?? null, p_method: params.id,
    p_enabled: params.enabled, p_revision: params.revision, p_actor_id: params.actorId,
  })
  if (error) {
    if (error.message?.includes('PAYMENT_CONTROLS_CONFLICT')) throw new PaymentControlError('Otro administrador cambió la configuración. Actualizá y reintentá.', 409, 'PAYMENT_CONTROLS_CONFLICT')
    if (error.message?.includes('PAYMENT_CONTROLS_FORBIDDEN')) throw new PaymentControlError('No tenés permiso para cambiar estos medios.', 403)
    throw new PaymentControlError('No se pudo guardar el medio de pago.')
  }
  if (!data) throw new PaymentControlError('No se pudo confirmar el cambio del medio de pago.')
  return { ...current.flags, [params.id]: params.enabled }
}

export async function assertCommercePayments(organizationId: string, payments: ControlledPayment[]) {
  const { flags } = await readPaymentControlPolicy('commerce', organizationId)
  validateCommercePayments(flags, payments)
}
