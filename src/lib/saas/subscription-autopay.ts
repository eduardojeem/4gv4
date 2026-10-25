import { randomUUID } from 'crypto'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { renderAutopayFailedEmail } from '@/lib/email/templates'
import {
  createPagoparOrder,
  getPagoparAmountInPyg,
  queryPagoparOrder,
} from '@/lib/payments/pagopar'
import {
  addPagoparCustomer,
  confirmPagoparCards,
  deletePagoparCard,
  getUpayCardFormUrl,
  isPagoparRecurringEnabled,
  listPagoparCards,
  payPagoparOrderWithCard,
  PagoparRecurringError,
  pickPagoparCard,
  startPagoparCardForm,
  type PagoparCardProvider,
} from '@/lib/payments/pagopar-recurring'
import { getCurrentOrganizationSubscription } from '@/lib/saas/subscription-service'

/**
 * Débito automático de la suscripción con una tarjeta guardada en uPay.
 *
 * El cobro se intenta el día en que vence el período y, si la tarjeta rechaza,
 * se reintenta a los 2 y a los 5 días. Tras el tercer rechazo el débito queda
 * suspendido: el dueño recibe un aviso en cada rechazo y puede pagar a mano.
 */

export const AUTOPAY_PROVIDER: PagoparCardProvider = 'uPay'
export const AUTOPAY_PAYMENT_METHOD = 'Pagopar Débito automático'
export const AUTOPAY_MAX_ATTEMPTS = 3
/** Días entre el intento n y el n+1. */
const AUTOPAY_RETRY_OFFSETS_DAYS = [2, 3]
/** Se cobra cuando faltan 24 horas o menos para el vencimiento. */
const AUTOPAY_DUE_WINDOW_MS = 24 * 60 * 60 * 1000
/** Evita que dos corridas del cron cobren a la vez la misma organización. */
const AUTOPAY_CLAIM_MS = 30 * 60 * 1000
/** Un pago automático todavía pendiente en Pagopar se vuelve a consultar en este plazo. */
const AUTOPAY_PENDING_RECHECK_MS = 6 * 60 * 60 * 1000

type AutopayRow = {
  organization_id: string
  pagopar_customer_id: number
  provider: PagoparCardProvider
  enabled: boolean
  card_status: 'none' | 'pending' | 'active'
  card_brand: string | null
  card_masked: string | null
  card_type: string | null
  card_issuer: string | null
  failed_attempts: number
  next_attempt_at: string | null
  last_attempt_at: string | null
  last_error: string | null
  suspended_at: string | null
}

export type AutopayStatus = {
  available: boolean
  enabled: boolean
  cardStatus: AutopayRow['card_status']
  card: { brand: string | null; masked: string | null; type: string | null } | null
  failedAttempts: number
  maxAttempts: number
  nextAttemptAt: string | null
  suspended: boolean
  lastError: string | null
}

export class AutopayError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export type AutopayRunResult = {
  checked: number
  charged: number
  pending: number
  failed: number
  suspended: number
  skipped: number
}

const AUTOPAY_COLUMNS = 'organization_id, pagopar_customer_id, provider, enabled, card_status, card_brand, card_masked, card_type, card_issuer, failed_attempts, next_attempt_at, last_attempt_at, last_error, suspended_at'

/** Próximo reintento tras `failedAttempts` rechazos, o null si ya no hay más. */
export function getAutopayRetryAt(failedAttempts: number, from: Date) {
  if (failedAttempts >= AUTOPAY_MAX_ATTEMPTS) return null
  const offsetDays = AUTOPAY_RETRY_OFFSETS_DAYS[failedAttempts - 1]
  if (!offsetDays) return null
  return new Date(from.getTime() + offsetDays * 24 * 60 * 60 * 1000)
}

export function isAutopayDue(params: {
  periodEndsAt: string | null
  cancelAtPeriodEnd: boolean | null
  now: Date
}) {
  if (!params.periodEndsAt || params.cancelAtPeriodEnd) return false
  const endsAt = new Date(params.periodEndsAt).getTime()
  if (!Number.isFinite(endsAt)) return false
  return endsAt - params.now.getTime() <= AUTOPAY_DUE_WINDOW_MS
}

function toStatus(row: AutopayRow | null): AutopayStatus {
  return {
    available: isPagoparRecurringEnabled(),
    enabled: row?.enabled === true,
    cardStatus: row?.card_status || 'none',
    card: row?.card_status === 'active'
      ? { brand: row.card_brand, masked: row.card_masked, type: row.card_type }
      : null,
    failedAttempts: row?.failed_attempts || 0,
    maxAttempts: AUTOPAY_MAX_ATTEMPTS,
    nextAttemptAt: row?.next_attempt_at || null,
    suspended: Boolean(row?.suspended_at),
    lastError: row?.last_error || null,
  }
}

function assertAvailable() {
  if (!isPagoparRecurringEnabled()) {
    throw new AutopayError('El débito automático todavía no está habilitado.', 501)
  }
}

async function getAutopayRow(organizationId: string) {
  const { data, error } = await createAdminSupabase()
    .from('subscription_autopay')
    .select(AUTOPAY_COLUMNS)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (error) throw new AutopayError('No se pudo leer el débito automático.', 500)
  return (data as AutopayRow | null) ?? null
}

async function ensureAutopayRow(organizationId: string) {
  const admin = createAdminSupabase()
  const { error } = await admin
    .from('subscription_autopay')
    .upsert({ organization_id: organizationId }, { onConflict: 'organization_id', ignoreDuplicates: true })
  if (error) throw new AutopayError('No se pudo preparar el débito automático.', 500)
  const row = await getAutopayRow(organizationId)
  if (!row) throw new AutopayError('No se pudo preparar el débito automático.', 500)
  return row
}

async function updateAutopay(organizationId: string, values: Partial<AutopayRow>) {
  const { error } = await createAdminSupabase()
    .from('subscription_autopay')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('organization_id', organizationId)
  if (error) throw new AutopayError('No se pudo actualizar el débito automático.', 500)
}

export async function getAutopayStatus(organizationId: string) {
  return toStatus(await getAutopayRow(organizationId))
}

/** Registra al cliente en Pagopar y devuelve la URL del formulario de uPay. */
export async function startAutopayCardRegistration(params: {
  organizationId: string
  organizationName: string
  userEmail?: string | null
  returnUrl: string
}) {
  assertAvailable()
  const state = await getCurrentOrganizationSubscription(params.organizationId)
  const email = state.billingProfile?.billing_email?.trim() || params.userEmail?.trim()
  const phone = state.billingProfile?.phone?.trim()
  if (!email || !phone) {
    throw new AutopayError('Completá el correo y el teléfono de facturación antes de guardar una tarjeta.', 400)
  }

  const row = await ensureAutopayRow(params.organizationId)
  await addPagoparCustomer({
    customerId: row.pagopar_customer_id,
    name: state.billingProfile?.business_name?.trim() || params.organizationName,
    email,
    phone,
  })
  const formId = await startPagoparCardForm({
    customerId: row.pagopar_customer_id,
    returnUrl: params.returnUrl,
    provider: AUTOPAY_PROVIDER,
  })
  if (row.card_status === 'none') {
    await updateAutopay(params.organizationId, { card_status: 'pending' })
  }
  return getUpayCardFormUrl(formId)
}

/**
 * Al volver del formulario: confirma en Pagopar (obligatorio, haya salido bien
 * o no) y toma la tarjeta guardada de su listado. El parámetro status de la URL
 * no se usa para decidir: solo cuenta lo que Pagopar devuelve.
 */
export async function completeAutopayCardRegistration(params: {
  organizationId: string
  returnUrl: string
}) {
  assertAvailable()
  const row = await getAutopayRow(params.organizationId)
  if (!row) throw new AutopayError('No hay un registro de tarjeta en curso.', 404)

  await confirmPagoparCards({ customerId: row.pagopar_customer_id, returnUrl: params.returnUrl })
  const cards = await listPagoparCards(row.pagopar_customer_id)
  // La más reciente suele ser la última del listado.
  const card = pickPagoparCard([...cards].reverse(), { provider: AUTOPAY_PROVIDER })

  if (!card) {
    await updateAutopay(params.organizationId, {
      card_status: row.card_status === 'active' ? 'active' : 'none',
    })
    return { saved: false, status: toStatus(await getAutopayRow(params.organizationId)) }
  }

  await updateAutopay(params.organizationId, {
    card_status: 'active',
    card_brand: card.brand,
    card_masked: card.masked,
    card_type: card.cardType,
    card_issuer: card.issuer,
    enabled: true,
    failed_attempts: 0,
    next_attempt_at: null,
    suspended_at: null,
    last_error: null,
  })
  return { saved: true, status: toStatus(await getAutopayRow(params.organizationId)) }
}

export async function setAutopayEnabled(organizationId: string, enabled: boolean) {
  assertAvailable()
  const row = await getAutopayRow(organizationId)
  if (enabled && row?.card_status !== 'active') {
    throw new AutopayError('Guardá una tarjeta antes de activar el débito automático.', 400)
  }
  if (!row) return toStatus(null)
  await updateAutopay(organizationId, enabled
    ? { enabled: true, failed_attempts: 0, next_attempt_at: null, suspended_at: null, last_error: null }
    : { enabled: false })
  return toStatus(await getAutopayRow(organizationId))
}

export async function removeAutopayCard(organizationId: string) {
  assertAvailable()
  const row = await getAutopayRow(organizationId)
  if (!row) return toStatus(null)

  const cards = await listPagoparCards(row.pagopar_customer_id)
  for (const card of cards.filter((item) => item.provider?.toLowerCase() === AUTOPAY_PROVIDER.toLowerCase())) {
    await deletePagoparCard({ customerId: row.pagopar_customer_id, aliasToken: card.aliasToken })
  }
  await updateAutopay(organizationId, {
    enabled: false,
    card_status: 'none',
    card_brand: null,
    card_masked: null,
    card_type: null,
    card_issuer: null,
    failed_attempts: 0,
    next_attempt_at: null,
    suspended_at: null,
  })
  return toStatus(await getAutopayRow(organizationId))
}

async function applyPaidAutopayOrder(hash: string) {
  const order = await queryPagoparOrder(hash)
  if (order.status === 'approved') {
    const { error } = await createAdminSupabase().rpc('apply_paid_subscription_payment', {
      p_external_reference: hash,
      p_provider_payment_id: order.providerOrderId || '',
      p_payment_method: AUTOPAY_PAYMENT_METHOD,
      p_paid_at: order.paidAt ? new Date(order.paidAt).toISOString() : new Date().toISOString(),
      p_amount: order.amount,
    })
    if (error) throw new Error(`No se pudo aplicar el pago: ${error.message}`)
  }
  return order.status
}

async function notifyAutopayFailure(params: {
  organizationId: string
  attempt: number
  nextAttemptAt: Date | null
  amountPyg: number
  planName: string
  reason: string
}) {
  const admin = createAdminSupabase()
  const [{ data: organization }, { data: billing }] = await Promise.all([
    admin.from('organizations').select('name, email, logo_url').eq('id', params.organizationId).maybeSingle(),
    admin.from('billing_profiles').select('billing_email').eq('organization_id', params.organizationId).maybeSingle(),
  ])
  const to = billing?.billing_email || organization?.email
  if (!to) {
    console.warn('[autopay] Organización sin email para avisar el rechazo', { organizationId: params.organizationId })
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const result = await sendEmail({
    to,
    subject: params.nextAttemptAt
      ? 'No pudimos cobrar tu suscripción, vamos a reintentar'
      : 'Se suspendió el débito automático de tu suscripción',
    html: renderAutopayFailedEmail({
      companyName: organization?.name || 'tu comercio',
      planName: params.planName,
      amountPyg: params.amountPyg,
      attempt: params.attempt,
      maxAttempts: AUTOPAY_MAX_ATTEMPTS,
      nextAttemptAt: params.nextAttemptAt,
      reason: params.reason,
      manageUrl: `${appUrl}/admin/subscriptions/autopay`,
      brand: { name: organization?.name || 'MiTiendaPY', logoUrl: organization?.logo_url ?? undefined },
    }),
    log: { organizationId: params.organizationId },
  })
  if (!result.ok && !result.skipped) {
    console.error('[autopay] No se pudo enviar el aviso de rechazo', {
      organizationId: params.organizationId,
      error: result.error,
    })
  }
}

async function registerAutopayFailure(params: {
  row: AutopayRow
  now: Date
  amountPyg: number
  planName: string
  reason: string
}) {
  const attempt = Math.min(params.row.failed_attempts + 1, AUTOPAY_MAX_ATTEMPTS)
  const nextAttemptAt = getAutopayRetryAt(attempt, params.now)
  await updateAutopay(params.row.organization_id, {
    failed_attempts: attempt,
    next_attempt_at: nextAttemptAt?.toISOString() ?? null,
    last_attempt_at: params.now.toISOString(),
    last_error: params.reason.slice(0, 200),
    ...(nextAttemptAt ? {} : { enabled: false, suspended_at: params.now.toISOString() }),
  })
  await notifyAutopayFailure({
    organizationId: params.row.organization_id,
    attempt,
    nextAttemptAt,
    amountPyg: params.amountPyg,
    planName: params.planName,
    reason: params.reason,
  })
  return nextAttemptAt ? 'failed' as const : 'suspended' as const
}

/** Toma la fila para esta corrida; si otra corrida ya la tomó, devuelve false. */
async function claimAutopayRow(row: AutopayRow, now: Date) {
  const nowIso = now.toISOString()
  const { data } = await createAdminSupabase()
    .from('subscription_autopay')
    .update({ next_attempt_at: new Date(now.getTime() + AUTOPAY_CLAIM_MS).toISOString(), updated_at: nowIso })
    .eq('organization_id', row.organization_id)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
    .select('organization_id')
    .maybeSingle()
  return Boolean(data)
}

async function chargeOrganization(row: AutopayRow, now: Date): Promise<keyof AutopayRunResult> {
  const admin = createAdminSupabase()
  const state = await getCurrentOrganizationSubscription(row.organization_id)
  const subscription = state.subscription
  const plan = state.currentPlan

  // Un pago automático anterior todavía sin resolver: se consulta antes de volver a cobrar.
  const { data: pendingPayment } = await admin
    .from('subscription_payments')
    .select('id, external_reference, amount')
    .eq('organization_id', row.organization_id)
    .eq('provider', 'pagopar')
    .eq('payment_method', AUTOPAY_PAYMENT_METHOD)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pendingPayment?.external_reference) {
    const status = await applyPaidAutopayOrder(pendingPayment.external_reference)
    if (status === 'approved') {
      await updateAutopay(row.organization_id, { failed_attempts: 0, next_attempt_at: null, last_error: null })
      return 'charged'
    }
    if (status === 'pending' || status === 'processing') {
      await updateAutopay(row.organization_id, {
        next_attempt_at: new Date(now.getTime() + AUTOPAY_PENDING_RECHECK_MS).toISOString(),
      })
      return 'pending'
    }
    await admin.from('subscription_payments').update({ status: 'failed' }).eq('id', pendingPayment.id)
    return registerAutopayFailure({
      row, now, amountPyg: Number(pendingPayment.amount), planName: plan.name, reason: 'La tarjeta rechazó el cobro.',
    })
  }

  if (!isAutopayDue({
    periodEndsAt: subscription?.current_period_ends_at ?? null,
    cancelAtPeriodEnd: subscription?.cancel_at_period_end ?? null,
    now,
  })) {
    // Ya se pagó (a mano o en otra corrida): los rechazos anteriores dejan de
    // contar y se vuelve a mirar recién cuando se acerque el vencimiento.
    const periodEnd = subscription?.current_period_ends_at ? new Date(subscription.current_period_ends_at) : null
    await updateAutopay(row.organization_id, {
      failed_attempts: 0,
      last_error: null,
      next_attempt_at: periodEnd && !subscription?.cancel_at_period_end
        ? new Date(periodEnd.getTime() - AUTOPAY_DUE_WINDOW_MS).toISOString()
        : null,
    })
    return 'skipped'
  }

  const amountPyg = getPagoparAmountInPyg(plan.price_monthly, plan.currency)
  if (amountPyg <= 0) {
    await updateAutopay(row.organization_id, { next_attempt_at: null })
    return 'skipped'
  }

  const billing = state.billingProfile
  const externalReference = `AUT${Date.now()}${randomUUID().replace(/-/g, '').slice(0, 10)}`
  const { data: payment, error: paymentError } = await admin
    .from('subscription_payments')
    .insert({
      organization_id: row.organization_id,
      subscription_id: subscription?.id || null,
      plan_id: plan.code,
      amount: amountPyg,
      currency: 'PYG',
      status: 'pending',
      payment_method: AUTOPAY_PAYMENT_METHOD,
      provider: 'pagopar',
      external_reference: externalReference,
    })
    .select('id')
    .single()
  if (paymentError || !payment) throw new Error(paymentError?.message || 'No se pudo registrar el pago.')

  let orderHash: string
  let aliasToken: string
  try {
    const order = await createPagoparOrder({
      amountPyg,
      buyer: {
        businessName: billing?.business_name,
        document: billing?.ruc,
        email: billing?.billing_email,
        name: billing?.business_name,
        phone: billing?.phone,
        ruc: billing?.ruc,
        address: billing?.fiscal_address || '',
      },
      description: `Suscripción ${plan.name} - débito automático`,
      externalReference,
      itemId: Number.parseInt(payment.id.replace(/[^\d]/g, '').slice(0, 9), 10) || 1,
      paymentMethod: 'card',
    })
    await admin
      .from('subscription_payments')
      .update({ provider_payment_id: order.providerOrderId, external_reference: order.hash })
      .eq('id', payment.id)

    const cards = await listPagoparCards(row.pagopar_customer_id)
    const card = pickPagoparCard(cards, { masked: row.card_masked, provider: row.provider })
    if (!card) {
      await admin.from('subscription_payments').update({ status: 'failed' }).eq('id', payment.id)
      await updateAutopay(row.organization_id, { card_status: 'none', enabled: false })
      return registerAutopayFailure({
        row, now, amountPyg, planName: plan.name, reason: 'La tarjeta guardada ya no está disponible.',
      })
    }
    orderHash = order.hash
    aliasToken = card.aliasToken
  } catch (error) {
    // Pagopar no respondió al preparar el cobro: no se tocó la tarjeta, así
    // que no cuenta como rechazo. La próxima corrida lo vuelve a intentar.
    await admin.from('subscription_payments').update({ status: 'failed' }).eq('id', payment.id)
    throw error
  }

  try {
    await payPagoparOrderWithCard({
      customerId: row.pagopar_customer_id,
      aliasToken,
      orderHash,
    })
  } catch (error) {
    if (error instanceof PagoparRecurringError && error.rejected) {
      await admin.from('subscription_payments').update({ status: 'failed' }).eq('id', payment.id)
      return registerAutopayFailure({ row, now, amountPyg, planName: plan.name, reason: error.message })
    }
    // Sin respuesta clara no se sabe si se debitó: el pago queda pendiente y
    // la próxima corrida consulta el pedido en Pagopar antes de reintentar.
    await updateAutopay(row.organization_id, {
      last_attempt_at: now.toISOString(),
      next_attempt_at: new Date(now.getTime() + AUTOPAY_PENDING_RECHECK_MS).toISOString(),
    })
    return 'pending'
  }
  await updateAutopay(row.organization_id, { last_attempt_at: now.toISOString() })

  let status: Awaited<ReturnType<typeof applyPaidAutopayOrder>>
  try {
    status = await applyPaidAutopayOrder(orderHash)
  } catch {
    // El débito salió pero no se pudo confirmar todavía: lo resuelve la
    // consulta de la próxima corrida o el webhook de Pagopar.
    await updateAutopay(row.organization_id, {
      next_attempt_at: new Date(now.getTime() + AUTOPAY_PENDING_RECHECK_MS).toISOString(),
    })
    return 'pending'
  }
  if (status === 'approved') {
    await updateAutopay(row.organization_id, { failed_attempts: 0, next_attempt_at: null, last_error: null })
    return 'charged'
  }
  if (status === 'pending' || status === 'processing') {
    await updateAutopay(row.organization_id, {
      next_attempt_at: new Date(now.getTime() + AUTOPAY_PENDING_RECHECK_MS).toISOString(),
    })
    return 'pending'
  }
  await admin.from('subscription_payments').update({ status: 'failed' }).eq('id', payment.id)
  return registerAutopayFailure({ row, now, amountPyg, planName: plan.name, reason: 'La tarjeta rechazó el cobro.' })
}

/** Barrido del cron: cobra las suscripciones con débito activo que vencen. */
export async function runSubscriptionAutopay(now = new Date()): Promise<AutopayRunResult> {
  const result: AutopayRunResult = { checked: 0, charged: 0, pending: 0, failed: 0, suspended: 0, skipped: 0 }
  if (!isPagoparRecurringEnabled()) return result

  const { data, error } = await createAdminSupabase()
    .from('subscription_autopay')
    .select(AUTOPAY_COLUMNS)
    .eq('enabled', true)
    .eq('card_status', 'active')
    .is('suspended_at', null)
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now.toISOString()}`)
    .limit(200)
  if (error) throw new Error(`No se pudieron leer los débitos automáticos: ${error.message}`)

  for (const row of (data ?? []) as AutopayRow[]) {
    result.checked += 1
    if (!(await claimAutopayRow(row, now))) {
      result.skipped += 1
      continue
    }
    try {
      result[await chargeOrganization(row, now)] += 1
    } catch (chargeError) {
      // Un error interno (no un rechazo de la tarjeta) no cuenta como intento: se reintenta en la próxima corrida.
      console.error('[autopay] Falló el procesamiento', {
        organizationId: row.organization_id,
        reason: chargeError instanceof Error ? chargeError.message : 'unknown_error',
      })
      result.failed += 1
    }
  }
  return result
}
