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
} from 'lucide-react'
import { resolveRequestAuthUser } from '@/lib/auth/request-auth'
import { getCurrentOrganizationContext } from '@/lib/saas/context'
import {
  getCurrentOrganizationSubscription,
  getPlanLimit,
  type BillingProfile,
  type OrganizationUsage,
  type PlanRecord,
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

function usagePercent(current: number, limit: number | null) {
  if (limit === null || limit <= 0) return 0
  return Math.min(100, Math.round((current / limit) * 100))
}

function feature(plan: PlanRecord, key: string) {
  const value = plan.features?.[key]
  if (typeof value === 'boolean') return value ? 'Incluido' : 'No incluido'
  if (typeof value === 'string') return value
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

function buildAlerts(state: Awaited<ReturnType<typeof getCurrentOrganizationSubscription>>) {
  const alerts: string[] = []
  const status = state.subscription?.status
  const periodEnd = state.subscription?.current_period_ends_at || state.subscription?.trial_ends_at

  if (status && ['past_due', 'suspended', 'cancelled', 'canceled', 'expired', 'unpaid'].includes(status)) {
    alerts.push(`El estado de la suscripcion requiere atencion: ${statusLabels[status] || status}.`)
  }

  if (periodEnd) {
    const daysLeft = Math.ceil((new Date(periodEnd).getTime() - Date.now()) / 86400000)
    if (daysLeft >= 0 && daysLeft <= 7) alerts.push(`Faltan ${daysLeft} dias para el proximo vencimiento.`)
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
  const alerts = buildAlerts(state)
  const billingMissingFields = getBillingMissingFields(state.billingProfile)
  const subscription = state.subscription
  const nextDate = subscription?.current_period_ends_at || subscription?.trial_ends_at
  const subscriptionStatus = subscription?.status || 'sin_estado'
  const paymentStatus = subscription?.payment_status || 'manual'
  const paymentProvider = subscription?.provider === 'mercado_pago' ? 'Mercado Pago' : 'Pago manual'
  const periodEnd = nextDate ? new Date(nextDate) : null
  const daysLeft = periodEnd ? Math.ceil((periodEnd.getTime() - Date.now()) / 86400000) : null
  const usedLimits = resources
    .map((resource) => {
      const limit = getPlanLimit(state.currentPlan, resource.key)
      return limit === null ? null : usagePercent(state.usage[resource.key], limit)
    })
    .filter((percent): percent is number => percent !== null)
  const averageUsage = usedLimits.length ? Math.round(usedLimits.reduce((sum, percent) => sum + percent, 0) / usedLimits.length) : 0

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-6 p-5 lg:flex-row lg:items-start lg:justify-between lg:p-6">
          <div className="min-w-0 space-y-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-normal">Suscripcion</h1>
                <Badge variant="outline" className={cn('rounded-full border px-2.5 py-0.5', statusTone(subscriptionStatus))}>
                  {statusLabels[subscriptionStatus] || subscriptionStatus}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{organization.name}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Plan actual</p>
                <p className="mt-1 text-3xl font-bold">{state.currentPlan.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Precio mensual</p>
                <p className="mt-1 text-2xl font-semibold">{money(state.currentPlan.price_monthly, state.currentPlan.currency)}</p>
                {state.currentPlan.price_note && (
                  <p className="text-xs text-muted-foreground">{state.currentPlan.price_note}</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Proximo evento</p>
                <p className={cn('mt-1 text-lg font-semibold', daysLeft !== null && daysLeft <= 7 && daysLeft >= 0 && 'text-orange-600 dark:text-orange-400')}>{date(nextDate)}</p>
                <p className="text-xs text-muted-foreground">
                  {daysLeft === null ? 'Sin periodo configurado' : daysLeft < 0 ? `${Math.abs(daysLeft)} dias vencido` : `${daysLeft} dias restantes`}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <PagoparPaymentButton
              missingFields={billingMissingFields}
              isPaidPlan={state.currentPlan.price_monthly > 0}
              planName={state.currentPlan.name}
              planAmount={money(state.currentPlan.price_monthly, state.currentPlan.currency)}
            />
            <Button asChild variant="outline" className="gap-2">
              <Link href="/admin/subscriptions/change-plan">
                <CreditCard className="h-4 w-4" />
                Cambiar plan
              </Link>
            </Button>
          </div>
        </div>
        <div className="grid border-t bg-muted/30 sm:grid-cols-3">
          <div className="border-b p-4 sm:border-b-0 sm:border-r">
            <p className="text-xs font-medium uppercase text-muted-foreground">Uso promedio</p>
            <div className="mt-2 flex items-center gap-3">
              <Progress value={averageUsage} indicatorColor={progressColor(averageUsage)} className="h-2" />
              <span className="w-10 text-right text-sm font-medium">{averageUsage}%</span>
            </div>
          </div>
          <div className="border-b p-4 sm:border-b-0 sm:border-r">
            <p className="text-xs font-medium uppercase text-muted-foreground">Metodo de pago</p>
            <p className="mt-1 text-sm font-medium">{paymentProvider}</p>
            <p className="text-xs text-muted-foreground">{statusLabels[paymentStatus] || paymentStatus}</p>
          </div>
          <div className="p-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">Periodo iniciado</p>
            <p className="mt-1 text-sm font-medium">{date(subscription?.started_at || subscription?.created_at)}</p>
          </div>
        </div>
      </section>

      {alerts.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {alerts.map((alert) => (
            <Alert key={alert} className="border-orange-200 bg-orange-50/80 dark:border-orange-900/60 dark:bg-orange-950/20">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Atencion</AlertTitle>
              <AlertDescription>{alert}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Uso y limites</CardTitle>
              <span className="text-sm text-muted-foreground">Datos reales de la organizacion</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {resources.map((resource) => {
              const Icon = resource.icon
              const current = state.usage[resource.key]
              const limit = getPlanLimit(state.currentPlan, resource.key)
              const percent = usagePercent(current, limit)

              return (
                <div key={resource.key} className="rounded-lg border bg-background p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md border bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{resource.label}</p>
                        <p className="text-sm text-muted-foreground">{current} usados de {limitText(limit)}</p>
                      </div>
                    </div>
                    <span className="text-sm font-medium">{limit === null ? 'Sin limite' : `${percent}%`}</span>
                  </div>
                  <Progress value={limit === null ? 100 : percent} indicatorColor={progressColor(percent)} className="mt-3 h-2" />
                </div>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Features del plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2 font-medium"><ShoppingBag className="h-4 w-4" />Marketplace</div>
              <p className="text-sm text-muted-foreground">{feature(state.currentPlan, 'marketplace')}</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2 font-medium"><BarChart3 className="h-4 w-4" />Analytics</div>
              <p className="text-sm text-muted-foreground">{feature(state.currentPlan, 'analytics')}</p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2 font-medium"><CalendarDays className="h-4 w-4" />Modulos activos</div>
              {state.currentPlan.modules.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {state.currentPlan.modules.map((mod) => (
                    <Badge key={mod} variant="secondary" className="rounded-full text-xs">{mod}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin modulos adicionales</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <PlansComparison
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
        }))}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Historial de pagos</CardTitle>
            <span className="text-sm text-muted-foreground">{state.payments.length} registros</span>
          </div>
        </CardHeader>
        <CardContent>
          {state.payments.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <Receipt className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Sin pagos registrados</p>
              <p className="mt-1 text-sm text-muted-foreground">Cuando se carguen pagos manuales o de Mercado Pago apareceran aca.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Metodo</TableHead>
                  <TableHead>Referencia</TableHead>
                  <TableHead>Comprobante</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{date(payment.paid_at || payment.created_at)}</TableCell>
                    <TableCell>{state.plans.find((p) => p.code === payment.plan_id)?.name || payment.plan_id || state.currentPlan.name}</TableCell>
                    <TableCell>{money(payment.amount, payment.currency)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('rounded-full border', statusTone(payment.status))}>
                        {statusLabels[payment.status] || payment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{payment.payment_method || payment.provider || 'manual'}</TableCell>
                    <TableCell>{payment.external_reference || payment.provider_payment_id || '-'}</TableCell>
                    <TableCell>
                      {payment.receipt_url ? (
                        <Button asChild size="sm" variant="outline">
                          <a href={payment.receipt_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Ver</a>
                        </Button>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card id="billing-form">
        <CardHeader>
          <CardTitle>Facturacion</CardTitle>
        </CardHeader>
        <CardContent>
          <BillingProfileForm profile={state.billingProfile} />
        </CardContent>
      </Card>
    </div>
  )
}
