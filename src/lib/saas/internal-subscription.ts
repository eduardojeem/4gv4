/**
 * Cuenta interna: una suscripción activa, sin vencimiento y sin cobro (la
 * tienda de la propia plataforma, cuentas de prueba del equipo). Se marca con
 * payment_status = 'internal' para que no pida renovación ni sume al MRR.
 */
export const INTERNAL_PAYMENT_STATUS = 'internal'

/** Valor del selector de estado en «Editar organización». No existe en la base. */
export const INTERNAL_STATUS_OPTION = 'internal'

export function isInternalSubscription(subscription: { status?: string | null; payment_status?: string | null; paymentStatus?: string | null } | null | undefined) {
  if (!subscription) return false
  const paymentStatus = (subscription.payment_status ?? subscription.paymentStatus)?.toLowerCase()
  return subscription.status?.toLowerCase() === 'active' && paymentStatus === INTERNAL_PAYMENT_STATUS
}
