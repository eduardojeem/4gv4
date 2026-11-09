import { randomUUID } from 'crypto'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { assertSubscriptionPaymentEnabled } from '@/lib/payments/subscription-controls'
import { PaymentControlError } from '@/lib/payments/control-contract'
import { sendEmail } from '@/lib/email/resend'
import { renderAutopayFailedEmail } from '@/lib/email/templates'
import {
  BancardError,
  chargeBancardCard,
  deleteBancardCard,
  getBancardAmountInPyg,
  isBancardConfirmationApproved,
  isBancardRecurringEnabled,
  listBancardCards,
  pickBancardCard,
  queryBancardPayment,
  startBancardCardRegistration,
} from '@/lib/payments/bancard'
import { getCurrentOrganizationSubscription } from '@/lib/saas/subscription-service'
import { AUTOPAY_PAYMENT_METHOD, nextBancardShopProcessId } from '@/lib/saas/subscription-checkout'
import { siteUrl } from '@/lib/site-url'

/**
 * Débito automático de la suscripción con una tarjeta guardada en Bancard.
 *
 * El cobro se intenta el día en que vence el período y, si la tarjeta rechaza,
 * se reintenta a los 2 y a los 5 días. Tras el tercer rechazo el débito queda
 * suspendido: el dueño recibe un aviso en cada rechazo y puede pagar a mano.
 */

export { AUTOPAY_PAYMENT_METHOD }
export const AUTOPAY_MAX_ATTEMPTS = 3
/** Días entre el intento n y el n+1. */
const AUTOPAY_RETRY_OFFSETS_DAYS = [2, 3]
/** Se cobra cuando faltan 24 horas o menos para el vencimiento. */
const AUTOPAY_DUE_WINDOW_MS = 24 * 60 * 60 * 1000
/** Evita que dos corridas del cron cobren a la vez la misma organización. */
const AUTOPAY_CLAIM_MS = 30 * 60 * 1000
/** Un pago automático todavía sin confirmar en Bancard se vuelve a consultar en este plazo. */
const AUTOPAY_PENDING_RECHECK_MS = 6 * 60 * 60 * 1000

type AutopayRow = {
  organization_id: string
  bancard_user_id: number
  provider: string
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

const AUTOPAY_COLUMNS = 'organization_id, bancard_user_id, provider, enabled, card_status, card_brand, card_masked, card_type, card_issuer, failed_attempts, next_attempt_at, last_attempt_at, last_error, suspended_at'

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
    available: isBancardRecurringEnabled(),
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
  if (!isBancardRecurringEnabled()) {
    throw new AutopayError('El débito automático todavía no está habilitado.', 501)
  }
}

async function assertNewAutopayAllowed() {
  try { await assertSubscriptionPaymentEnabled('autopay') }
  catch (error) { if (error instanceof PaymentControlError) throw new AutopayError(error.message, error.status); throw error }
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

/** Pide a Bancard el formulario para catastrar una tarjeta y devuelve su process_id. */
export async function startAutopayCardRegistration(params: {
  organizationId: string
  organizationName: string
  userEmail?: string | null
  returnUrl: string
}) {
  assertAvailable()
  await assertNewAutopayAllowed()
  const state = await getCurrentOrganizationSubscription(params.organizationId)
  const email = state.billingProfile?.billing_email?.trim() || params.userEmail?.trim()
  const phone = state.billingProfile?.phone?.trim()
  if (!email || !phone) {
    throw new AutopayError('Completá el correo y el teléfono de facturación antes de guardar una tarjeta.', 400)
  }

  const row = await ensureAutopayRow(params.organizationId)
  const processId = await startBancardCardRegistration({
    userId: row.bancard_user_id,
    // card_id solo tiene que ser único por usuario: se usa la misma secuencia
    // que los pagos para no repetirlo nunca.
    cardId: Number(await nextBancardShopProcessId()),
    email,
    phone,
    returnUrl: params.returnUrl,
  })
  if (row.card_status === 'none') {
    await updateAutopay(params.organizationId, { card_status: 'pending' })
  }
  return processId
}

/**
 * Al volver del formulario: toma la tarjeta guardada del listado de Bancard.
 * El parámetro status de la URL no se usa para decidir: solo cuenta lo que
 * Bancard devuelve.
 */
export async function completeAutopayCardRegistration(params: { organizationId: string }) {
  assertAvailable()
  const row = await getAutopayRow(params.organizationId)
  if (!row) throw new AutopayError('No hay un registro de tarjeta en curso.', 404)

  const cards = await listBancardCards(row.bancard_user_id)
  // La más reciente tiene el card_id más alto.
  const card = pickBancardCard(cards)

  if (!card) {
    await updateAutopay(params.organizationId, {
      card_status: row.card_status === 'active' ? 'active' : 'none',
    })
    return { saved: false, status: toStatus(await getAutopayRow(params.organizationId)) }
  }

  // Si cambió de tarjeta, se borran las anteriores para que solo quede una.
  for (const previous of cards.filter((item) => item.aliasToken !== card.aliasToken)) {
    await deleteBancardCard({ userId: row.bancard_user_id, aliasToken: previous.aliasToken }).catch(() => undefined)
  }

  await updateAutopay(params.organizationId, {
    card_status: 'active',
    card_brand: card.brand,
    card_masked: card.masked,
    card_type: card.cardType,
    card_issuer: null,
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
  if (enabled) await assertNewAutopayAllowed()
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

  const cards = await listBancardCards(row.bancard_user_id)
  for (const card of cards) {
    await deleteBancardCard({ userId: row.bancard_user_id, aliasToken: card.aliasToken })
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

async function applyPaidAutopayCharge(shopProcessId: string, amount: number, providerPaymentId: string) {
  const { error } = await createAdminSupabase().rpc('apply_paid_provider_subscription_payment', {
    p_provider: 'bancard',
    p_external_reference: shopProcessId,
    p_provider_payment_id: providerPaymentId,
    p_payment_method: AUTOPAY_PAYMENT_METHOD,
    p_paid_at: new Date().toISOString(),
    p_amount: amount,
  })
  if (error) throw new Error(`No se pudo aplicar el pago: ${error.message}`)
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

  // Un cobro automático anterior todavía sin resolver: se consulta en Bancard
  // antes de volver a cobrar.
  const { data: pendingPayment } = await admin
    .from('subscription_payments')
    .select('id, external_reference, amount, created_at')
    .eq('organization_id', row.organization_id)
    .eq('provider', 'bancard')
    .eq('payment_method', AUTOPAY_PAYMENT_METHOD)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (pendingPayment?.external_reference) {
    const order = await queryBancardPayment(pendingPayment.external_reference, pendingPayment.created_at, now)
    if (order.status === 'approved') {
      await applyPaidAutopayCharge(
        pendingPayment.external_reference,
        order.amount ?? Number(pendingPayment.amount),
        order.authorizationNumber || order.ticketNumber || '',
      )
      await updateAutopay(row.organization_id, { failed_attempts: 0, next_attempt_at: null, last_error: null })
      return 'charged'
    }
    if (order.status === 'pending' || order.status === 'processing') {
      await updateAutopay(row.organization_id, {
        next_attempt_at: new Date(now.getTime() + AUTOPAY_PENDING_RECHECK_MS).toISOString(),
      })
      return 'pending'
    }
    await admin.from('subscription_payments').update({ status: 'failed' }).eq('id', pendingPayment.id)
    return registerAutopayFailure({
      row, now, amountPyg: Number(pendingPayment.amount), planName: plan.name, reason: order.message || 'La tarjeta rechazó el cobro.',
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

  const amountPyg = getBancardAmountInPyg(plan.price_monthly, plan.currency)
  if (amountPyg <= 0) {
    await updateAutopay(row.organization_id, { next_attempt_at: null })
    return 'skipped'
  }

  // Si Bancard no responde al listar es un error interno: se reintenta
  // en la próxima corrida sin contar como rechazo.
  const cards = await listBancardCards(row.bancard_user_id)
  const card = pickBancardCard(cards, row.card_masked)
  if (!card) {
    await updateAutopay(row.organization_id, { card_status: 'none', enabled: false })
    return registerAutopayFailure({
      row, now, amountPyg, planName: plan.name, reason: 'La tarjeta guardada ya no está disponible.',
    })
  }

  const shopProcessId = await nextBancardShopProcessId()
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
      provider: 'bancard',
      external_reference: shopProcessId,
    })
    .select('id')
    .single()
  if (paymentError || !payment) throw new Error(paymentError?.message || 'No se pudo registrar el pago.')

  let charge: Awaited<ReturnType<typeof chargeBancardCard>>
  try {
    charge = await chargeBancardCard({
      shopProcessId,
      amountPyg,
      aliasToken: card.aliasToken,
      description: `Plan ${plan.name}`,
      returnUrl: siteUrl('/admin/subscriptions/autopay'),
    })
  } catch (error) {
    if (error instanceof BancardError && error.rejected) {
      await admin.from('subscription_payments').update({ status: 'failed' }).eq('id', payment.id)
      return registerAutopayFailure({ row, now, amountPyg, planName: plan.name, reason: error.message })
    }
    // Sin respuesta clara no se sabe si se debitó: el pago queda pendiente y
    // la próxima corrida lo consulta en Bancard antes de reintentar.
    await updateAutopay(row.organization_id, {
      last_attempt_at: now.toISOString(),
      next_attempt_at: new Date(now.getTime() + AUTOPAY_PENDING_RECHECK_MS).toISOString(),
    })
    return 'pending'
  }
  await updateAutopay(row.organization_id, { last_attempt_at: now.toISOString() })

  // 3D Secure: el banco pide que el titular verifique la compra, cosa que un
  // cobro automático no puede hacer. No se debitó nada: se avisa para pagar a mano.
  if (charge.kind === 'requires_3ds') {
    await admin.from('subscription_payments').update({ status: 'failed' }).eq('id', payment.id)
    return registerAutopayFailure({
      row,
      now,
      amountPyg,
      planName: plan.name,
      reason: 'Tu banco pidió verificar el pago (3D Secure). Pagá la suscripción a mano desde Mi suscripción.',
    })
  }
  const confirmation = charge.confirmation

  if (!isBancardConfirmationApproved(confirmation)) {
    await admin.from('subscription_payments').update({ status: 'failed' }).eq('id', payment.id)
    return registerAutopayFailure({
      row,
      now,
      amountPyg,
      planName: plan.name,
      reason: confirmation.responseDescription || confirmation.responseDetails || 'La tarjeta rechazó el cobro.',
    })
  }

  try {
    await applyPaidAutopayCharge(
      shopProcessId,
      confirmation.amount ?? amountPyg,
      confirmation.authorizationNumber || confirmation.ticketNumber || '',
    )
  } catch {
    // El débito salió pero no se pudo aplicar todavía: lo resuelve la
    // consulta de la próxima corrida.
    await updateAutopay(row.organization_id, {
      next_attempt_at: new Date(now.getTime() + AUTOPAY_PENDING_RECHECK_MS).toISOString(),
    })
    return 'pending'
  }
  await updateAutopay(row.organization_id, { failed_attempts: 0, next_attempt_at: null, last_error: null })
  return 'charged'
}

/** Barrido del cron: cobra las suscripciones con débito activo que vencen. */
export async function runSubscriptionAutopay(now = new Date()): Promise<AutopayRunResult> {
  const result: AutopayRunResult = { checked: 0, charged: 0, pending: 0, failed: 0, suspended: 0, skipped: 0 }
  if (!isBancardRecurringEnabled()) return result

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
