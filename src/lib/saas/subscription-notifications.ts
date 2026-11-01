import 'server-only'
import { createAdminSupabase } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { renderSubscriptionNoticeEmail, renderSubscriptionReceiptEmail } from '@/lib/email/templates'
import { dispatchNotificationEvent } from '@/lib/notifications/server/dispatcher'
import type { NotificationType } from '@/lib/notifications/types'

/**
 * Avisos del ciclo de la suscripción, por correo y en la app:
 * vencimiento cercano del plan o de la prueba, pago pendiente, baja a
 * Gratuito, recibo de pago y reversión. Cada aviso sale una sola vez por
 * organización y período (subscription_reminders_sent); un fallo de envío no
 * corta el resto ni la operación que lo originó.
 */

const DAY_MS = 86_400_000
const DOWNGRADE_NOTICE_WINDOW_MS = 3 * DAY_MS

type SubscriptionRow = {
  organization_id: string
  plan: string | null
  status: string | null
  payment_status: string | null
  trial_ends_at: string | null
  current_period_ends_at: string | null
  cancel_at_period_end: boolean | null
  updated_at: string | null
}

export type ReminderKind = 'trial_3' | 'trial_1' | 'renewal_7' | 'renewal_1' | 'past_due' | 'downgraded'

export type ReminderResult = { sent: number; skipped: number; failed: number }

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || ''
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('es-PY', { day: 'numeric', month: 'long', timeZone: 'America/Asuncion' }).format(new Date(value))
}

function daysLeft(value: string | null, now: number) {
  if (!value) return null
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? Math.ceil((time - now) / DAY_MS) : null
}

/** Qué aviso le toca hoy a una suscripción, si alguno. Pura, para poder probarla. */
export function reminderFor(row: SubscriptionRow, now: number): { kind: ReminderKind; periodKey: string; date: string | null } | null {
  const plan = (row.plan || 'FREE').toUpperCase()

  if (row.status === 'trialing' && row.trial_ends_at) {
    const days = daysLeft(row.trial_ends_at, now)
    if (days === null || days <= 0) return null
    if (days <= 1) return { kind: 'trial_1', periodKey: row.trial_ends_at, date: row.trial_ends_at }
    if (days <= 3) return { kind: 'trial_3', periodKey: row.trial_ends_at, date: row.trial_ends_at }
    return null
  }

  if (row.status === 'active' && plan !== 'FREE' && !row.cancel_at_period_end && row.current_period_ends_at) {
    const days = daysLeft(row.current_period_ends_at, now)
    if (days === null || days <= 0) return null
    if (days <= 1) return { kind: 'renewal_1', periodKey: row.current_period_ends_at, date: row.current_period_ends_at }
    if (days <= 7) return { kind: 'renewal_7', periodKey: row.current_period_ends_at, date: row.current_period_ends_at }
    return null
  }

  if (row.status === 'past_due') {
    const key = row.current_period_ends_at || row.trial_ends_at || row.updated_at || 'sin-fecha'
    return { kind: 'past_due', periodKey: key, date: null }
  }

  if (plan === 'FREE' && row.payment_status === 'unpaid' && row.updated_at
    && now - new Date(row.updated_at).getTime() <= DOWNGRADE_NOTICE_WINDOW_MS) {
    return { kind: 'downgraded', periodKey: row.updated_at.slice(0, 10), date: null }
  }

  return null
}

const NOTICE_COPY: Record<ReminderKind, (date: string | null) => {
  title: string
  detail: string
  cta: string
  type: NotificationType
}> = {
  trial_3: (date) => ({
    title: 'Tu prueba gratis termina pronto',
    detail: `La prueba termina el ${date ? formatDay(date) : 'próximamente'}. Elegí un plan y pagá para seguir con todas las herramientas.`,
    cta: 'Elegir plan',
    type: 'SUBSCRIPTION_EXPIRING',
  }),
  trial_1: (date) => ({
    title: 'Tu prueba gratis termina mañana',
    detail: `La prueba termina el ${date ? formatDay(date) : 'mañana'}. Si no pagás, tu cuenta queda 7 días con el pago pendiente y después pasa al plan Gratuito.`,
    cta: 'Pagar ahora',
    type: 'SUBSCRIPTION_EXPIRING',
  }),
  renewal_7: (date) => ({
    title: 'Tu plan vence en una semana',
    detail: `Tu plan está pago hasta el ${date ? formatDay(date) : 'próximamente'}. Pagá el próximo mes para no perder el servicio.`,
    cta: 'Pagar el próximo mes',
    type: 'SUBSCRIPTION_EXPIRING',
  }),
  renewal_1: (date) => ({
    title: 'Tu plan vence mañana',
    detail: `Tu plan vence el ${date ? formatDay(date) : 'mañana'}. Si no pagás, la cuenta queda 7 días con el pago pendiente y después pasa al plan Gratuito.`,
    cta: 'Pagar ahora',
    type: 'SUBSCRIPTION_EXPIRING',
  }),
  past_due: () => ({
    title: 'Tu suscripción tiene el pago pendiente',
    detail: 'Mientras tanto no podés sumar usuarios, productos ni sucursales por encima del plan Gratuito. En 7 días la cuenta pasa al plan Gratuito si no se regulariza.',
    cta: 'Regularizar el pago',
    type: 'SUBSCRIPTION_PAYMENT_FAILED',
  }),
  downgraded: () => ({
    title: 'Tu cuenta pasó al plan Gratuito',
    detail: 'Como no se registró el pago, tu cuenta pasó al plan Gratuito. Tu historial se conserva y podés volver a tu plan cuando quieras.',
    cta: 'Volver a mi plan',
    type: 'PLAN_CHANGED',
  }),
}

async function organizationContact(organizationId: string) {
  const admin = createAdminSupabase()
  const [{ data: organization }, { data: billing }] = await Promise.all([
    admin.from('organizations').select('name, email, logo_url').eq('id', organizationId).maybeSingle(),
    admin.from('billing_profiles').select('billing_email').eq('organization_id', organizationId).maybeSingle(),
  ])
  return {
    name: organization?.name || 'tu comercio',
    email: billing?.billing_email || organization?.email || null,
    logoUrl: organization?.logo_url ?? undefined,
  }
}

/** true si es la primera vez; false si ya se había mandado. */
async function recordOnce(organizationId: string, kind: string, periodKey: string) {
  const { error } = await createAdminSupabase()
    .from('subscription_reminders_sent')
    .insert({ organization_id: organizationId, kind, period_key: periodKey })
  if (!error) return true
  if (error.code === '23505') return false
  throw new Error(`No se pudo registrar el aviso: ${error.message}`)
}

async function deliver(params: {
  organizationId: string
  kind: string
  periodKey: string
  title: string
  detail: string
  cta: string
  type: NotificationType
}) {
  const contact = await organizationContact(params.organizationId)
  const manageUrl = `${appUrl()}/admin/subscriptions#pay`
  if (contact.email) {
    const result = await sendEmail({
      to: contact.email,
      subject: params.title,
      html: renderSubscriptionNoticeEmail({
        title: params.title,
        preview: params.detail,
        intro: `Hola, te escribimos por la suscripción de "${contact.name}".`,
        detail: params.detail,
        ctaLabel: params.cta,
        manageUrl,
        brand: { name: contact.name, logoUrl: contact.logoUrl },
      }),
      log: { organizationId: params.organizationId },
    })
    if (!result.ok && !result.skipped) throw new Error(result.error || 'No se pudo enviar el correo.')
  }
  await dispatchNotificationEvent({
    organizationId: params.organizationId,
    type: params.type,
    resourceType: 'subscription',
    data: { message: params.detail },
    idempotencyKey: `${params.kind}:${params.periodKey}`,
  })
}

export async function sendSubscriptionReminders(now = Date.now()): Promise<ReminderResult> {
  const result: ReminderResult = { sent: 0, skipped: 0, failed: 0 }
  const { data, error } = await createAdminSupabase()
    .from('subscriptions')
    .select('organization_id, plan, status, payment_status, trial_ends_at, current_period_ends_at, cancel_at_period_end, updated_at')
    .in('status', ['trialing', 'active', 'past_due'])
  if (error) throw new Error(`No se pudieron leer las suscripciones: ${error.message}`)

  for (const row of (data ?? []) as SubscriptionRow[]) {
    const reminder = reminderFor(row, now)
    if (!reminder) continue
    try {
      if (!(await recordOnce(row.organization_id, reminder.kind, reminder.periodKey))) {
        result.skipped += 1
        continue
      }
      const copy = NOTICE_COPY[reminder.kind](reminder.date)
      await deliver({ organizationId: row.organization_id, kind: reminder.kind, periodKey: reminder.periodKey, title: copy.title, detail: copy.detail, cta: copy.cta, type: copy.type })
      result.sent += 1
    } catch (sendError) {
      console.error('[subscription-notices] Falló un aviso', { organizationId: row.organization_id, kind: reminder.kind, sendError })
      result.failed += 1
    }
  }
  return result
}

/** Recibo de un pago aplicado. Se manda una sola vez aunque Pagopar reintente. */
export async function sendSubscriptionPaymentReceipt(paymentId: string) {
  try {
    const admin = createAdminSupabase()
    const { data: payment } = await admin
      .from('subscription_payments')
      .select('id, organization_id, plan_id, amount, payment_method, paid_at, status, external_reference')
      .eq('id', paymentId)
      .maybeSingle()
    if (!payment || payment.status !== 'paid' || !payment.paid_at) return
    if (!(await recordOnce(payment.organization_id, 'receipt', payment.id))) return

    const [{ data: plan }, { data: subscription }, contact] = await Promise.all([
      admin.from('subscription_plans').select('name').eq('tier', String(payment.plan_id || '').toLowerCase()).maybeSingle(),
      admin.from('subscriptions').select('current_period_ends_at').eq('organization_id', payment.organization_id).maybeSingle(),
      organizationContact(payment.organization_id),
    ])
    const planName = plan?.name || payment.plan_id || 'tu plan'
    if (contact.email) {
      await sendEmail({
        to: contact.email,
        subject: `Recibimos tu pago del plan ${planName}`,
        html: renderSubscriptionReceiptEmail({
          companyName: contact.name,
          planName,
          amountPyg: Number(payment.amount),
          method: payment.payment_method || 'Pago',
          paidAt: payment.paid_at,
          periodEndsAt: subscription?.current_period_ends_at ?? null,
          reference: String(payment.external_reference || payment.id).slice(-12),
          manageUrl: `${appUrl()}/admin/subscriptions#payments`,
          brand: { name: contact.name, logoUrl: contact.logoUrl },
        }),
        log: { organizationId: payment.organization_id },
      })
    }
    await dispatchNotificationEvent({
      organizationId: payment.organization_id,
      type: 'PLAN_CHANGED',
      resourceType: 'subscription',
      data: { message: `Recibimos el pago del plan ${planName}.` },
      idempotencyKey: `receipt:${payment.id}`,
    })
  } catch (error) {
    console.error('[subscription-notices] No se pudo mandar el recibo', { paymentId, error })
  }
}

/** Reversión o contracargo: avisa al comercio y a los superadmin. */
export async function notifySubscriptionChargeback(payment: { id: string; organization_id: string; amount: number }) {
  try {
    const admin = createAdminSupabase()
    const [contact, { data: superAdmins }] = await Promise.all([
      organizationContact(payment.organization_id),
      admin.from('profiles').select('email').eq('role', 'super_admin').neq('status', 'inactive'),
    ])
    const detail = 'Pagopar informó que el último pago de la suscripción fue revertido. La cuenta quedó con el pago pendiente: tenés 7 días para volver a pagar antes de pasar al plan Gratuito.'
    await deliver({
      organizationId: payment.organization_id,
      kind: 'chargeback',
      periodKey: payment.id,
      title: 'Se revirtió el pago de tu suscripción',
      detail,
      cta: 'Volver a pagar',
      type: 'SUBSCRIPTION_PAYMENT_FAILED',
    })
    const to = (superAdmins ?? []).map((row) => row.email).filter((email): email is string => Boolean(email))
    if (to.length > 0) {
      await sendEmail({
        to,
        subject: `Contracargo de ${contact.name}`,
        html: renderSubscriptionNoticeEmail({
          title: 'Contracargo registrado',
          preview: `Se revirtió un pago de ${contact.name}.`,
          intro: `Pagopar informó la reversión de un pago de "${contact.name}" por ${new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(Number(payment.amount))}.`,
          detail: 'El pago quedó marcado como reembolsado y la suscripción pasó a pago pendiente.',
          ctaLabel: 'Ver pagos',
          manageUrl: `${appUrl()}/superadmin/invoices`,
        }),
      })
    }
  } catch (error) {
    console.error('[subscription-notices] No se pudo avisar el contracargo', { paymentId: payment.id, error })
  }
}
