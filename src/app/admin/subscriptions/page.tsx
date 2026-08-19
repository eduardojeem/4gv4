import type { ElementType } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  ExternalLink,
  Package,
  Receipt,
  ShoppingBag,
  Users,
  Info,
  KeyRound,
  Tag,
  TicketPercent,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  Settings2,
  Layers,
  HelpCircle,
} from 'lucide-react'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import {
  getCurrentOrganizationSubscription,
  getProductGraceStatus,
  getPlanLimit,
  type BillingProfile,
  type OrganizationUsage,
  type PlanRecord,
  type SubscriptionPayment,
} from '@/lib/saas/subscription-service'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { BillingProfileForm } from '@/components/admin/subscriptions/BillingProfileForm'
import { PagoparPaymentButton } from '@/components/admin/subscriptions/PagoparPaymentButton'
import { PlansComparison, type PlanRow } from '@/components/admin/subscriptions/PlansComparison'
import { PromoCodeRedeemer } from '@/components/admin/subscriptions/PromoCodeRedeemer'
import { SubscriptionCancellation } from '@/components/admin/subscriptions/SubscriptionCancellation'

const statusLabels: Record<string, string> = {
  active: 'Activo',
  trialing: 'Prueba',
  past_due: 'Pago vencido',
  suspended: 'Suspendido',
  cancelled: 'Cancelado',
  canceled: 'Cancelado',
  expired: 'Expirado',
  unpaid: 'Impago',
  manual: 'Manual',
  paid: 'Pagado',
  pending: 'Pendiente',
  failed: 'Fallido',
  refunded: 'Reembolsado',
  sin_estado: 'Sin estado',
}

const resources: Array<{ key: keyof OrganizationUsage; label: string; icon: ElementType }> = [
  { key: 'users', label: 'Usuarios', icon: Users },
  { key: 'branches', label: 'Sucursales', icon: Building2 },
  { key: 'cashRegisters', label: 'Cajas', icon: CreditCard },
  { key: 'products', label: 'Productos', icon: Package },
  { key: 'categories', label: 'Categorias', icon: ShoppingBag },
]

function money(value: number, currency: string) {
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

function date(value?: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(new Date(value))
}

function getPaymentModality(
  payment: SubscriptionPayment,
  promoRedemptions?: Array<{ benefit_snapshot?: Record<string, unknown> | null }>
) {
  const method = (payment.payment_method || '').toLowerCase()
  const provider = (payment.provider || '').toLowerCase()
  const ref = (payment.external_reference || '').toLowerCase()

  const isActivation =
    method.includes('activation') ||
    provider.includes('activation') ||
    method.includes('voucher') ||
    provider.includes('voucher')

  const matchingRedemption = isActivation || payment.external_reference
    ? promoRedemptions?.find((r) => r.benefit_snapshot?.code === payment.external_reference)
    : null

  const benefitType = (matchingRedemption?.benefit_snapshot?.benefit_type as string | undefined)?.toLowerCase()

  // 1. Código de Activación / Voucher
  if (isActivation || benefitType === 'activate_plan' || benefitType === 'extend_trial' || benefitType === 'extend_period') {
    return {
      type: 'activation_code' as const,
      label: 'Código de Activación',
      badgeClass: 'bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800',
      icon: KeyRound,
      matchingRedemption,
    }
  }

  // 2. Cupón de Descuento Promocional
  if (method.includes('coupon') || method.includes('promo') || provider.includes('coupon') || benefitType?.includes('discount')) {
    return {
      type: 'coupon' as const,
      label: 'Cupón de Descuento',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      icon: Tag,
      matchingRedemption,
    }
  }

  // 3. Activación Manual / Asignación por Administrador o Transferencia Directa
  if (
    method.includes('manual') ||
    provider.includes('manual') ||
    method.includes('admin') ||
    provider.includes('admin') ||
    method.includes('transfer') ||
    method.includes('banc') ||
    method.includes('efectivo') ||
    method.includes('cash') ||
    ref.includes('manual') ||
    ref.includes('transfer')
  ) {
    return {
      type: 'manual_admin' as const,
      label: 'Activación Manual / Admin',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
      icon: ShieldCheck,
      matchingRedemption: null,
    }
  }

  // 4. Período de Prueba / Cortesía / Onboarding
  if (
    method.includes('trial') ||
    provider.includes('trial') ||
    method.includes('courtesy') ||
    provider.includes('courtesy') ||
    method.includes('welcome') ||
    (payment.amount === 0 && !isActivation)
  ) {
    return {
      type: 'trial_courtesy' as const,
      label: 'Prueba / Cortesía',
      badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200/80 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800',
      icon: Sparkles,
      matchingRedemption: null,
    }
  }

  // 5. Ajuste / Migración de Sistema
  if (
    method.includes('migration') ||
    provider.includes('migration') ||
    method.includes('system') ||
    provider.includes('system') ||
    method.includes('legacy')
  ) {
    return {
      type: 'system_migration' as const,
      label: 'Ajuste / Migración',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      icon: Settings2,
      matchingRedemption: null,
    }
  }

  // 6. Pago Normal mediante Pasarela Online (Pagopar, Tarjeta, etc.)
  return {
    type: 'normal' as const,
    label: 'Pago Normal (Pasarela)',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
    icon: CreditCard,
    matchingRedemption: null,
  }
}

function getBillingMissingFields(profile: BillingProfile | null) {
  const missing: string[] = []
  const ruc = profile?.ruc?.replace(/[^\d]/g, '') || ''

  if (!profile?.business_name?.trim()) missing.push('Razon social')
  if (!ruc) missing.push('RUC o CI')
  if (!profile?.billing_email?.trim()) missing.push('Correo de facturacion')
  if (!profile?.phone?.trim()) missing.push('Telefono')
  if (!profile?.fiscal_address?.trim()) missing.push('Direccion fiscal')

  return missing
}

function limitText(limit: number | null) {
  return limit === null ? 'Ilimitado' : String(limit)
}

function getRedemptionDetailText(benefit: Record<string, unknown> | null | undefined) {
  if (!benefit) return ''
  const type = String(benefit.benefit_type || '')
  const unit = benefit.duration_unit === 'months' ? 'meses' : 'días'
  const durationDays = Number(benefit.duration_days || 0)
  const durationText = durationDays > 0 ? `${durationDays} ${unit}` : ''

  if (type === 'activate_plan') {
    return `Activación de plan ${String(benefit.target_plan || '')} por ${durationText}`
  }
  if (type === 'extend_trial') {
    return `Extensión de prueba por ${durationText}`
  }
  if (type === 'extend_period') {
    return `Extensión de período por ${durationText}`
  }
  if (type === 'discount_percent') {
    return `Descuento de ${Number(benefit.discount_percent || 0)}%`
  }
  if (type === 'discount_fixed') {
    return `Descuento de ${money(Number(benefit.discount_amount || 0), 'PYG')}`
  }
  return 'Beneficio promocional aplicado'
}

function usagePercent(current: number, limit: number | null) {
  if (limit === null || limit <= 0) return 0
  return Math.min(100, Math.round((current / limit) * 100))
}

function feature(plan: PlanRecord, key: string) {
  // 1. Check if features is a key-value object map
  if (plan.features && !Array.isArray(plan.features)) {
    const value = plan.features[key]
    if (typeof value === 'boolean') return value ? 'Incluido' : 'No incluido'
    if (typeof value === 'string') return value
  }

  // 2. Check if features is a JSON array of objects
  if (Array.isArray(plan.features)) {
    const found = plan.features.find((item) => {
      const f = item && typeof item === 'object' ? item as Record<string, unknown> : {}
      const label = String(f?.label || '').toLowerCase()
      if (key === 'marketplace') {
        return label.includes('marketplace') || label.includes('ecommerce')
      }
      if (key === 'analytics') {
        return label.includes('analytics') || label.includes('analítica') || label.includes('analysis')
      }
      if (key === 'credits') {
        return label.includes('crédito') || label.includes('cuota')
      }
      return label.includes(key.toLowerCase())
    })

    if (found) {
      if (typeof found.value === 'boolean') return found.value ? 'Incluido' : 'No incluido'
      if (typeof found.value === 'string') return found.value
    }
  }

  // 3. Fallback to modules
  return plan.modules.includes(key) ? 'Incluido' : 'No incluido'
}

function statusTone(status?: string | null) {
  if (status === 'active' || status === 'paid') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300'
  }
  if (status === 'trialing') {
    return 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/30 dark:text-cyan-300'
  }
  if (status === 'past_due' || status === 'pending') {
    return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-300'
  }
  if (status === 'suspended' || status === 'unpaid' || status === 'failed') {
    return 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300'
  }
  if (status === 'cancelled' || status === 'canceled' || status === 'expired' || status === 'refunded') {
    return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
  }
  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
}

function progressColor(percent: number) {
  if (percent >= 90) return '#dc2626'
  if (percent >= 80) return '#f59e0b'
  return '#059669'
}

function currentTimestamp() {
  return Date.now()
}

function buildAlerts(state: Awaited<ReturnType<typeof getCurrentOrganizationSubscription>>) {
  const alerts: string[] = []
  const status = state.subscription?.status
  const periodEnd = state.subscription?.current_period_ends_at || state.subscription?.trial_ends_at

  if (status && ['past_due', 'suspended', 'cancelled', 'canceled', 'expired', 'unpaid'].includes(status)) {
    alerts.push(`El estado de la suscripción requiere atención: ${statusLabels[status] || status}.`)
  }

  if (periodEnd) {
    const daysLeft = Math.ceil((new Date(periodEnd).getTime() - Date.now()) / 86400000)
    if (daysLeft < 0) {
      alerts.push(
        `Tu plan venció hace ${Math.abs(daysLeft)} ${Math.abs(daysLeft) === 1 ? 'día' : 'días'}. Regularizá el pago para conservar los límites de tu plan.`
      )
    } else if (daysLeft === 0) {
      alerts.push('Tu plan se renueva hoy. Verificá que el método de pago esté al día.')
    } else if (daysLeft <= 7) {
      alerts.push(
        `Tu plan se renueva en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}. Verificá que el método de pago esté al día.`
      )
    }
  }

  // Usage alerts are already communicated via progress bars — omit here to avoid duplication

  return alerts
}

export default async function AdminSubscriptionsPage() {
  const auth = await resolveRequestAuthUser()
  if ('reason' in auth) redirect('/login')

  const organization = await getCurrentOrganizationContext(auth.user.id)
  if (!organization || !['owner', 'admin'].includes(organization.role)) redirect('/forbidden')

  const state = await getCurrentOrganizationSubscription(organization.id)
  const productGrace = await getProductGraceStatus(organization.id)
  const alerts = buildAlerts(state)
  const billingMissingFields = getBillingMissingFields(state.billingProfile)
  const subscription = state.subscription
  const nextDate = subscription?.current_period_ends_at || subscription?.trial_ends_at
  const subscriptionStatus = subscription?.status || 'sin_estado'
  const paymentStatus = subscription?.payment_status || 'manual'
  const paymentProvider = subscription?.provider === 'pagopar'
    ? 'Pagopar'
    : subscription?.provider === 'mercado_pago'
      ? 'Mercado Pago'
      : 'Pago manual'
  const canChangePlan = organization.role === 'owner'
  const periodEnd = nextDate ? new Date(nextDate) : null
  const daysLeft = periodEnd ? Math.ceil((periodEnd.getTime() - currentTimestamp()) / 86400000) : null
  const usedLimits = resources
    .map((resource) => {
      const limit = getPlanLimit(state.currentPlan, resource.key)
      return limit === null ? null : usagePercent(state.usage[resource.key], limit)
    })
    .filter((percent): percent is number => percent !== null)
  const averageUsage = usedLimits.length ? Math.round(usedLimits.reduce((sum, percent) => sum + percent, 0) / usedLimits.length) : 0

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl dark:border-slate-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.25),rgba(255,255,255,0))] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-4 max-w-3xl">
            {/* Title & Badge */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 text-indigo-200 backdrop-blur-md border border-white/15">
                <CreditCard className="h-3.5 w-3.5 text-indigo-400" />
                Administración SaaS
              </span>
              <Badge className={cn('rounded-full px-3 py-1 text-xs font-bold border-0 shadow-xs', statusTone(subscriptionStatus))}>
                <span className="relative flex h-2 w-2 mr-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
                </span>
                {statusLabels[subscriptionStatus] || subscriptionStatus}
              </Badge>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Suscripción & Facturación
              </h1>
              <p className="text-sm font-medium text-slate-300 mt-1 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-indigo-300" />
                Organización: <span className="font-bold text-white">{organization.name}</span>
              </p>
            </div>

            {/* Grace / Warning notifications */}
            {productGrace && (
              <div
                role="alert"
                className={cn(
                  'rounded-2xl border px-4 py-3.5 text-sm backdrop-blur-md transition-all',
                  productGrace.stage === 'archived'
                    ? 'border-red-500/40 bg-red-950/40 text-red-100'
                    : 'border-amber-500/40 bg-amber-950/40 text-amber-100'
                )}
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className={cn('h-5 w-5 shrink-0 mt-0.5', productGrace.stage === 'archived' ? 'text-red-400' : 'text-amber-400')} />
                  <div>
                    <p className="font-bold">
                      {productGrace.stage === 'grace'
                        ? `Tenés ${productGrace.daysLeft} ${productGrace.daysLeft === 1 ? 'día' : 'días'} para actualizar tu plan y mantener todos tus productos activos`
                        : productGrace.stage === 'deactivated'
                          ? `${productGrace.excessProducts} productos quedaron desactivados por el límite de tu plan`
                          : 'Los productos que excedían el límite de tu plan fueron archivados'}
                    </p>
                    <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                      {productGrace.stage === 'grace'
                        ? `Tu catálogo tiene ${productGrace.activeProducts} productos activos y tu plan permite ${productGrace.productLimit}. Si no regularizás, solo se mantendrán activos tus ${productGrace.productLimit} productos más vendidos.`
                        : productGrace.stage === 'deactivated'
                          ? `Te ${productGrace.daysLeft === 1 ? 'queda' : 'quedan'} ${productGrace.daysLeft} ${productGrace.daysLeft === 1 ? 'día' : 'días'} para recuperarlos: al actualizar el plan se reactivan automáticamente.`
                          : 'Se conservan los productos que entran dentro del límite de tu plan actual. Tu historial de ventas y reportes no se vieron afectados.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {state.currentPlan.limits_are_fallback && (
              <div
                role="alert"
                className="rounded-2xl border border-amber-500/40 bg-amber-950/40 px-4 py-3.5 text-sm text-amber-100 backdrop-blur-md"
              >
                <p className="font-bold">
                  No pudimos leer la configuración de tu plan
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Se están aplicando los cupos por defecto de {state.currentPlan.code}. Si notás
                  límites distintos a los contratados, avisanos para revisarlo.
                </p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <PagoparPaymentButton
              missingFields={billingMissingFields}
              isPaidPlan={state.currentPlan.price_monthly > 0}
              planName={state.currentPlan.name}
              planAmount={money(state.currentPlan.price_monthly, state.currentPlan.currency)}
            />
            {canChangePlan && (
              <Button asChild variant="outline" className="rounded-xl border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white backdrop-blur-md font-semibold gap-2">
                <Link href="/admin/subscriptions/change-plan">
                  <CreditCard className="h-4 w-4 text-indigo-300" />
                  Cambiar de plan
                </Link>
              </Button>
            )}
            <SubscriptionCancellation
              isFreePlan={state.currentPlan.price_monthly <= 0}
              cancelAtPeriodEnd={subscription?.cancel_at_period_end === true}
              periodEndDate={subscription?.current_period_ends_at ?? subscription?.trial_ends_at ?? null}
              currentPlanName={state.currentPlan.name}
            />
          </div>
        </div>

        {/* 4 Hero KPI mini-cards */}
        <div className="relative z-10 mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 border-t border-white/10 pt-6">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Plan Actual</p>
            <p className="text-xl font-extrabold text-white mt-1">{state.currentPlan.name}</p>
            <p className="text-xs text-indigo-300 font-medium mt-0.5">{money(state.currentPlan.price_monthly, state.currentPlan.currency)} / mes</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">
              {daysLeft !== null && daysLeft < 0 ? 'Vencimiento' : 'Próxima Renovación'}
            </p>
            <p className={cn(
              'text-xl font-extrabold tabular-nums mt-1',
              daysLeft === null
                ? 'text-slate-300'
                : daysLeft < 0
                  ? 'text-rose-400'
                  : daysLeft <= 3
                    ? 'text-rose-400'
                    : daysLeft <= 7
                      ? 'text-amber-300'
                      : 'text-emerald-300'
            )}>
              {daysLeft === null
                ? 'Sin fecha'
                : daysLeft < 0
                  ? `Venció hace ${Math.abs(daysLeft)}d`
                  : daysLeft === 0
                    ? 'Hoy'
                    : `En ${daysLeft} días`}
            </p>
            <p className="text-xs text-slate-300 mt-0.5">{daysLeft === null ? 'Sin fecha configurada' : date(nextDate)}</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Uso Promedio</p>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-xl font-extrabold text-white">{averageUsage}%</span>
              <span className="text-xs text-slate-300 font-medium">de cupos</span>
            </div>
            <div className="mt-2 w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${averageUsage}%`, backgroundColor: progressColor(averageUsage) }}
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Método de Pago</p>
            <p className="text-lg font-bold text-white mt-1 truncate">{paymentProvider}</p>
            <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {statusLabels[paymentStatus] || paymentStatus}
            </p>
          </div>
        </div>
      </section>

      {/* System Alerts */}
      {alerts.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {alerts.map((alert) => {
            const isOverdue = alert.includes('venció') || alert.includes('requiere atención')
            return (
              <Alert
                key={alert}
                className={cn(
                  'rounded-2xl border p-4 shadow-sm backdrop-blur-sm',
                  isOverdue
                    ? 'border-red-200 bg-red-50/90 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'
                    : 'border-orange-200 bg-orange-50/90 text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-200'
                )}
              >
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <AlertTitle className="font-bold text-sm">{isOverdue ? 'Requiere acción inmediata' : 'Aviso importante'}</AlertTitle>
                <AlertDescription className="text-xs mt-1 leading-relaxed">{alert}</AlertDescription>
              </Alert>
            )
          })}
        </div>
      )}

      {/* How it works collapsible */}
      <Card className="rounded-3xl border border-blue-100/80 bg-gradient-to-br from-blue-50/50 via-indigo-50/30 to-purple-50/40 shadow-xs dark:border-blue-950/40 dark:from-blue-950/20 dark:via-indigo-950/10 dark:to-purple-950/20">
        <details className="group">
          <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden flex items-center justify-between p-5 sm:p-6">
            <div className="text-base sm:text-lg font-bold flex items-center gap-2.5 text-blue-800 dark:text-blue-300">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300">
                <Info className="h-4 w-4" />
              </div>
              ¿Cómo funciona tu suscripción y facturación?
            </div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 select-none px-3 py-1 rounded-full bg-blue-100/70 dark:bg-blue-900/40">
              <span className="group-open:hidden">Mostrar detalles ↓</span>
              <span className="hidden group-open:inline">Ocultar ↑</span>
            </span>
          </summary>
          <CardContent className="pt-0 pb-6 px-5 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-blue-100 dark:border-slate-800 shadow-2xs">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Badge className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-xs bg-blue-600 text-white">1</Badge>
                  Límites de Uso
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Cada plan asigna cupos para usuarios, sucursales, cajas y catálogo. Al alcanzar el límite, puedes subir de plan para seguir expandiendo tu negocio.
                </p>
              </div>
              <div className="space-y-2 p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-blue-100 dark:border-slate-800 shadow-2xs">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Badge className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-xs bg-blue-600 text-white">2</Badge>
                  Pagos y Facturación
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Los pagos con Pagopar o código de activación renuevan el ciclo mensual. Las facturas legales se emiten con los datos fiscales de tu perfil.
                </p>
              </div>
              <div className="space-y-2 p-4 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-blue-100 dark:border-slate-800 shadow-2xs">
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Badge className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-xs bg-blue-600 text-white">3</Badge>
                  Cambios de Plan
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Puedes ascender de plan en cualquier momento. Para pasar a un plan menor, tu uso actual debe respetar los límites del nuevo plan.
                </p>
              </div>
            </div>
          </CardContent>
        </details>
      </Card>

      {/* Promo Code Redeemer Component */}
      <PromoCodeRedeemer canRedeem={['owner', 'admin'].includes(organization.role)} />

      {/* Resource Usage & Limits Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  Uso y Cupos de Recursos
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Consumo actual en tiempo real de tu organización</p>
              </div>
              <Badge variant="secondary" className="font-semibold text-xs rounded-full">
                Promedio: {averageUsage}%
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3.5">
            {resources.map((resource) => {
              const Icon = resource.icon
              const current = state.usage[resource.key]
              const limit = getPlanLimit(state.currentPlan, resource.key)
              const percent = usagePercent(current, limit)

              return (
                <div key={resource.key} className="rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/30 p-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 shadow-2xs">
                        <Icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900 dark:text-slate-100">{resource.label}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          <strong className="text-slate-900 dark:text-slate-200 font-mono">{current}</strong> usados de <span className="font-mono">{limitText(limit)}</span>
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex sm:flex-col items-center sm:items-end justify-between">
                      <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-slate-700/60 text-slate-800 dark:text-slate-200">
                        {limit === null ? 'Ilimitado' : `${percent}%`}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${limit === null ? 100 : percent}%`,
                        backgroundColor: limit === null ? '#059669' : progressColor(percent),
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Features Card */}
        <Card className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
              Funcionalidades del Plan
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Módulos y herramientas habilitadas</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/30 p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                <ShoppingBag className="h-4 w-4 text-indigo-500" />
                Marketplace Web
              </div>
              <Badge variant={feature(state.currentPlan, 'marketplace') === 'Incluido' ? 'default' : 'secondary'} className="text-[10px] font-bold">
                {feature(state.currentPlan, 'marketplace')}
              </Badge>
            </div>

            <div className="rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/30 p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                Reportes & Analytics
              </div>
              <Badge variant={feature(state.currentPlan, 'analytics') === 'Incluido' ? 'default' : 'secondary'} className="text-[10px] font-bold">
                {feature(state.currentPlan, 'analytics')}
              </Badge>
            </div>

            <div className="rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/30 p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                <CreditCard className="h-4 w-4 text-emerald-500" />
                Créditos & Cuotas
              </div>
              <Badge variant={feature(state.currentPlan, 'credits') === 'Incluido' ? 'default' : 'secondary'} className="text-[10px] font-bold">
                {feature(state.currentPlan, 'credits')}
              </Badge>
            </div>

            <div className="rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-800/30 p-3.5">
              <div className="flex items-center gap-2.5 font-bold text-xs text-slate-800 dark:text-slate-200 mb-2">
                <CalendarDays className="h-4 w-4 text-purple-500" />
                Módulos Activos
              </div>
              {state.currentPlan.modules.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {state.currentPlan.modules.map((mod) => (
                    <Badge key={mod} variant="secondary" className="rounded-lg text-[11px] font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      {mod}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sin módulos adicionales</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plans Comparison */}
      <PlansComparison
        canChangePlan={canChangePlan}
        currentPlanCode={state.currentPlan.code}
        plans={state.plans.map((plan): PlanRow => ({
          code: plan.code,
          name: plan.name,
          priceLabel: money(plan.price_monthly, plan.currency),
          priceMonthly: plan.price_monthly,
          users: limitText(getPlanLimit(plan, 'users')),
          branches: limitText(getPlanLimit(plan, 'branches')),
          cashRegisters: limitText(getPlanLimit(plan, 'cashRegisters')),
          products: limitText(getPlanLimit(plan, 'products')),
          marketplace: feature(plan, 'marketplace'),
          analytics: feature(plan, 'analytics'),
          credits: feature(plan, 'credits'),
          isPopular: plan.is_popular,
        }))}
      />

      {/* Payment History */}
      <Card id="payment-history" className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/20 dark:text-emerald-300">
                <Receipt className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  Historial de Pagos y Facturación
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Comprobantes, pagos regulares, códigos y cupones</p>
              </div>
            </div>

            {/* Modality Summary Badges */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {(() => {
                const modalities = state.payments.map((p) => getPaymentModality(p, state.promoRedemptions))
                const normalCount = modalities.filter((m) => m.type === 'normal').length
                const activationCount = modalities.filter((m) => m.type === 'activation_code').length
                const couponCount = modalities.filter((m) => m.type === 'coupon').length
                const manualCount = modalities.filter((m) => m.type === 'manual_admin').length
                const trialCount = modalities.filter((m) => m.type === 'trial_courtesy').length
                const migrationCount = modalities.filter((m) => m.type === 'system_migration').length

                return (
                  <>
                    <Badge variant="outline" className="font-bold text-xs rounded-xl px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      Total: {state.payments.length}
                    </Badge>
                    {normalCount > 0 && (
                      <Badge className="font-semibold text-xs rounded-xl px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 gap-1 shadow-2xs">
                        <CreditCard className="h-3 w-3" />
                        {normalCount} {normalCount === 1 ? 'Pago Normal' : 'Pagos Normales'}
                      </Badge>
                    )}
                    {activationCount > 0 && (
                      <Badge className="font-semibold text-xs rounded-xl px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800 gap-1 shadow-2xs">
                        <KeyRound className="h-3 w-3" />
                        {activationCount} {activationCount === 1 ? 'Activación' : 'Activaciones'}
                      </Badge>
                    )}
                    {couponCount > 0 && (
                      <Badge className="font-semibold text-xs rounded-xl px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 gap-1 shadow-2xs">
                        <Tag className="h-3 w-3" />
                        {couponCount} {couponCount === 1 ? 'Cupón' : 'Cupones'}
                      </Badge>
                    )}
                    {manualCount > 0 && (
                      <Badge className="font-semibold text-xs rounded-xl px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800 gap-1 shadow-2xs">
                        <ShieldCheck className="h-3 w-3" />
                        {manualCount} {manualCount === 1 ? 'Manual / Admin' : 'Manuales'}
                      </Badge>
                    )}
                    {trialCount > 0 && (
                      <Badge className="font-semibold text-xs rounded-xl px-2.5 py-1 bg-cyan-50 text-cyan-700 border border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300 dark:border-cyan-800 gap-1 shadow-2xs">
                        <Sparkles className="h-3 w-3" />
                        {trialCount} {trialCount === 1 ? 'Prueba / Cortesía' : 'Pruebas'}
                      </Badge>
                    )}
                    {migrationCount > 0 && (
                      <Badge className="font-semibold text-xs rounded-xl px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 gap-1 shadow-2xs">
                        <Settings2 className="h-3 w-3" />
                        {migrationCount} {migrationCount === 1 ? 'Migración' : 'Migraciones'}
                      </Badge>
                    )}
                  </>
                )
              })()}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {state.payments.length === 0 ? (
            <div className="p-8 sm:p-10">
              <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30 p-5 sm:p-6 text-center max-w-xl mx-auto">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 shadow-2xs">
                  <Layers className="h-6 w-6" />
                </div>
                <h4 className="mt-3 text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  Alta de Suscripción Actual
                </h4>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {subscriptionStatus === 'trialing' ? (
                    <>Tu organización está operando con un <strong>Período de Prueba (Trial)</strong> asignado automáticamente al registrarte en la plataforma.</>
                  ) : state.currentPlan.price_monthly <= 0 ? (
                    <>Tu organización está operando bajo el <strong>Plan Gratuito Estándar (Free Tier)</strong> provisto por el sistema.</>
                  ) : paymentProvider.toLowerCase().includes('manual') || subscription?.provider === 'manual' ? (
                    <>Esta cuenta cuenta con una <strong>Activación Manual / Asignación Directa</strong> efectuada por el equipo de administración.</>
                  ) : (
                    <>Suscripción gestionada mediante asignación directa del sistema.</>
                  )}
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  Plan {state.currentPlan.name} · Estado: {statusLabels[subscriptionStatus] || subscriptionStatus}
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/75 dark:bg-slate-800/50">
                  <TableRow className="border-slate-100 dark:border-slate-800">
                    <TableHead className="font-bold text-xs">Fecha</TableHead>
                    <TableHead className="font-bold text-xs">Plan</TableHead>
                    <TableHead className="font-bold text-xs">Modalidad</TableHead>
                    <TableHead className="font-bold text-xs">Método / Origen</TableHead>
                    <TableHead className="font-bold text-xs">Monto</TableHead>
                    <TableHead className="font-bold text-xs">Estado</TableHead>
                    <TableHead className="font-bold text-xs">Referencia / Voucher</TableHead>
                    <TableHead className="font-bold text-xs text-right">Comprobante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {state.payments.map((payment) => {
                    const modality = getPaymentModality(payment, state.promoRedemptions)
                    const ModalityIcon = modality.icon
                    const matchingRedemption = modality.matchingRedemption

                    return (
                      <TableRow key={payment.id} className="border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <TableCell className="font-medium text-xs text-slate-700 dark:text-slate-300">
                          {date(payment.paid_at || payment.created_at)}
                        </TableCell>
                        <TableCell className="font-bold text-xs text-slate-900 dark:text-slate-100">
                          {state.plans.find((p) => p.code === payment.plan_id)?.name || payment.plan_id || state.currentPlan.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn('rounded-xl text-[11px] font-bold border gap-1 py-0.5 px-2.5 shadow-2xs', modality.badgeClass)}
                          >
                            <ModalityIcon className="h-3 w-3" />
                            {modality.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="capitalize font-semibold text-slate-700 dark:text-slate-300">
                            {payment.payment_method === 'activation_code' || payment.provider === 'activation'
                              ? 'Canje de Código'
                              : payment.provider === 'pagopar'
                                ? 'Pagopar'
                                : payment.provider === 'mercado_pago'
                                  ? 'Mercado Pago'
                                  : payment.payment_method || payment.provider || 'Manual'}
                          </span>
                        </TableCell>
                        <TableCell className="font-bold font-mono text-xs text-slate-900 dark:text-slate-100">
                          {money(payment.amount, payment.currency)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn('rounded-full text-[11px] font-semibold border', statusTone(payment.status))}>
                            {statusLabels[payment.status] || payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {modality.type === 'activation_code' || modality.type === 'coupon' ? (
                            <div className="space-y-0.5">
                              <span className={cn(
                                'font-mono font-bold text-xs px-2 py-0.5 rounded-md border',
                                modality.type === 'activation_code'
                                  ? 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-800'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                              )}>
                                {payment.external_reference || 'Código aplicado'}
                              </span>
                              {matchingRedemption && (
                                <p className="text-[10px] text-muted-foreground leading-tight mt-1 font-medium">
                                  {getRedemptionDetailText(matchingRedemption.benefit_snapshot)}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="font-mono text-slate-600 dark:text-slate-400">
                              {payment.external_reference || payment.provider_payment_id || '—'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {payment.receipt_url ? (
                            <Button asChild size="sm" variant="outline" className="rounded-xl h-8 text-xs font-semibold">
                              <a href={payment.receipt_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Ver recibo</a>
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Billing Profile */}
      <Card id="billing-form" className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-400/20 dark:text-blue-300">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                Perfil de Facturación Fiscal
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Datos tributarios para la emisión automática de facturas legales</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <BillingProfileForm profile={state.billingProfile} />
        </CardContent>
      </Card>
    </div>
  )
}
