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
  ExternalLink,
  FileText,
  Gauge,
  Globe,
  LayoutDashboard,
  Plus,
  Settings,
  Shield,
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
  FREE: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  BASIC: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-300',
  PRO: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300',
  ENTERPRISE: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300',
}

function HeroMetric({
  label, value, sub, icon: Icon, tone, href, trend,
}: {
  label: string
  value: string
  sub: string
  icon: React.ComponentType<{ className?: string }>
  tone: 'indigo' | 'emerald' | 'amber' | 'violet'
  href: string
  trend?: { value: string; up?: boolean }
}) {
  const tones = {
    indigo:  'from-indigo-500/10 to-transparent border-indigo-200/50 dark:border-indigo-900/50',
    emerald: 'from-emerald-500/10 to-transparent border-emerald-200/50 dark:border-emerald-900/50',
    amber:   'from-amber-500/10 to-transparent border-amber-200/50 dark:border-amber-900/50',
    violet:  'from-violet-500/10 to-transparent border-violet-200/50 dark:border-violet-900/50',
  }
  const iconTones = {
    indigo:  'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    amber:   'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    violet:  'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  }
  return (
    <Link
      href={href}
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 transition-all hover:shadow-md',
        tones[tone]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50 truncate">{value}</p>
            {trend && (
              <span className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                trend.up
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300'
              )}>
                {trend.up ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowRight className="h-2.5 w-2.5" />}
                {trend.value}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sub}</p>
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', iconTones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <ArrowUpRight className="absolute right-3 top-3 h-3.5 w-3.5 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />
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
  const totalSubs = overview.subscriptionHealth.total
  const overallHealth = totalSubs > 0
    ? Math.round(((overview.subscriptionHealth.active + overview.subscriptionHealth.trialing * 0.5) / totalSubs) * 100)
    : 100

  const healthLabel =
    overallHealth >= 80 ? 'Excelente' :
    overallHealth >= 60 ? 'Bueno' :
    overallHealth >= 40 ? 'Atención' :
    'Crítico'

  const healthTone =
    overallHealth >= 80 ? 'emerald' :
    overallHealth >= 60 ? 'cyan' :
    overallHealth >= 40 ? 'amber' :
    'red'

  const healthBg = {
    emerald: 'from-emerald-500 to-emerald-600',
    cyan: 'from-cyan-500 to-cyan-600',
    amber: 'from-amber-500 to-amber-600',
    red: 'from-red-500 to-red-600',
  }[healthTone]

  return (
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Centro de control SaaS
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Buenas, super admin
          </h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Resumen general de la plataforma. Empezá por las alertas y entrá directo a la sección que necesita acción.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/superadmin/monitoring">
              <Activity className="h-3.5 w-3.5" />
              Monitoreo
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/superadmin/diagnostic">
              <Zap className="h-3.5 w-3.5" />
              Diagnóstico
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
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {missingTables.length} fuente{missingTables.length !== 1 ? 's' : ''} de datos no disponible{missingTables.length !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {missingTables.map((item) => item.label).join(', ')} aparecen en cero hasta aplicar las migraciones.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300">
            <Link href="/superadmin/diagnostic">Diagnosticar</Link>
          </Button>
        </div>
      )}

      {/* Hero metrics */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <HeroMetric
          label="MRR estimado"
          value={formatMoney(overview.subscriptionHealth.estimatedMrr)}
          sub={`${overview.subscriptionHealth.active} activas · ${overview.subscriptionHealth.renewalsSoon} renovaciones próximas`}
          icon={TrendingUp}
          tone="emerald"
          href="/superadmin/billing"
        />
        <HeroMetric
          label="Organizaciones"
          value={formatNumber(organizations?.value ?? 0)}
          sub={`${formatNumber(members?.value ?? 0)} miembros activos`}
          icon={Building2}
          tone="indigo"
          href="/superadmin/organizations"
        />
        <HeroMetric
          label="En prueba"
          value={formatNumber(overview.subscriptionHealth.trialing)}
          sub="trials por convertir"
          icon={Sparkles}
          tone="violet"
          href="/superadmin/subscriptions"
        />
        <HeroMetric
          label="Salud del sistema"
          value={`${overallHealth}%`}
          sub={healthLabel}
          icon={Gauge}
          tone={overallHealth >= 60 ? 'emerald' : 'amber'}
          href="/superadmin/monitoring"
        />
      </section>

      {/* Health bar */}
      <Card>
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

      {/* 2-column: Attention + Recent orgs */}
      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">

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
                  <p className="mt-0.5 text-xs text-slate-500">Pagos, cancelaciones y trials próximos</p>
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
                          <Badge variant="outline" className={cn('rounded-full gap-1 text-[10px]', PLAN_BADGE[item.plan] ?? PLAN_BADGE.FREE)}>
                            {item.plan}
                          </Badge>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs">
                          <Badge variant="outline" className={cn('rounded-full gap-1 text-[10px]', tone.color)}>
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
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base">Empresas recientes</CardTitle>
                  <p className="mt-0.5 text-xs text-slate-500">Últimos tenants creados</p>
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
                        <Badge variant="outline" className={cn('rounded-full text-[10px]', PLAN_BADGE[org.plan ?? 'FREE'] ?? PLAN_BADGE.FREE)}>
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
      </section>

      {/* Plans distribution + Platform stats */}
      <section className="grid gap-4 lg:grid-cols-2">

        {/* Plans distribution */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-900/50 dark:bg-violet-950/20 dark:text-violet-400">
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-400">
                <Database className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">Datos de la plataforma</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <DataStat label="Productos" value={products?.value ?? 0} icon={Store} ok={Boolean(products?.available)} />
              <DataStat label="Clientes" value={customers?.value ?? 0} icon={Users} ok={Boolean(customers?.available)} />
              <DataStat label="Ventas" value={sales?.value ?? 0} icon={Banknote} ok={Boolean(sales?.available)} />
              <DataStat label="Reparaciones" value={repairs?.value ?? 0} icon={Wrench} ok={Boolean(repairs?.available)} />
              <DataStat label="Miembros" value={members?.value ?? 0} icon={Users} ok={Boolean(members?.available)} />
              <DataStat label="Tenants" value={organizations?.value ?? 0} icon={Building2} ok={Boolean(organizations?.available)} />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Quick actions grid */}
      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-500">Accesos rápidos</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/superadmin/organizations', icon: Building2, label: 'Organizaciones', sub: 'Owners, planes, estado', tone: 'blue' },
            { href: '/superadmin/users', icon: Users, label: 'Usuarios', sub: 'Accesos globales', tone: 'cyan' },
            { href: '/superadmin/plans', icon: CreditCard, label: 'Planes', sub: 'Precios y límites', tone: 'violet' },
            { href: '/superadmin/subscriptions', icon: Sparkles, label: 'Suscripciones', sub: 'Estado por tenant', tone: 'amber' },
            { href: '/superadmin/invoices', icon: FileText, label: 'Pagos', sub: 'Historial de cobros', tone: 'emerald' },
            { href: '/superadmin/web-content', icon: Globe, label: 'Contenido web', sub: 'Landing y marketplace', tone: 'rose' },
            { href: '/superadmin/audit-logs', icon: Shield, label: 'Audit log', sub: 'Eventos del sistema', tone: 'slate' },
            { href: '/superadmin/settings', icon: Settings, label: 'Configuración', sub: 'Parámetros globales', tone: 'slate' },
          ].map((item) => {
            const Icon = item.icon
            const tones: Record<string, string> = {
              blue:    'border-blue-200 bg-blue-50/50 text-blue-600 dark:border-blue-900/50 dark:bg-blue-950/10 dark:text-blue-400',
              cyan:    'border-cyan-200 bg-cyan-50/50 text-cyan-600 dark:border-cyan-900/50 dark:bg-cyan-950/10 dark:text-cyan-400',
              violet:  'border-violet-200 bg-violet-50/50 text-violet-600 dark:border-violet-900/50 dark:bg-violet-950/10 dark:text-violet-400',
              amber:   'border-amber-200 bg-amber-50/50 text-amber-600 dark:border-amber-900/50 dark:bg-amber-950/10 dark:text-amber-400',
              emerald: 'border-emerald-200 bg-emerald-50/50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-950/10 dark:text-emerald-400',
              rose:    'border-rose-200 bg-rose-50/50 text-rose-600 dark:border-rose-900/50 dark:bg-rose-950/10 dark:text-rose-400',
              slate:   'border-slate-200 bg-slate-50/50 text-slate-600 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400',
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-all hover:border-slate-300 hover:shadow-sm dark:hover:border-slate-600"
              >
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border', tones[item.tone])}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">{item.label}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.sub}</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5" />
              </Link>
            )
          })}
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
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
    </div>
  )
}
