import { useState, useMemo } from 'react'
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Landmark,
  Percent,
  PiggyBank,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrency } from '@/lib/currency'
import type { FinanceSummaryReport } from '@/lib/finance/server'
import { cn } from '@/lib/utils'

type MetricTone = 'positive' | 'expense' | 'neutral'

const METRIC_TONE: Record<MetricTone, { border: string; icon: string }> = {
  positive: {
    border: 'border-l-emerald-500',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  expense: {
    border: 'border-l-amber-500',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  neutral: {
    border: 'border-l-slate-400',
    icon: 'text-muted-foreground',
  },
}

function calculateDelta(
  current: number | null,
  previous: number | null | undefined,
): { percent: number; direction: 'up' | 'down' | 'same' } | null {
  if (current === null || previous === null || previous === undefined || previous === 0) return null
  const change = ((current - previous) / Math.abs(previous)) * 100
  if (Math.abs(change) < 0.1) return { percent: 0, direction: 'same' }
  return {
    percent: Math.round(change * 10) / 10,
    direction: change > 0 ? 'up' : 'down',
  }
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone = 'neutral',
  badgeText,
  previousValue,
  invertDeltaColor = false,
}: {
  title: string
  value: number | null
  description: string
  icon: typeof WalletCards
  tone?: MetricTone
  badgeText?: string
  previousValue?: number | null
  invertDeltaColor?: boolean
}) {
  const isNegative = value !== null && value < 0
  const toneStyle = isNegative
    ? { border: 'border-l-destructive', icon: 'text-destructive' }
    : METRIC_TONE[tone]

  const delta = calculateDelta(value, previousValue)

  return (
    <Card className={cn('relative overflow-hidden border-l-4 border-border/70 shadow-sm transition-all hover:shadow-md', toneStyle.border)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 px-4 pt-4 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        </div>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-muted/60', toneStyle.icon)}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <p className={cn('text-2xl font-bold tracking-tight', isNegative && 'text-destructive')}>
            {value === null ? 'Pendiente de costos' : formatCurrency(value)}
          </p>
          {badgeText && (
            <Badge variant="secondary" className="text-xs font-semibold">
              {badgeText}
            </Badge>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {delta && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-medium',
                delta.direction === 'same'
                  ? 'bg-muted text-muted-foreground'
                  : (delta.direction === 'up' && !invertDeltaColor) || (delta.direction === 'down' && invertDeltaColor)
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                    : 'bg-destructive/10 text-destructive',
              )}
            >
              {delta.direction === 'up' ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : delta.direction === 'down' ? (
                <ArrowDownRight className="h-3 w-3" />
              ) : null}
              {delta.percent > 0 ? `+${delta.percent}%` : `${delta.percent}%`}
              <span className="text-[10px] text-muted-foreground"> vs ant.</span>
            </span>
          )}
          <span>{description}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function formatRelativeDue(dueDateString: string): { label: string; isPast: boolean; isToday: boolean } {
  const parsed = parseISO(dueDateString)
  if (!isValid(parsed)) return { label: dueDateString, isPast: false, isToday: false }
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = differenceInCalendarDays(parsed, today)

  if (diffDays < 0) {
    const days = Math.abs(diffDays)
    return { label: `Venció hace ${days} ${days === 1 ? 'día' : 'días'}`, isPast: true, isToday: false }
  }
  if (diffDays === 0) {
    return { label: 'Vence hoy', isPast: false, isToday: true }
  }
  if (diffDays === 1) {
    return { label: 'Vence mañana', isPast: false, isToday: false }
  }
  return { label: `Vence en ${diffDays} días`, isPast: false, isToday: false }
}

function DueList({
  title,
  rows,
  description,
  onViewAll,
  urgent = false,
}: {
  title: string
  rows: FinanceSummaryReport['upcomingDue']
  description: string
  onViewAll?: () => void
  urgent?: boolean
}) {
  const totalAmount = useMemo(() => rows.reduce((acc, row) => acc + row.amount, 0), [rows])

  if (!rows.length) {
    return (
      <section
        className="flex min-h-[140px] flex-col items-center justify-center rounded-xl border border-dashed border-border/70 p-6 text-center"
        aria-label={title}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <h3 className="mt-2 text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">Sin obligaciones pendientes registradas.</p>
      </section>
    )
  }

  const visible = rows.slice(0, 4)
  const remaining = rows.length - visible.length
  const Icon = urgent ? CircleAlert : CalendarClock

  return (
    <section
      className={cn(
        'rounded-xl border p-4 shadow-sm transition-all',
        urgent
          ? 'border-destructive/30 bg-destructive/5'
          : 'border-border/70 bg-card',
      )}
      aria-label={title}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              urgent ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className={cn('text-sm font-semibold', urgent && 'text-destructive')}>{title}</h3>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                  urgent
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {rows.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-muted-foreground">Total</span>
          <p className={cn('text-sm font-bold', urgent ? 'text-destructive' : 'text-foreground')}>
            {formatCurrency(totalAmount)}
          </p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-border/60 rounded-lg border border-border/50 bg-background/50 text-sm">
        {visible.map((row) => {
          const parsed = parseISO(row.dueDate)
          const dateLabel = isValid(parsed) ? format(parsed, 'dd/MM/yyyy') : row.dueDate
          const relative = formatRelativeDue(row.dueDate)

          return (
            <div key={row.id} className="flex items-center justify-between p-2.5 transition-colors hover:bg-muted/40">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{dateLabel}</span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[11px] font-medium',
                      relative.isPast
                        ? 'bg-destructive/10 text-destructive font-semibold'
                        : relative.isToday
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {relative.label}
                  </span>
                </div>
              </div>
              <span className="font-semibold tabular-nums text-foreground">{formatCurrency(row.amount)}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex items-center justify-between">
        {remaining > 0 ? (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-medium text-primary underline-offset-2 hover:underline"
          >
            Ver {remaining} obligaciones más →
          </button>
        ) : <div />}

        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-semibold text-primary hover:underline"
        >
          Gestionar en Gastos →
        </button>
      </div>
    </section>
  )
}

function PriorityAction({
  title,
  description,
  count,
  tone = 'default',
  action,
  onClick,
  icon: Icon = CircleAlert,
}: {
  title: string
  description: string
  count?: number
  tone?: 'default' | 'urgent' | 'success'
  action: string
  onClick?: () => void
  icon?: typeof CircleAlert
}) {
  const effectiveTone = tone === 'urgent' && count === 0 ? 'default' : tone

  return (
    <article
      className={cn(
        'group relative flex flex-col justify-between rounded-xl border p-4 transition-all hover:border-primary/50 hover:shadow-sm',
        effectiveTone === 'urgent'
          ? 'border-destructive/40 bg-destructive/5'
          : effectiveTone === 'success'
            ? 'border-emerald-500/30 bg-emerald-500/5'
            : 'border-border/70 bg-card',
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md',
                effectiveTone === 'urgent'
                  ? 'bg-destructive/10 text-destructive'
                  : effectiveTone === 'success'
                    ? 'bg-emerald-500/10 text-emerald-600'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <p className={cn('text-sm font-semibold', effectiveTone === 'urgent' && 'text-destructive')}>{title}</p>
          </div>
          {count !== undefined && count > 0 ? (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                effectiveTone === 'urgent' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
              )}
            >
              {count}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{description}</p>
      </div>

      <button
        type="button"
        onClick={onClick}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-2 hover:underline group-hover:translate-x-0.5 transition-transform"
      >
        <span>{action}</span>
        <ChevronRight className="h-3 w-3" />
      </button>
    </article>
  )
}

function CostStructureBreakdown({
  revenue,
  directCosts,
  operatingExpenses,
  payrollCost,
  netProfit,
}: {
  revenue: number
  directCosts: number | null
  operatingExpenses: number
  payrollCost: number
  netProfit: number | null
}) {
  if (revenue <= 0) return null

  const costDirectPercent = directCosts !== null ? Math.round((directCosts / revenue) * 100) : 0
  const opexPercent = Math.round((operatingExpenses / revenue) * 100)
  const payrollPercent = Math.round((payrollCost / revenue) * 100)
  const netProfitPercent = netProfit !== null ? Math.round((netProfit / revenue) * 100) : null

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold">Distribución de Ingresos del Período</h3>
          <p className="text-xs text-muted-foreground">Porcentaje de cada peso generado destinado a costos, gastos y resultado neto.</p>
        </div>
        <Badge variant="outline" className="font-mono text-xs">
          Base: {formatCurrency(revenue)} (100%)
        </Badge>
      </div>

      {/* Barra visual proporcional */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {costDirectPercent > 0 && (
          <div
            style={{ width: `${Math.min(costDirectPercent, 100)}%` }}
            className="bg-amber-500 transition-all"
            title={`Costos directos: ${costDirectPercent}%`}
          />
        )}
        {opexPercent > 0 && (
          <div
            style={{ width: `${Math.min(opexPercent, 100)}%` }}
            className="bg-rose-500 transition-all"
            title={`Gastos operativos: ${opexPercent}%`}
          />
        )}
        {payrollPercent > 0 && (
          <div
            style={{ width: `${Math.min(payrollPercent, 100)}%` }}
            className="bg-blue-500 transition-all"
            title={`Nómina: ${payrollPercent}%`}
          />
        )}
        {netProfitPercent !== null && netProfitPercent > 0 && (
          <div
            style={{ width: `${Math.min(netProfitPercent, 100)}%` }}
            className="bg-emerald-500 transition-all"
            title={`Ganancia neta: ${netProfitPercent}%`}
          />
        )}
      </div>

      {/* Leyenda y detalles */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">Costos directos</span>
          </div>
          <p className="mt-1 text-sm font-semibold">
            {directCosts === null ? 'Pendiente' : formatCurrency(directCosts)}
          </p>
          <span className="text-[11px] text-muted-foreground font-mono">{costDirectPercent}% de ingresos</span>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">Gastos fijos/OPEX</span>
          </div>
          <p className="mt-1 text-sm font-semibold">{formatCurrency(operatingExpenses)}</p>
          <span className="text-[11px] text-muted-foreground font-mono">{opexPercent}% de ingresos</span>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">Nómina y sueldos</span>
          </div>
          <p className="mt-1 text-sm font-semibold">{formatCurrency(payrollCost)}</p>
          <span className="text-[11px] text-muted-foreground font-mono">{payrollPercent}% de ingresos</span>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'h-2.5 w-2.5 rounded-full shrink-0',
                netProfitPercent !== null && netProfitPercent < 0 ? 'bg-destructive' : 'bg-emerald-500',
              )}
            />
            <span className="text-xs font-medium text-muted-foreground">Ganancia Neta</span>
          </div>
          <p
            className={cn(
              'mt-1 text-sm font-semibold',
              netProfit !== null && netProfit < 0 && 'text-destructive',
            )}
          >
            {netProfit === null ? 'Pendiente' : formatCurrency(netProfit)}
          </p>
          <span className="text-[11px] text-muted-foreground font-mono">
            {netProfitPercent !== null ? `${netProfitPercent}% margen neto` : 'Incompleto'}
          </span>
        </div>
      </div>
    </div>
  )
}

function CashFlowInsights({
  collected,
  paid,
  netCashFlow,
  revenue,
}: {
  collected: number
  paid: number
  netCashFlow: number
  revenue: number
}) {
  const collectionRate = revenue > 0 ? Math.round((collected / revenue) * 100) : null
  const isPositiveFlow = netCashFlow >= 0

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold">Salud del Flujo de Fondos</h3>
          <p className="text-xs text-muted-foreground">Efectividad de cobranza y liquidez operativa del período.</p>
        </div>
        <Badge
          className={cn(
            'text-xs font-semibold',
            isPositiveFlow
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
              : 'bg-destructive/10 text-destructive border-destructive/30',
          )}
          variant="outline"
        >
          {isPositiveFlow ? 'Superávit de Caja' : 'Déficit de Caja'}
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Tasa de Cobranza</span>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-1 text-xl font-bold">
            {collectionRate !== null ? `${collectionRate}%` : 'N/A'}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Del total de ventas devengadas cobrado efectivamente en caja o banco.
          </p>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Cobertura de Salidas</span>
            <PiggyBank className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-1 text-xl font-bold">
            {paid > 0 ? `${(collected / paid).toFixed(2)}x` : 'N/A'}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Pesos cobrados por cada peso pagado en el período.
          </p>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Saldo Neto Operativo</span>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className={cn('mt-1 text-xl font-bold', !isPositiveFlow && 'text-destructive')}>
            {formatCurrency(netCashFlow)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Dinero real disponible tras compensar todos los pagos.
          </p>
        </div>
      </div>
    </div>
  )
}

export function FinanceSummary({
  summary,
  onViewExpenses,
  onViewProfitability,
  onViewPayroll,
}: {
  summary: FinanceSummaryReport
  onViewExpenses?: () => void
  onViewProfitability?: () => void
  onViewPayroll?: () => void
}) {
  const [view, setView] = useState<'accrued' | 'cash'>('accrued')
  const coverageWarnings = useMemo(
    () =>
      Array.from(
        new Map(
          summary.coverageWarnings.map((warning) => [
            `${warning.code}:${warning.message}`,
            warning,
          ]),
        ).values(),
      ),
    [summary.coverageWarnings],
  )

  // Margen bruto y margen neto calculados
  const grossMarginPercent =
    summary.accrued.revenue > 0 && summary.accrued.grossProfit !== null
      ? `${Math.round((summary.accrued.grossProfit / summary.accrued.revenue) * 100)}% margen`
      : undefined

  const netMarginPercent =
    summary.accrued.revenue > 0 && summary.accrued.netProfit !== null
      ? `${Math.round((summary.accrued.netProfit / summary.accrued.revenue) * 100)}% margen neto`
      : undefined

  return (
    <div className="space-y-6">
      {/* Sección 1: Prioridades y Acciones Urgentes */}
      <section aria-labelledby="finance-priorities-heading" className="rounded-xl border border-border/70 bg-muted/20 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Siguiente acción</p>
            <h2 id="finance-priorities-heading" className="text-base font-semibold">Qué requiere atención hoy</h2>
          </div>
          {summary.complete ? (
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs gap-1 hidden sm:flex">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Costos completos
            </Badge>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PriorityAction
            title="Pagos vencidos"
            description="Regularizá obligaciones atrasadas para evitar recargos."
            count={summary.overdue.length}
            tone={summary.overdue.length > 0 ? 'urgent' : 'default'}
            action="Ver gastos"
            onClick={onViewExpenses}
            icon={CircleAlert}
          />
          <PriorityAction
            title="Próximos vencimientos"
            description="Planificá los pagos y compromisos de los próximos días."
            count={summary.upcomingDue.length}
            action="Ver gastos"
            onClick={onViewExpenses}
            icon={CalendarClock}
          />
          <PriorityAction
            title="Datos pendientes"
            description="Completá costos para medir la ganancia real sin desvíos."
            count={coverageWarnings.length}
            tone={coverageWarnings.length > 0 ? 'urgent' : 'default'}
            action="Revisar rentabilidad"
            onClick={onViewProfitability}
            icon={AlertTriangle}
          />
          <PriorityAction
            title="Nómina del equipo"
            description="Prepará, aprobá y registrá pagos al personal y comisiones."
            action="Administrar nómina"
            onClick={onViewPayroll}
            icon={Users}
          />
        </div>
      </section>

      {/* Sección 2: Pestañas Devengado vs Caja */}
      <Tabs value={view} onValueChange={(value) => setView(value as 'accrued' | 'cash')} className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TooltipProvider>
            <TabsList aria-label="Tipo de indicadores financieros" className="grid grid-cols-2 w-full max-w-xs">
              {/* El tooltip envuelve un contenedor propio y no la pestaña: si
                  ambos comparten el nodo, el data-state="closed" del tooltip pisa
                  al data-state="active" de la pestaña y se pierde el resaltado de
                  la solapa activa. El display:contents mantiene la grilla y deja
                  la pestaña como hija directa del tablist. */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="contents">
                    <TabsTrigger value="accrued" className="gap-1.5">
                      <Landmark className="h-3.5 w-3.5" />
                      Devengado
                    </TabsTrigger>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                  Ingresos y costos correspondientes al período seleccionado, independientemente de cuándo se cobren o paguen.
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="contents">
                    <TabsTrigger value="cash" className="gap-1.5">
                      <WalletCards className="h-3.5 w-3.5" />
                      Caja
                    </TabsTrigger>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[240px] text-xs">
                  Flujo de efectivo real: dinero efectivamente cobrado y pagado en mano o bancos en el período.
                </TooltipContent>
              </Tooltip>
            </TabsList>
          </TooltipProvider>

          {summary.generatedAt && (
            <span className="text-xs text-muted-foreground">
              Datos al {isValid(parseISO(summary.generatedAt)) ? format(parseISO(summary.generatedAt), 'dd/MM/yyyy HH:mm') : summary.generatedAt}
            </span>
          )}
        </div>

        {/* Tab 1: Devengado */}
        <TabsContent value="accrued" className="space-y-4 mt-0">
          <section aria-labelledby="finance-accrued-heading">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <h2 id="finance-accrued-heading" className="text-base font-semibold">Resultado devengado</h2>
              </div>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Medición económica real de la actividad
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Ingresos devengados"
                value={summary.accrued.revenue}
                description="Ventas y reparaciones completadas"
                icon={TrendingUp}
                tone="positive"
                previousValue={summary.comparison?.accrued?.revenue}
              />
              <MetricCard
                title="Ganancia bruta"
                value={summary.accrued.grossProfit}
                description="Ingresos menos costos directos (COGS)"
                icon={Landmark}
                tone="positive"
                badgeText={grossMarginPercent}
                previousValue={summary.comparison?.accrued?.grossProfit}
              />
              <MetricCard
                title="Ganancia neta devengada"
                value={summary.accrued.netProfit}
                description="Resultado final después de gastos y nómina"
                icon={WalletCards}
                tone="positive"
                badgeText={netMarginPercent}
                previousValue={summary.comparison?.accrued?.netProfit}
              />
              <MetricCard
                title="Gastos y nómina"
                value={summary.accrued.operatingExpenses + summary.accrued.payrollCost}
                description="Obligaciones operativas devengadas"
                icon={CircleAlert}
                tone="expense"
                invertDeltaColor
                previousValue={
                  summary.comparison?.accrued
                    ? summary.comparison.accrued.operatingExpenses + summary.comparison.accrued.payrollCost
                    : undefined
                }
              />
            </div>
          </section>

          {/* Desglose visual de rentabilidad y costos */}
          <CostStructureBreakdown
            revenue={summary.accrued.revenue}
            directCosts={summary.accrued.directCosts}
            operatingExpenses={summary.accrued.operatingExpenses}
            payrollCost={summary.accrued.payrollCost}
            netProfit={summary.accrued.netProfit}
          />
        </TabsContent>

        {/* Tab 2: Caja */}
        <TabsContent value="cash" className="space-y-4 mt-0">
          <section aria-labelledby="finance-cash-heading">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WalletCards className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                <h2 id="finance-cash-heading" className="text-base font-semibold">Flujo de caja</h2>
              </div>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Movimientos efectivos de dinero
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard
                title="Cobrado"
                value={summary.cash.collected}
                description="Entradas de efectivo registradas"
                icon={TrendingUp}
                tone="positive"
                previousValue={summary.comparison?.cash?.collected}
              />
              <MetricCard
                title="Pagado"
                value={summary.cash.paid}
                description="Salidas de efectivo registradas"
                icon={Landmark}
                tone="expense"
                invertDeltaColor
                previousValue={summary.comparison?.cash?.paid}
              />
              <MetricCard
                title="Flujo de caja neto"
                value={summary.cash.netCashFlow}
                description="Cobrado menos pagado en el período"
                icon={WalletCards}
                tone={summary.cash.netCashFlow >= 0 ? 'positive' : 'expense'}
                previousValue={summary.comparison?.cash?.netCashFlow}
              />
            </div>
          </section>

          {/* Insights de liquidez de caja */}
          <CashFlowInsights
            collected={summary.cash.collected}
            paid={summary.cash.paid}
            netCashFlow={summary.cash.netCashFlow}
            revenue={summary.accrued.revenue}
          />
        </TabsContent>
      </Tabs>

      {/* Alerta de Cobertura */}
      {coverageWarnings.length > 0 && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/5">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle className="font-semibold">Faltan costos o datos para completar el resultado</AlertTitle>
          <AlertDescription className="mt-2 text-xs">
            <p className="mb-2">
              Se detectaron registros sin costo unitario o asignación requerida. La ganancia bruta y neta no pueden calcularse de forma definitiva hasta completar estos datos.
            </p>
            <ul role="list" className="list-disc pl-4 space-y-1">
              {coverageWarnings.map((warning) => (
                <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
              ))}
            </ul>
            {onViewProfitability && (
              <button
                type="button"
                onClick={onViewProfitability}
                className="mt-3 font-semibold underline underline-offset-4 hover:opacity-80 block"
              >
                Ir a Rentabilidad para auditar costos →
              </button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Sección 3: Vencimientos y Obligaciones */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DueList
          title="Vencidos"
          rows={summary.overdue}
          description="Obligaciones atrasadas que requieren regularización inmediata."
          onViewAll={onViewExpenses}
          urgent
        />
        <DueList
          title="Próximos vencimientos"
          rows={summary.upcomingDue}
          description="Obligaciones planificadas para los próximos días."
          onViewAll={onViewExpenses}
        />
      </div>
    </div>
  )
}
