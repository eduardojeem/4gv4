import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CreditCard,
  Gauge,
  Info,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import {
  getCurrentOrganizationSubscription,
  getProductGraceStatus,
  type BillingProfile,
  type ProductGraceStatus,
} from '@/lib/saas/subscription-service'
import {
  averageUsagePercent,
  daysUntil,
  formatDate,
  money,
  quotaTone,
  subscriptionStatusLabel,
  subscriptionStatusTone,
  TONE_BADGE,
  TONE_DOT,
  TONE_TEXT,
  type SubscriptionTone,
} from '@/lib/saas/subscription-ui'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SubscriptionPaymentPanel } from '@/components/admin/subscriptions/SubscriptionPaymentPanel'
import { isStripeCheckoutEnabled } from '@/lib/payments/stripe'
import {
  applySubscriptionDiscount,
  describeSubscriptionDiscount,
  findAvailableSubscriptionDiscount,
} from '@/lib/saas/subscription-discount'
import { isPagoparRecurringEnabled } from '@/lib/payments/pagopar-recurring'
import { SubscriptionCancellation } from '@/components/admin/subscriptions/SubscriptionCancellation'
import { SubscriptionsClientView } from '@/components/admin/subscriptions/SubscriptionsClientView'

function getBillingMissingFields(profile: BillingProfile | null) {
  const missing: string[] = []
  const ruc = profile?.ruc?.replace(/[^\d]/g, '') || ''

  if (!profile?.business_name?.trim()) missing.push('Razón social')
  if (!ruc) missing.push('RUC o CI')
  if (!profile?.billing_email?.trim()) missing.push('Correo de facturación')
  if (!profile?.phone?.trim()) missing.push('Teléfono')
  if (!profile?.fiscal_address?.trim()) missing.push('Dirección fiscal')

  return missing
}

type Notice = { id: string; tone: 'warn' | 'danger'; title: string; body: string }

/**
 * Todo lo que pide atencion, en una sola pila y ordenado por gravedad.
 *
 * Antes los avisos salian en tres lugares distintos —dentro del encabezado, en
 * tarjetas sueltas debajo y en la columna de botones— y el de renovacion se
 * mostraba aunque la baja ya estuviera programada, pidiendo revisar un metodo
 * de pago que ya no se iba a cobrar.
 */
function buildNotices({
  status,
  periodEnd,
  cancelScheduled,
  limitsAreFallback,
  planCode,
  productGrace,
}: {
  status?: string | null
  periodEnd?: string | null
  cancelScheduled: boolean
  limitsAreFallback: boolean
  planCode: string
  productGrace: ProductGraceStatus | null
}): Notice[] {
  const notices: Notice[] = []

  if (productGrace) {
    notices.push({
      id: 'grace',
      tone: productGrace.stage === 'archived' ? 'danger' : 'warn',
      title:
        productGrace.stage === 'grace'
          ? `Tenés ${productGrace.daysLeft} ${productGrace.daysLeft === 1 ? 'día' : 'días'} para ampliar el plan y mantener todos tus productos`
          : productGrace.stage === 'deactivated'
            ? `${productGrace.excessProducts} productos quedaron desactivados por el límite de tu plan`
            : 'Los productos que excedían el límite de tu plan fueron archivados',
      body:
        productGrace.stage === 'grace'
          ? `Al abrirse este ciclo tenías ${productGrace.activeProducts} productos activos y tu plan permite ${productGrace.productLimit}. Si no lo regularizás, solo se mantendrán activos tus ${productGrace.productLimit} productos más vendidos.`
          : productGrace.stage === 'deactivated'
            ? `Te ${productGrace.daysLeft === 1 ? 'queda' : 'quedan'} ${productGrace.daysLeft} ${productGrace.daysLeft === 1 ? 'día' : 'días'} para recuperarlos: al ampliar el plan se reactivan automáticamente.`
            : 'Se conservan los productos que entran dentro del límite de tu plan actual. Tu historial de ventas y reportes no se vieron afectados.',
    })
  }

  if (status && ['past_due', 'suspended', 'cancelled', 'canceled', 'expired', 'unpaid'].includes(status)) {
    notices.push({
      id: 'status',
      tone: 'danger',
      title: `La suscripción está en estado «${subscriptionStatusLabel(status)}»`,
      body: 'Regularizá el pago para conservar los límites y los módulos de tu plan.',
    })
  }

  const daysLeft = daysUntil(periodEnd)
  if (daysLeft !== null && !cancelScheduled) {
    if (daysLeft < 0) {
      notices.push({
        id: 'period',
        tone: 'danger',
        title: `Tu plan venció hace ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'día' : 'días'}`,
        body: 'Regularizá el pago para conservar los límites de tu plan.',
      })
    } else if (daysLeft <= 7) {
      notices.push({
        id: 'period',
        tone: 'warn',
        title:
          daysLeft === 0
            ? 'Tu plan se renueva hoy'
            : `Tu plan se renueva en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`,
        body: `Verificá que el método de pago esté al día para no perder el servicio el ${formatDate(periodEnd)}.`,
      })
    }
  }

  if (limitsAreFallback) {
    notices.push({
      id: 'fallback',
      tone: 'warn',
      title: 'No pudimos leer la configuración de tu plan',
      body: `Se están aplicando los cupos por defecto de ${planCode}. Si notás límites distintos a los contratados, avisanos para revisarlo.`,
    })
  }

  return notices.sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'danger' ? -1 : 1))
}

/** Cada métrica con su color de ícono, para distinguirlas de un vistazo en claro y oscuro. */
const METRIC_ACCENT = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
} as const

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  accent,
  children,
}: {
  label: string
  value: string
  hint?: string
  icon: typeof Gauge
  tone?: SubscriptionTone
  accent: keyof typeof METRIC_ACCENT
  children?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-background/80 p-4 shadow-2xs dark:bg-background/40">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', METRIC_ACCENT[accent])}>
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="text-[11px] font-bold uppercase tracking-wider">{label}</p>
      </div>
      <p className={cn('mt-2 truncate text-xl font-extrabold tracking-tight', TONE_TEXT[tone])}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  )
}

export default async function AdminSubscriptionsPage() {
  const auth = await resolveRequestAuthUser()
  if (!auth.authenticated || !auth.user) return redirect('/login')

  const organization = await getCurrentOrganizationContext(auth.user.id)
  if (!organization || !['owner', 'admin'].includes(organization.role)) redirect('/forbidden')

  const state = await getCurrentOrganizationSubscription(organization.id)
  const productGrace = await getProductGraceStatus(organization.id)

  const subscription = state.subscription
  const billingMissingFields = getBillingMissingFields(state.billingProfile)
  const subscriptionStatus = subscription?.status || 'sin_estado'
  const paymentStatus = subscription?.payment_status || 'manual'
  const cancelScheduled = subscription?.cancel_at_period_end === true
  const periodEnd = subscription?.current_period_ends_at || subscription?.trial_ends_at || null
  const daysLeft = daysUntil(periodEnd)
  const canChangePlan = organization.role === 'owner'
  const isPaidPlan = state.currentPlan.price_monthly > 0
  // Cupón de descuento canjeado: se muestra el mismo monto que se va a cobrar.
  const discount = isPaidPlan ? await findAvailableSubscriptionDiscount(organization.id, state.currentPlan.code) : null
  const regularAmount = money(state.currentPlan.price_monthly, state.currentPlan.currency)
  const averageUsage = averageUsagePercent(state.currentPlan, state.usage)

  const paymentProvider = subscription?.provider === 'pagopar'
    ? 'Pagopar'
    : subscription?.provider === 'stripe'
      ? 'Stripe'
      : subscription?.provider === 'mercado_pago'
        ? 'Mercado Pago'
        : 'Pago manual'

  const notices = buildNotices({
    status: subscriptionStatus,
    periodEnd,
    cancelScheduled,
    limitsAreFallback: state.currentPlan.limits_are_fallback === true,
    planCode: state.currentPlan.code,
    productGrace,
  })

  const statusTone = subscriptionStatusTone(subscriptionStatus)
  // La renovacion solo es «buena noticia» si todavia falta. Si ya vencio, o si
  // la baja esta programada, el numero tiene que avisar por si solo.
  const renewalTone: SubscriptionTone = cancelScheduled
    ? 'warn'
    : daysLeft === null
      ? 'neutral'
      : daysLeft < 0
        ? 'danger'
        : daysLeft <= 3
          ? 'danger'
          : daysLeft <= 7
            ? 'warn'
            : 'ok'

  return (
    <div className="space-y-6 pb-12">
      {/* ── Encabezado ───────────────────────────────────────────────────── */}
      <header className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-card to-card p-5 shadow-sm sm:p-6 dark:border-primary/30 dark:from-primary/[0.14]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
                <CreditCard className="h-3.5 w-3.5" />
                Suscripción
              </span>
              <Badge variant="outline" className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-bold', TONE_BADGE[statusTone])}>
                <span className={cn('mr-1.5 inline-block h-1.5 w-1.5 rounded-full', TONE_DOT[statusTone])} />
                {subscriptionStatusLabel(subscriptionStatus)}
              </Badge>
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
              Suscripción y facturación
            </h1>

            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4 shrink-0 text-primary" />
              <span className="truncate">
                {organization.name} · plan <strong className="font-semibold text-foreground">{state.currentPlan.name}</strong>
              </span>
            </p>
          </div>

          {/* Solo acciones cortas: pagar tiene su propio bloque debajo de los
              avisos, y antes estiraba esta columna dejando un hueco a la izquierda. */}
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
            {isPaidPlan && (
              <Button asChild className="h-10 gap-2 rounded-xl font-semibold">
                <a href="#pay">
                  <Wallet className="h-4 w-4" />
                  Pagar
                </a>
              </Button>
            )}
            {canChangePlan && (
              <Button asChild variant="outline" className="h-10 gap-2 rounded-xl font-semibold">
                <Link href="/admin/subscriptions/change-plan">
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                  Cambiar de plan
                </Link>
              </Button>
            )}
            {canChangePlan && isPagoparRecurringEnabled() && (
              <Button asChild variant="outline" className="h-10 gap-2 rounded-xl font-semibold">
                <Link href="/admin/subscriptions/autopay">
                  <RefreshCw className="h-4 w-4 text-primary" />
                  Débito automático
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* ── Los cuatro numeros que importan ─────────────────────────────── */}
        <div className="mt-6 grid gap-3 border-t border-border pt-5 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Plan actual"
            value={state.currentPlan.name}
            hint={
              state.currentPlan.price_monthly > 0
                ? `${money(state.currentPlan.price_monthly, state.currentPlan.currency)} por mes`
                : state.currentPlan.price_note || 'Sin costo mensual'
            }
            icon={CreditCard}
            accent="blue"
          />

          <MetricCard
            label={cancelScheduled ? 'Cancelación programada' : daysLeft !== null && daysLeft < 0 ? 'Vencimiento' : 'Próxima renovación'}
            value={
              daysLeft === null
                ? 'Sin fecha'
                : daysLeft < 0
                  ? `Venció hace ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'día' : 'días'}`
                  : daysLeft === 0
                    ? 'Hoy'
                    : `En ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`
            }
            hint={
              daysLeft === null
                ? 'Sin fecha configurada'
                : cancelScheduled
                  ? `Pasa a Gratuito el ${formatDate(periodEnd)}`
                  : formatDate(periodEnd)
            }
            icon={CalendarClock}
            accent="violet"
            tone={renewalTone}
          />

          <MetricCard
            label="Uso de cupos"
            value={`${averageUsage}%`}
            hint="Promedio de los cupos con tope"
            icon={Gauge}
            accent="amber"
            tone={quotaTone(averageUsage)}
          >
            <div
              className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={averageUsage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Uso promedio de cupos"
            >
              <div
                className={cn('h-full rounded-full transition-all', TONE_DOT[quotaTone(averageUsage)])}
                style={{ width: `${averageUsage}%` }}
              />
            </div>
          </MetricCard>

          <MetricCard
            label="Cobro"
            value={paymentProvider}
            hint={subscriptionStatusLabel(paymentStatus)}
            icon={CreditCard}
            accent="emerald"
            tone={subscriptionStatusTone(paymentStatus)}
          />
        </div>
      </header>

      {/* ── Lo que pide atencion ─────────────────────────────────────────── */}
      {notices.length > 0 && (
        <section aria-label="Avisos de la suscripción" className="grid gap-3 lg:grid-cols-2">
          {notices.map((notice) => (
            <div
              key={notice.id}
              role="alert"
              className={cn(
                'flex items-start gap-3 rounded-2xl border p-4 shadow-2xs',
                notice.tone === 'danger'
                  ? 'border-rose-200 bg-rose-50/80 dark:border-rose-900/60 dark:bg-rose-950/30'
                  : 'border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/30'
              )}
            >
              <AlertTriangle
                className={cn(
                  'mt-0.5 h-5 w-5 shrink-0',
                  notice.tone === 'danger' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
                )}
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">{notice.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{notice.body}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Pagar: tarjeta, QR y transferencia en un solo lugar ──────────── */}
      <SubscriptionPaymentPanel
        missingFields={billingMissingFields}
        isPaidPlan={isPaidPlan}
        planName={state.currentPlan.name}
        planAmount={discount ? money(applySubscriptionDiscount(state.currentPlan.price_monthly, discount), state.currentPlan.currency) : regularAmount}
        discountNote={discount ? `${describeSubscriptionDiscount(discount)} con tarjeta o QR · precio normal ${regularAmount}` : undefined}
        stripeEnabled={isStripeCheckoutEnabled()}
        canPayByTransfer
      />

      {/* ── Cupos, planes, pagos y datos fiscales ────────────────────────── */}
      <SubscriptionsClientView
        currentPlan={state.currentPlan}
        usage={state.usage}
        plans={state.plans}
        payments={state.payments}
        promoRedemptions={state.promoRedemptions}
        billingProfile={state.billingProfile}
        subscriptionStatus={subscriptionStatus}
        canChangePlan={canChangePlan}
        canRedeemCodes={['owner', 'admin'].includes(organization.role)}
        averageUsage={averageUsage}
      />

      {/* ── Dar de baja ──────────────────────────────────────────────────── */}
      {/* Va al final y a lo ancho: el aviso de baja programada traia su propio
          cartel y antes se dibujaba dentro de la columna angosta de botones. */}
      {cancelScheduled ? (
        <SubscriptionCancellation
          isFreePlan={state.currentPlan.price_monthly <= 0}
          cancelAtPeriodEnd
          periodEndDate={subscription?.current_period_ends_at ?? subscription?.trial_ends_at ?? null}
          currentPlanName={state.currentPlan.name}
        />
      ) : state.currentPlan.price_monthly > 0 ? (
        <section className="rounded-2xl border border-rose-200/70 bg-rose-50/40 p-4 dark:border-rose-900/40 dark:bg-rose-950/15">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="max-w-xl leading-relaxed">
                Al cancelar, tu organización pasa al plan Gratuito cuando termina el período ya pagado. No se pierde el
                historial de ventas ni los reportes.
              </p>
            </div>
            <div className="shrink-0">
              <SubscriptionCancellation
                isFreePlan={false}
                cancelAtPeriodEnd={false}
                periodEndDate={subscription?.current_period_ends_at ?? subscription?.trial_ends_at ?? null}
                currentPlanName={state.currentPlan.name}
              />
            </div>
          </div>
        </section>
      ) : null}
    </div>
  )
}
