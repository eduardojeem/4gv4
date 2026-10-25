import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  Gauge,
  LayoutDashboard,
  Plus,
  ShieldAlert,
  Sparkles,
  Store,
  TrendingUp,
  Users,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSuperAdminOverview } from '@/lib/superadmin/overview'
import { cn } from '@/lib/utils'

function formatNumber(value: number) {
  return new Intl.NumberFormat('es-PY').format(value)
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('es-PY', { currency: 'PYG', maximumFractionDigits: 0, style: 'currency' }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return 'Sin fecha'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(new Date(value))
}

function getCount(overview: Awaited<ReturnType<typeof getSuperAdminOverview>>, key: string) {
  return overview.counts.find((item) => item.key === key)
}

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
}

function reasonTone(reason: string) {
  if (reason.includes('Pago') || reason.includes('vencido') || reason.includes('Periodo vencido'))
    return { color: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300', icon: XCircle }
  if (reason.includes('Cancela'))
    return { color: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-300', icon: AlertTriangle }
  if (reason.includes('Trial'))
    return { color: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/20 dark:text-cyan-300', icon: Clock }
  return { color: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300', icon: Bell }
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'bg-slate-400',
  BASIC: 'bg-blue-500',
  PRO: 'bg-violet-500',
  ENTERPRISE: 'bg-amber-500',
}

const PLAN_BADGE: Record<string, string> = {
  FREE: 'border-border bg-muted/50 text-muted-foreground',
  BASIC: 'border-border bg-muted/50 text-foreground',
  PRO: 'border-border bg-muted/50 text-foreground',
  ENTERPRISE: 'border-border bg-muted/50 text-foreground',
}

function HeroMetric({ label, value, sub, icon: Icon, href }: {
  label: string
  value: string
  sub: string
  icon: React.ComponentType<{ className?: string }>
  href: string
}) {
  return (
    <Link href={href} className="group rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="mt-3 break-words text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
      <div className="mt-2 flex items-start justify-between gap-2">
        <p className="text-xs leading-relaxed text-muted-foreground">{sub}</p>
        <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-foreground" />
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
  const planTotal = overview.planDistribution.reduce((sum, item) => sum + item.count, 0)
  const missingTables = overview.counts.filter((item) => !item.available)
  const totalSubs = overview.subscriptionHealth.total
  const managedSubs = overview.subscriptionHealth.active + overview.subscriptionHealth.trialing + overview.subscriptionHealth.atRisk
  const overallHealth = managedSubs > 0
    ? Math.round(((overview.subscriptionHealth.active + overview.subscriptionHealth.trialing) / managedSubs) * 100)
    : 100

  const healthLabel =
    overallHealth >= 80 ? 'Excelente' :
    overallHealth >= 60 ? 'Bueno' :
    overallHealth >= 40 ? 'Atención' :
    'Crítico'

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 border-b pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Centro de control SaaS
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Resumen ejecutivo
          </h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Estado comercial y operativo de la plataforma, ordenado por prioridad.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/superadmin/analytics">
              <Activity className="h-3.5 w-3.5" />
              Análisis
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/superadmin/saas-metrics">
              <Gauge className="h-3.5 w-3.5" />
              Uso y límites
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-2">
            <Link href="/superadmin/organizations/create">
              <Plus className="h-3.5 w-3.5" />
              Nueva organización
            </Link>
          </Button>
        </div>
      </header>

      {/* Missing tables alert */}
      {missingTables.length > 0 && (
        <div className="flex flex-wrap items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {missingTables.length} fuente{missingTables.length !== 1 ? 's' : ''} de datos no disponible{missingTables.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {missingTables.map((item) => item.label).join(', ')} aparecen en cero hasta aplicar las migraciones.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300">
            <Link href="/superadmin/system-health">Diagnosticar</Link>
          </Button>
        </div>
      )}

      {/* 2-column: Attention + Recent orgs */}
      <section className="space-y-3" aria-labelledby="priority-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-600 dark:text-orange-400">Prioridad de hoy</p>
            <h2 id="priority-heading" className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-50">Qué necesita atención</h2>
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1.5">
            <Link href="/superadmin/subscriptions">Gestionar suscripciones <ArrowRight className="h-3.5 w-3.5" /></Link>
          </Button>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">

        {/* Attention items */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg border',
                  overview.attentionItems.length > 0
                    ? 'border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-400'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-400'
                )}>
                  {overview.attentionItems.length > 0 ? <ShieldAlert className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                </div>
                <div>
                  <CardTitle className="text-base">Atención requerida</CardTitle>
                  <p className="mt-0.5 text-xs text-slate-500">Pagos, cancelaciones y pruebas próximas</p>
                </div>
              </div>
              <Badge variant="outline" className="rounded-full text-xs">
                {overview.attentionItems.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {overview.attentionItems.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {overview.attentionItems.map((item) => {
                  const tone = reasonTone(item.reason)
                  const ToneIcon = tone.icon
                  return (
                    <Link
                      key={item.id}
                      href="/superadmin/subscriptions"
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {getInitials(item.organization_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{item.organization_name}</p>
                          <Badge variant="outline" className={cn('rounded-full gap-1 text-xs', PLAN_BADGE[item.plan] ?? PLAN_BADGE.FREE)}>
                            {item.plan}
                          </Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="outline" className={cn('rounded-full gap-1 text-xs', tone.color)}>
                            <ToneIcon className="h-2.5 w-2.5" />
                            {item.reason}
                          </Badge>
                          <span className="text-slate-400">
                            Vence: {formatDate(item.current_period_ends_at || item.trial_ends_at)}
                          </span>
                        </div>
                      </div>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                    </Link>
                  )
                })}
              </div>
            ) : (
              <div className="py-12 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
                <p className="mt-3 font-semibold text-slate-900 dark:text-slate-100">Sin acciones urgentes</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Las renovaciones y estados de cobro están bajo control.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent organizations */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Empresas recientes</CardTitle>
                  <p className="mt-0.5 text-xs text-slate-500">Últimas organizaciones creadas</p>
                </div>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                <Link href="/superadmin/organizations">
                  Ver todas
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {overview.recentOrganizations.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {overview.recentOrganizations.slice(0, 6).map((org) => (
                  <Link
                    key={org.id}
                    href="/superadmin/organizations"
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {getInitials(org.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{org.name}</p>
                        <Badge variant="outline" className={cn('rounded-full text-xs', PLAN_BADGE[org.plan ?? 'FREE'] ?? PLAN_BADGE.FREE)}>
                          {org.plan ?? 'FREE'}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400">/{org.slug} · {formatDate(org.created_at)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-slate-400">
                <Building2 className="mx-auto h-8 w-8 text-slate-300" />
                <p className="mt-2">Aún no hay empresas registradas</p>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </section>

      {/* Hero metrics */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores ejecutivos">
        <HeroMetric
          label="MRR confirmado"
          value={formatMoney(overview.subscriptionHealth.estimatedMrr)}
          sub={`${overview.subscriptionHealth.active} activas · ${overview.subscriptionHealth.renewalsSoon} renovaciones próximas`}
          icon={TrendingUp}
          href="/superadmin/billing"
        />
        <HeroMetric
          label="Organizaciones"
          value={formatNumber(organizations?.value ?? 0)}
          sub={`${formatNumber(members?.value ?? 0)} miembros registrados`}
          icon={Building2}
          href="/superadmin/organizations"
        />
        <HeroMetric
          label="En prueba"
          value={formatNumber(overview.subscriptionHealth.trialing)}
          sub="pruebas por convertir"
          icon={Sparkles}
          href="/superadmin/subscriptions"
        />
        <HeroMetric
          label="Suscripciones saludables"
          value={`${overallHealth}%`}
          sub={healthLabel}
          icon={Gauge}
          href="/superadmin/subscriptions"
        />
      </section>

      {/* Health bar */}
      <Card className="">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Estado de suscripciones</CardTitle>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {totalSubs} suscripciones totales en la plataforma
              </p>
            </div>
            <Badge variant="outline" className={cn(
              'rounded-full text-xs',
              overallHealth >= 80 ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : overallHealth >= 60 ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
              : overallHealth >= 40 ? 'border-amber-200 bg-amber-50 text-amber-700'
              : 'border-red-200 bg-red-50 text-red-700'
            )}>
              {healthLabel}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Stacked bar */}
          {totalSubs > 0 ? (
            <>
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                {overview.subscriptionHealth.active > 0 && (
                  <div className="bg-emerald-500" style={{ width: `${(overview.subscriptionHealth.active / totalSubs) * 100}%` }} title={`${overview.subscriptionHealth.active} activas`} />
                )}
                {overview.subscriptionHealth.trialing > 0 && (
                  <div className="bg-cyan-500" style={{ width: `${(overview.subscriptionHealth.trialing / totalSubs) * 100}%` }} title={`${overview.subscriptionHealth.trialing} trial`} />
                )}
                {overview.subscriptionHealth.atRisk > 0 && (
                  <div className="bg-orange-500" style={{ width: `${(overview.subscriptionHealth.atRisk / totalSubs) * 100}%` }} title={`${overview.subscriptionHealth.atRisk} en riesgo`} />
                )}
                {overview.subscriptionHealth.canceled > 0 && (
                  <div className="bg-slate-400" style={{ width: `${(overview.subscriptionHealth.canceled / totalSubs) * 100}%` }} title={`${overview.subscriptionHealth.canceled} canceladas`} />
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-900 dark:text-slate-100">{overview.subscriptionHealth.active}</strong> activas
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-900 dark:text-slate-100">{overview.subscriptionHealth.trialing}</strong> trial
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-900 dark:text-slate-100">{overview.subscriptionHealth.atRisk}</strong> en riesgo
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                  <span className="text-xs text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-900 dark:text-slate-100">{overview.subscriptionHealth.canceled}</strong> canceladas
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="py-4 text-center text-sm text-slate-400">Sin suscripciones todavía</p>
          )}
        </CardContent>
      </Card>

      {/* Plans distribution + Platform stats */}
      <section className="space-y-3" aria-labelledby="platform-context-heading">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Contexto de la plataforma</p>
          <h2 id="platform-context-heading" className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-50">Plataforma y distribución</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">

        {/* Plans distribution */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <CreditCard className="h-4 w-4" />
                </div>
                <CardTitle className="text-base">Distribución por plan</CardTitle>
              </div>
              <Button asChild variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                <Link href="/superadmin/plans">
                  Gestionar
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {overview.planDistribution.length > 0 ? (
              <>
                <div className="flex h-3 overflow-hidden rounded-full">
                  {overview.planDistribution.map((p) => {
                    const percent = planTotal > 0 ? (p.count / planTotal) * 100 : 0
                    return (
                      <div
                        key={p.plan}
                        className={cn('transition-all', PLAN_COLORS[p.plan] ?? 'bg-slate-300')}
                        style={{ width: `${percent}%` }}
                        title={`${p.plan}: ${p.count}`}
                      />
                    )
                  })}
                </div>
                <div className="mt-3 space-y-2">
                  {overview.planDistribution.map((p) => {
                    const percent = planTotal > 0 ? Math.round((p.count / planTotal) * 100) : 0
                    return (
                      <div key={p.plan} className="flex items-center gap-2">
                        <div className={cn('h-2.5 w-2.5 rounded-full', PLAN_COLORS[p.plan] ?? 'bg-slate-300')} />
                        <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{p.plan}</span>
                        <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-50">{formatNumber(p.count)}</span>
                        <span className="w-10 text-right text-xs text-slate-400">{percent}%</span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-sm text-slate-400">Sin datos de planes</p>
            )}
          </CardContent>
        </Card>

        {/* Platform stats */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Database className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">Datos de la plataforma</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <DataStat label="Productos" value={products?.value ?? 0} icon={Store} ok={Boolean(products?.available)} />
              <DataStat label="Clientes" value={customers?.value ?? 0} icon={Users} ok={Boolean(customers?.available)} />
              <DataStat label="Ventas" value={sales?.value ?? 0} icon={Banknote} ok={Boolean(sales?.available)} />
              <DataStat label="Reparaciones" value={repairs?.value ?? 0} icon={Wrench} ok={Boolean(repairs?.available)} />
              <DataStat label="Miembros" value={members?.value ?? 0} icon={Users} ok={Boolean(members?.available)} />
              <DataStat label="Organizaciones" value={organizations?.value ?? 0} icon={Building2} ok={Boolean(organizations?.available)} />
            </div>
          </CardContent>
        </Card>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm"><Link href="/superadmin/monitoring"><Activity className="h-3.5 w-3.5" />Monitoreo técnico</Link></Button>
          <Button asChild variant="outline" size="sm"><Link href="/superadmin/system-health"><Zap className="h-3.5 w-3.5" />Salud del sistema</Link></Button>
        </div>
      </section>

    </div>
  )
}

function DataStat({
  label, value, icon: Icon, ok,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  ok: boolean
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between gap-2">
        <Icon className="h-3.5 w-3.5 text-slate-400" />
        {ok ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <AlertTriangle className="h-3 w-3 text-amber-500" />}
      </div>
      <p className="mt-1.5 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{formatNumber(value)}</p>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  )
}
