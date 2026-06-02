'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  FileText,
  Minus,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FinancialData = {
  mrr: number
  arr: number
  potentialMrr: number
  churnedMrr: number
  churnRate: number
  totalRevenue: number
  monthlyRevenue: number
  counts: {
    total: number; active: number; trialing: number; pastDue: number
    suspended: number; canceled: number; cancelingSoon: number; renewalsSoon: number
    newLast30: number; growthPercent: number
  }
  subsByPlan: Array<{ tier: string; planName: string; total: number; active: number; trialing: number; mrr: number }>
  revenueByPlan: Array<{ tier: string; revenue: number }>
  paymentCount: number
  fetchedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPYG(amount: number) {
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(amount)
}

function formatCompact(amount: number) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M Gs`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}k Gs`
  return `${amount} Gs`
}

const PLAN_COLORS: Record<string, { bar: string; badge: string }> = {
  FREE:       { bar: 'bg-slate-400',  badge: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  BASIC:      { bar: 'bg-blue-500',   badge: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-300' },
  PRO:        { bar: 'bg-violet-500', badge: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300' },
  ENTERPRISE: { bar: 'bg-amber-500',  badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300' },
}

// ---------------------------------------------------------------------------
// Big metric card
// ---------------------------------------------------------------------------

function BigMetric({
  label, value, sub, icon: Icon, tone = 'default', trend, trendValue,
}: {
  label: string; value: string; sub?: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}) {
  const tones = {
    default: 'bg-card border',
    success: 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-900/50 dark:from-emerald-950/30 dark:to-slate-900',
    warning: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:border-amber-900/50 dark:from-amber-950/30 dark:to-slate-900',
    danger:  'border-red-200 bg-gradient-to-br from-red-50 to-white dark:border-red-900/50 dark:from-red-950/30 dark:to-slate-900',
    info:    'border-blue-200 bg-gradient-to-br from-blue-50 to-white dark:border-blue-900/50 dark:from-blue-950/30 dark:to-slate-900',
  }
  const iconTones = {
    default: 'text-slate-500',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger:  'text-red-600 dark:text-red-400',
    info:    'text-blue-600 dark:text-blue-400',
  }

  return (
    <div className={cn('rounded-2xl border p-6', tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
            {trend && trendValue && (
              <span className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                trend === 'up' && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
                trend === 'down' && 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
                trend === 'neutral' && 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              )}>
                {trend === 'up' && <ArrowUpRight className="h-3 w-3" />}
                {trend === 'down' && <ArrowDownRight className="h-3 w-3" />}
                {trendValue}
              </span>
            )}
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50">{value}</p>
          {sub && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sub}</p>}
        </div>
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-background', iconTones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plan breakdown table
// ---------------------------------------------------------------------------

function PlanBreakdown({ subsByPlan, mrr }: { subsByPlan: FinancialData['subsByPlan']; mrr: number }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Desglose por plan</CardTitle>
      </CardHeader>
      <CardContent>
        {subsByPlan.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Sin suscripciones aún</p>
        ) : (
          <div className="space-y-4">
            {subsByPlan.map((plan) => {
              const colors = PLAN_COLORS[plan.tier] ?? PLAN_COLORS.FREE
              const mrrPercent = mrr > 0 ? Math.round((plan.mrr / mrr) * 100) : 0

              return (
                <div key={plan.tier} className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn('rounded-full text-[11px]', colors.badge)}>
                        {plan.planName}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {plan.active} activas
                        {plan.trialing > 0 && ` · ${plan.trialing} en prueba`}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">
                        {formatPYG(plan.mrr)}
                      </p>
                      <p className="text-[11px] text-slate-400">{mrrPercent}% del MRR</p>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className={cn('h-full transition-all', colors.bar)} style={{ width: `${mrrPercent}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Status distribution donut
// ---------------------------------------------------------------------------

function StatusOverview({ counts }: { counts: FinancialData['counts'] }) {
  const items = [
    { label: 'Activas',       value: counts.active,    color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'En prueba',     value: counts.trialing,  color: 'bg-cyan-500',    textColor: 'text-cyan-600 dark:text-cyan-400' },
    { label: 'Vencidas',      value: counts.pastDue,   color: 'bg-orange-500',  textColor: 'text-orange-600 dark:text-orange-400' },
    { label: 'Suspendidas',   value: counts.suspended, color: 'bg-red-500',     textColor: 'text-red-600 dark:text-red-400' },
    { label: 'Canceladas',    value: counts.canceled,  color: 'bg-slate-400',   textColor: 'text-slate-500' },
  ].filter((i) => i.value > 0)

  const total = items.reduce((sum, i) => sum + i.value, 0)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Estado de suscripciones</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Sin suscripciones</p>
        ) : (
          <>
            {/* Horizontal stacked bar */}
            <div className="flex h-3 overflow-hidden rounded-full">
              {items.map((i) => (
                <div
                  key={i.label}
                  className={cn('transition-all', i.color)}
                  style={{ width: `${(i.value / total) * 100}%` }}
                  title={`${i.label}: ${i.value}`}
                />
              ))}
            </div>

            <div className="mt-4 space-y-2">
              {items.map((i) => (
                <div key={i.label} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className={cn('h-2.5 w-2.5 rounded-full', i.color)} />
                    <span className="text-slate-600 dark:text-slate-400">{i.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold tabular-nums text-slate-900 dark:text-slate-50">{i.value}</span>
                    <span className="text-xs tabular-nums text-slate-400">{Math.round((i.value / total) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Action items
// ---------------------------------------------------------------------------

function ActionItems({ counts, churnedMrr }: { counts: FinancialData['counts']; churnedMrr: number }) {
  const items: Array<{ icon: React.ComponentType<{ className?: string }>; tone: string; title: string; desc: string; href?: string }> = []

  if (counts.pastDue > 0) {
    items.push({
      icon: AlertTriangle,
      tone: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300',
      title: `${counts.pastDue} suscripcion${counts.pastDue !== 1 ? 'es' : ''} con pago vencido`,
      desc: 'Revisar y contactar a los tenants para cobrar',
      href: '/superadmin/subscriptions',
    })
  }
  if (counts.cancelingSoon > 0) {
    items.push({
      icon: XCircle,
      tone: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-300',
      title: `${counts.cancelingSoon} cancelará${counts.cancelingSoon !== 1 ? 'n' : ''} al fin del período`,
      desc: 'Riesgo de churn — considerá ofrecer un descuento de retención',
      href: '/superadmin/subscriptions',
    })
  }
  if (counts.renewalsSoon > 0) {
    items.push({
      icon: Calendar,
      tone: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300',
      title: `${counts.renewalsSoon} renovación${counts.renewalsSoon !== 1 ? 'es' : ''} en los próximos 14 días`,
      desc: 'Asegurate de que tengan método de pago configurado',
      href: '/superadmin/subscriptions',
    })
  }
  if (counts.trialing > 0) {
    items.push({
      icon: Clock,
      tone: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/50 dark:bg-cyan-950/20 dark:text-cyan-300',
      title: `${counts.trialing} en período de prueba`,
      desc: 'Oportunidad de conversión — enviar campaña de onboarding',
      href: '/superadmin/subscriptions',
    })
  }
  if (churnedMrr > 0) {
    items.push({
      icon: TrendingDown,
      tone: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300',
      title: `${formatPYG(churnedMrr)} MRR perdido este mes`,
      desc: 'Por cancelaciones y suspensiones — analizar causas',
    })
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Todo en orden</p>
            <p className="text-xs text-slate-400">Sin acciones requeridas</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Atención requerida</CardTitle>
          <Badge variant="outline" className="rounded-full bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400">
            {items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item, i) => {
          const Icon = item.icon
          const content = (
            <div className={cn('rounded-lg border px-3 py-2.5', item.tone)}>
              <div className="flex items-start gap-2.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs opacity-80">{item.desc}</p>
                </div>
                {item.href && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-50" />}
              </div>
            </div>
          )
          return item.href ? (
            <Link key={i} href={item.href} className="block transition-opacity hover:opacity-80">
              {content}
            </Link>
          ) : (
            <div key={i}>{content}</div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export function FinancialDashboard({ data }: { data: FinancialData }) {
  const router = useRouter()

  const growthTrend = data.counts.growthPercent > 0 ? 'up' : data.counts.growthPercent < 0 ? 'down' : 'neutral'
  const churnTrend = data.churnRate > 5 ? 'down' : 'neutral'

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <Banknote className="h-3.5 w-3.5" />
            Facturación SaaS
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Resumen financiero</h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            MRR, ARR y métricas de ingresos calculadas en tiempo real desde suscripciones activas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.refresh()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href="/superadmin/subscriptions">
              <CreditCard className="h-3.5 w-3.5" />
              Suscripciones
            </Link>
          </Button>
          <Button asChild size="sm" className="gap-2">
            <Link href="/superadmin/invoices">
              <FileText className="h-3.5 w-3.5" />
              Ver pagos
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BigMetric
          label="MRR"
          value={formatPYG(data.mrr)}
          sub={`${data.counts.active} suscripciones activas`}
          icon={TrendingUp}
          tone="success"
        />
        <BigMetric
          label="ARR proyectado"
          value={formatPYG(data.arr)}
          sub="MRR × 12 meses"
          icon={Sparkles}
          tone="info"
        />
        <BigMetric
          label="Revenue total"
          value={formatPYG(data.totalRevenue)}
          sub={`${data.paymentCount} pagos recibidos`}
          icon={Wallet}
        />
        <BigMetric
          label="Crecimiento 30d"
          value={`${data.counts.newLast30}`}
          sub="nuevas suscripciones"
          icon={Users}
          tone={data.counts.growthPercent > 0 ? 'success' : 'default'}
          trend={growthTrend}
          trendValue={`${data.counts.growthPercent > 0 ? '+' : ''}${data.counts.growthPercent}%`}
        />
      </div>

      {/* Secondary metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <BigMetric
          label="Revenue este mes"
          value={formatPYG(data.monthlyRevenue)}
          sub="pagos confirmados últimos 30d"
          icon={Calendar}
        />
        <BigMetric
          label="MRR potencial"
          value={formatPYG(data.potentialMrr)}
          sub={`${data.counts.trialing} trials por convertir`}
          icon={Clock}
          tone="info"
        />
        <BigMetric
          label="MRR perdido"
          value={formatPYG(data.churnedMrr)}
          sub="por cancelaciones últimos 30d"
          icon={TrendingDown}
          tone={data.churnedMrr > 0 ? 'danger' : 'default'}
        />
        <BigMetric
          label="Tasa de churn"
          value={`${data.churnRate}%`}
          sub="suscripciones canceladas o suspendidas"
          icon={ArrowDownRight}
          tone={data.churnRate > 5 ? 'danger' : data.churnRate > 2 ? 'warning' : 'success'}
          trend={churnTrend}
          trendValue={data.churnRate > 5 ? 'Alto' : data.churnRate > 2 ? 'Medio' : 'Bajo'}
        />
      </div>

      {/* 3-column row: action items + plan breakdown + status overview */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <ActionItems counts={data.counts} churnedMrr={data.churnedMrr} />
        </div>
        <PlanBreakdown subsByPlan={data.subsByPlan} mrr={data.mrr} />
        <StatusOverview counts={data.counts} />
      </div>

      {/* Quick links footer */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/superadmin/plans', icon: CreditCard, label: 'Configurar planes', sub: 'Precios y límites' },
          { href: '/superadmin/subscriptions', icon: Users, label: 'Suscripciones', sub: 'Por organización' },
          { href: '/superadmin/invoices', icon: FileText, label: 'Historial de pagos', sub: 'Comprobantes' },
          { href: '/superadmin/saas-metrics', icon: TrendingUp, label: 'Métricas SaaS', sub: 'Uso de recursos' },
        ].map(({ href, icon: Icon, label, sub }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-slate-300 hover:bg-slate-50 dark:hover:border-slate-600 dark:hover:bg-slate-800/50"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</p>
              <p className="truncate text-xs text-slate-400">{sub}</p>
            </div>
            <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-300" />
          </Link>
        ))}
      </div>
    </div>
  )
}
