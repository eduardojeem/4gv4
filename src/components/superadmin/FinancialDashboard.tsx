'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Calendar,
  CheckCircle2,
  Clock,
  RefreshCw,
  TrendingDown,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/superadmin/ui/page-header'
import { cn } from '@/lib/utils'
import type { CurrencyTotal } from '@/lib/superadmin/money-totals'

export type FinancialData = {
  mrr: number
  arr: number
  /** Suscripciones que facturan (activas, plan pago, cobro al día). */
  billingSubscriptions: number
  /** De esas, cuántas no tienen precio de plan: el MRR está incompleto. */
  unpricedSubscriptions: number
  potentialMrr: number
  churnedMrr: number
  churnRate: number
  collectedLast30: CurrencyTotal[]
  /** null si la tabla de gastos todavía no existe. */
  costs: { recurringMonthlyCost: number; netMonthly: number; marginPercent: number | null } | null
  counts: {
    trialing: number
    pastDue: number
    cancelingSoon: number
    renewalsSoon: number
    newLast30: number
    growthPercent: number
  }
  subsByPlan: Array<{ tier: string; planName: string; active: number; trialing: number; mrr: number }>
}

function gs(amount: number) {
  return new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(amount)
}

function formatCurrencyTotals(totals: CurrencyTotal[]) {
  if (totals.length === 0) return gs(0)
  return totals
    .map(({ amount, currency }) =>
      new Intl.NumberFormat('es-PY', { style: 'currency', currency, maximumFractionDigits: currency === 'PYG' ? 0 : 2 }).format(amount),
    )
    .join(' + ')
}

const PLAN_BAR: Record<string, string> = {
  FREE: 'bg-slate-400',
  BASIC: 'bg-blue-500',
  PRO: 'bg-violet-500',
  ENTERPRISE: 'bg-amber-500',
}

function Metric({
  label,
  value,
  detail,
  tone,
  href,
  size = 'lg',
}: {
  label: string
  value: string
  detail?: React.ReactNode
  tone?: 'good' | 'bad' | 'warn'
  href?: string
  size?: 'lg' | 'sm'
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-1.5 break-words font-bold tabular-nums text-slate-900 dark:text-slate-50',
          size === 'lg' ? 'text-2xl' : 'text-lg',
          tone === 'good' && 'text-emerald-700 dark:text-emerald-300',
          tone === 'bad' && 'text-red-700 dark:text-red-300',
          tone === 'warn' && 'text-amber-700 dark:text-amber-300',
        )}
      >
        {value}
      </p>
      {detail && <div className="mt-1 text-xs text-slate-500">{detail}</div>}
    </>
  )
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4">
        {href ? (
          <Link href={href} className="group block">
            {body}
            <span className="mt-1 inline-flex items-center gap-0.5 text-xs font-medium text-primary group-hover:underline">
              Ver detalle <ArrowUpRight className="h-3 w-3" />
            </span>
          </Link>
        ) : (
          body
        )}
      </CardContent>
    </Card>
  )
}

function AttentionList({ data }: { data: FinancialData }) {
  const { counts } = data
  const items: Array<{ icon: typeof AlertTriangle; tone: string; title: string; desc: string; href?: string }> = []

  if (data.unpricedSubscriptions > 0) {
    items.push({
      icon: AlertTriangle,
      tone: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300',
      title: `${data.unpricedSubscriptions} ${data.unpricedSubscriptions === 1 ? 'suscripción' : 'suscripciones'} con plan sin precio`,
      desc: 'No suman al MRR hasta que el plan tenga precio',
      href: '/superadmin/plans',
    })
  }
  if (counts.pastDue > 0) {
    items.push({
      icon: AlertTriangle,
      tone: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300',
      title: `${counts.pastDue} con pago vencido`,
      desc: 'Contactar para regularizar el cobro',
      href: '/superadmin/subscriptions?tab=attention',
    })
  }
  if (counts.cancelingSoon > 0) {
    items.push({
      icon: XCircle,
      tone: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/20 dark:text-orange-300',
      title: `${counts.cancelingSoon} cancela${counts.cancelingSoon !== 1 ? 'n' : ''} al fin del período`,
      desc: 'Oportunidad de retención',
      href: '/superadmin/subscriptions?tab=canceling',
    })
  }
  if (counts.renewalsSoon > 0) {
    items.push({
      icon: Calendar,
      tone: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300',
      title: `${counts.renewalsSoon} renueva${counts.renewalsSoon !== 1 ? 'n' : ''} en 14 días`,
      desc: 'Verificar que tengan método de pago',
      href: '/superadmin/subscriptions?tab=renewals',
    })
  }
  if (counts.trialing > 0) {
    items.push({
      icon: Clock,
      tone: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/50 dark:bg-cyan-950/20 dark:text-cyan-300',
      title: `${counts.trialing} en período de prueba`,
      desc: 'Por convertir a plan pago',
      href: '/superadmin/subscriptions?tab=trials',
    })
  }
  if (data.churnedMrr > 0) {
    items.push({
      icon: TrendingDown,
      tone: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300',
      title: `${gs(data.churnedMrr)} de MRR perdido en 30 días`,
      desc: 'Por cancelaciones y suspensiones',
    })
  }

  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Requiere atención</CardTitle>
          {items.length > 0 && <Badge variant="outline" className="rounded-full">{items.length}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
            <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Todo en orden</p>
          </div>
        ) : (
          items.map((item) => {
            const Icon = item.icon
            const content = (
              <div className={cn('flex items-start gap-2.5 rounded-lg border px-3 py-2.5', item.tone)}>
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs opacity-80">{item.desc}</p>
                </div>
                {item.href && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-50" />}
              </div>
            )
            return item.href ? (
              <Link key={item.title} href={item.href} className="block transition-opacity hover:opacity-80">
                {content}
              </Link>
            ) : (
              <div key={item.title}>{content}</div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}

function PlanBreakdown({ data }: { data: FinancialData }) {
  return (
    <Card className="rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">MRR por plan</CardTitle>
      </CardHeader>
      <CardContent>
        {data.subsByPlan.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">Sin suscripciones aún</p>
        ) : (
          <div className="space-y-4">
            {data.subsByPlan.map((plan) => {
              const share = data.mrr > 0 ? Math.round((plan.mrr / data.mrr) * 100) : 0
              return (
                <div key={plan.tier} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{plan.planName}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        {plan.active} activas{plan.trialing > 0 && ` · ${plan.trialing} en prueba`}
                      </span>
                    </span>
                    <span className="shrink-0 text-right font-bold tabular-nums">
                      {gs(plan.mrr)} <span className="ml-1 text-xs font-normal text-slate-500">{share}%</span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className={cn('h-full', PLAN_BAR[plan.tier] ?? 'bg-slate-400')} style={{ width: `${share}%` }} />
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

export function FinancialDashboard({ data }: { data: FinancialData }) {
  const router = useRouter()
  const { costs, counts } = data
  const profitable = costs ? costs.netMonthly >= 0 : undefined

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">
      <PageHeader
        icon={Banknote}
        title="Resumen"
        description="Lo que factura la plataforma, lo que cuesta operarla y lo que necesita atención. El detalle de cada tema está en su sección."
        actions={
          <Button variant="outline" size="sm" onClick={() => router.refresh()}>
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="MRR"
          value={gs(data.mrr)}
          tone={data.unpricedSubscriptions > 0 ? 'warn' : undefined}
          detail={
            <>
              {data.billingSubscriptions} suscripciones que facturan · ARR {gs(data.arr)}
              {data.unpricedSubscriptions > 0 && (
                <span className="block font-semibold text-amber-700 dark:text-amber-300">
                  Incompleto: {data.unpricedSubscriptions} con plan sin precio
                </span>
              )}
            </>
          }
        />
        <Metric
          label="Costo mensual"
          value={costs ? gs(costs.recurringMonthlyCost) : '—'}
          detail={costs ? 'Gastos recurrentes de la plataforma' : 'Sin datos de gastos todavía'}
          href="/superadmin/finanzas"
        />
        <Metric
          label="Resultado mensual"
          value={costs ? gs(costs.netMonthly) : '—'}
          tone={profitable === undefined ? undefined : profitable ? 'good' : 'bad'}
          detail={costs?.marginPercent != null ? `Margen ${costs.marginPercent.toLocaleString('es-PY')}% sobre el MRR` : 'MRR menos costo mensual'}
        />
        <Metric
          label="Cobrado (30 días)"
          value={formatCurrencyTotals(data.collectedLast30)}
          detail="Pagos confirmados en los últimos 30 días"
          href="/superadmin/invoices"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric size="sm" label="MRR potencial" value={gs(data.potentialMrr)} detail={`${counts.trialing} trials por convertir`} />
        <Metric size="sm" label="MRR perdido (30 días)" value={gs(data.churnedMrr)} tone={data.churnedMrr > 0 ? 'bad' : undefined} detail="Cancelaciones y suspensiones" />
        <Metric
          size="sm"
          label="Churn (30 días)"
          value={`${data.churnRate.toLocaleString('es-PY')}%`}
          tone={data.churnRate > 5 ? 'bad' : data.churnRate > 2 ? 'warn' : 'good'}
          detail="Bajas sobre activas del período"
        />
        <Metric
          size="sm"
          label="Nuevas (30 días)"
          value={String(counts.newLast30)}
          tone={counts.growthPercent > 0 ? 'good' : undefined}
          detail={`${counts.growthPercent > 0 ? '+' : ''}${counts.growthPercent}% vs. los 30 días anteriores`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AttentionList data={data} />
        <PlanBreakdown data={data} />
      </div>
    </div>
  )
}
