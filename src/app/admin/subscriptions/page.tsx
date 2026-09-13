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
import { PagoparPaymentButton } from '@/components/admin/subscriptions/PagoparPaymentButton'
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

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  children,
}: {
  label: string
  value: string
  hint?: string
  icon: typeof Gauge
  tone?: SubscriptionTone
  children?: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" />
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
  const averageUsage = averageUsagePercent(state.currentPlan, state.usage)

  const paymentProvider = subscription?.provider === 'pagopar'
    ? 'Pagopar'
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
      <header className="rounded-3xl border border-border bg-card p-5 shadow-2xs sm:p-6">
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

          <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:min-w-[18rem]">
            <PagoparPaymentButton
              missingFields={billingMissingFields}
              isPaidPlan={state.currentPlan.price_monthly > 0}
              planName={state.currentPlan.name}
              planAmount={money(state.currentPlan.price_monthly, state.currentPlan.currency)}
            />
            {canChangePlan && (
              <Button asChild variant="outline" className="h-11 w-full gap-2 rounded-xl font-semibold">
                <Link href="/admin/subscriptions/change-plan">
                  <ArrowUpRight className="h-4 w-4 text-primary" />
                  Cambiar de plan
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
            tone={renewalTone}
          />

          <MetricCard
            label="Uso de cupos"
            value={`${averageUsage}%`}
            hint="Promedio de los cupos con tope"
            icon={Gauge}
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
        <section className="rounded-2xl border border-border bg-muted/30 p-4">
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
