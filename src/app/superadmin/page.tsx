import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  CreditCard,
  Gauge,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { getSuperAdminOverview } from '@/lib/superadmin/overview'

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-PY').format(value)
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-PY', {
    currency: 'PYG',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(new Date(value))
}

function getCount(overview: Awaited<ReturnType<typeof getSuperAdminOverview>>, key: string) {
  return overview.counts.find((item) => item.key === key)
}

function statusTone(reason: string) {
  if (reason.includes('Pago') || reason.includes('vencido')) return 'border-rose-200 bg-rose-50 text-rose-700'
  if (reason.includes('Cancela')) return 'border-orange-200 bg-orange-50 text-orange-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function MetricTile({
  label,
  value,
  helper,
  icon: Icon,
  href,
}: {
  label: string
  value: string
  helper: string
  icon: React.ComponentType<{ className?: string }>
  href: string
}) {
  return (
    <Link href={href} className="rounded-lg border bg-background p-4 transition-colors hover:bg-muted/40">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
          <p className="mt-2 text-sm text-muted-foreground">{helper}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </Link>
  )
}

export default async function SuperAdminPage() {
  const overview = await getSuperAdminOverview()
  const organizations = getCount(overview, 'organizations')
  const members = getCount(overview, 'members')
  const products = getCount(overview, 'products')
  const customers = getCount(overview, 'customers')
  const sales = getCount(overview, 'sales')
  const repairs = getCount(overview, 'repairs')
  const activeRate = overview.subscriptionHealth.total
    ? Math.round((overview.subscriptionHealth.active / overview.subscriptionHealth.total) * 100)
    : 0
  const planTotal = overview.planDistribution.reduce((sum, item) => sum + item.count, 0)
  const missingTables = overview.counts.filter((item) => !item.available)
  const hasUrgentWork = overview.attentionItems.length > 0 || overview.subscriptionHealth.atRisk > 0

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
      <header className="grid gap-5 rounded-lg border bg-background p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="space-y-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Centro de control
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">Superadmin</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
              Empieza por las alertas, revisa el estado del SaaS y entra directo a la seccion que necesita accion.
            </p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:w-[520px]">
          <Button asChild className="gap-2">
            <Link href="/superadmin/subscriptions">
              Revisar alertas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/superadmin/organizations">
              Tenants
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/superadmin/plans">
              Planes
            </Link>
          </Button>
        </div>
      </header>

      {missingTables.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Algunas fuentes no estan disponibles.</p>
              <p className="mt-1 text-amber-800 dark:text-amber-300">
                {missingTables.map((item) => item.label).join(', ')} aparecen en cero hasta aplicar o corregir esas migraciones.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="rounded-lg">
          <CardHeader className="border-b">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Que necesita atencion</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  Prioriza pagos, cancelaciones, trials y renovaciones proximas.
                </p>
              </div>
              <Badge variant={hasUrgentWork ? 'outline' : 'secondary'} className="w-fit">
                {hasUrgentWork ? `${overview.attentionItems.length} pendientes` : 'Todo estable'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {overview.attentionItems.length > 0 ? (
              <div className="divide-y">
                {overview.attentionItems.map((item) => (
                  <Link
                    key={item.id}
                    href="/superadmin/subscriptions"
                    className="grid gap-3 p-4 transition-colors hover:bg-muted/40 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.organization_name}</p>
                        <Badge variant="outline" className={statusTone(item.reason)}>
                          {item.reason}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.plan} · {item.status.replace(/_/g, ' ')} · vence {formatDate(item.current_period_ends_at || item.trial_ends_at)}
                      </p>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
                <p className="mt-3 font-medium">No hay acciones urgentes</p>
                <p className="mt-1 text-sm text-muted-foreground">Las renovaciones y estados de cobro estan bajo control.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="border-b">
            <CardTitle>Salud SaaS</CardTitle>
            <p className="text-sm text-muted-foreground">Indicadores esenciales para leer el estado general.</p>
          </CardHeader>
          <CardContent className="space-y-5 p-5">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Suscripciones activas</span>
                <span className="text-muted-foreground">{activeRate}%</span>
              </div>
              <Progress value={activeRate} className="mt-3 h-2" />
              <p className="mt-2 text-xs text-muted-foreground">
                {overview.subscriptionHealth.active} activas de {overview.subscriptionHealth.total} suscripciones.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Trial</p>
                <p className="mt-1 text-2xl font-semibold">{overview.subscriptionHealth.trialing}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Riesgo</p>
                <p className="mt-1 text-2xl font-semibold">{overview.subscriptionHealth.atRisk}</p>
              </div>
            </div>
            <Button asChild variant="outline" className="w-full justify-between">
              <Link href="/superadmin/subscriptions">
                Ver suscripciones
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Tenants"
          value={formatNumber(organizations?.value ?? 0)}
          helper={`${formatNumber(members?.value ?? 0)} miembros`}
          icon={Building2}
          href="/superadmin/organizations"
        />
        <MetricTile
          label="MRR estimado"
          value={formatMoney(overview.subscriptionHealth.estimatedMrr)}
          helper={`${overview.subscriptionHealth.renewalsSoon} renovaciones proximas`}
          icon={Gauge}
          href="/superadmin/billing"
        />
        <MetricTile
          label="Catalogo"
          value={formatNumber(products?.value ?? 0)}
          helper={`${formatNumber(customers?.value ?? 0)} clientes`}
          icon={Store}
          href="/superadmin/organizations"
        />
        <MetricTile
          label="Operacion"
          value={formatNumber((sales?.value ?? 0) + (repairs?.value ?? 0))}
          helper={`${formatNumber(sales?.value ?? 0)} ventas · ${formatNumber(repairs?.value ?? 0)} reparaciones`}
          icon={Activity}
          href="/superadmin/analytics"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-lg">
          <CardHeader className="border-b">
            <CardTitle>Acciones frecuentes</CardTitle>
            <p className="text-sm text-muted-foreground">Entradas directas segun el trabajo habitual.</p>
          </CardHeader>
          <CardContent className="grid gap-2 p-4">
            {[
              { href: '/superadmin/organizations', label: 'Administrar empresas', helper: 'Owners, planes y estado del tenant', icon: Building2 },
              { href: '/superadmin/users', label: 'Revisar usuarios', helper: 'Accesos globales y permisos', icon: Users },
              { href: '/superadmin/plans', label: 'Editar planes', helper: 'Precios, limites y activacion', icon: CreditCard },
              { href: '/superadmin/web-content', label: 'Contenido publico', helper: 'Landing, marketplace y paginas SaaS', icon: Store },
              { href: '/superadmin/settings', label: 'Configuracion global', helper: 'Parametros del sistema', icon: Settings },
            ].map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href} className="flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/40">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{item.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">{item.helper}</span>
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              )
            })}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="border-b">
            <CardTitle>Empresas recientes</CardTitle>
            <p className="text-sm text-muted-foreground">Ultimos tenants creados o incorporados.</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {overview.recentOrganizations.map((organization) => (
                <Link
                  key={organization.id}
                  href={`/superadmin/organizations?query=${encodeURIComponent(organization.name)}`}
                  className="grid gap-3 p-4 transition-colors hover:bg-muted/40 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{organization.name}</p>
                      <Badge variant="secondary">{organization.plan ?? 'FREE'}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">/{organization.slug} · {formatDate(organization.created_at)}</p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              ))}
              {overview.recentOrganizations.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">Todavia no hay empresas registradas.</div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="rounded-lg">
          <CardHeader className="border-b">
            <CardTitle>Planes</CardTitle>
            <p className="text-sm text-muted-foreground">Distribucion de tenants por plan.</p>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            {overview.planDistribution.map((item) => {
              const percent = planTotal ? Math.round((item.count / planTotal) * 100) : 0
              return (
                <div key={item.plan} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{item.plan}</span>
                    <span className="text-muted-foreground">{formatNumber(item.count)}</span>
                  </div>
                  <Progress value={percent} className="h-2" />
                </div>
              )
            })}
            {overview.planDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin datos de planes.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="border-b">
            <CardTitle>Calidad de datos</CardTitle>
            <p className="text-sm text-muted-foreground">Fuentes usadas para este resumen.</p>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {overview.counts.map((item) => (
              <div key={item.key} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.label}</p>
                  {item.available ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  )}
                </div>
                <p className="mt-2 text-2xl font-semibold">{formatNumber(item.value)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
