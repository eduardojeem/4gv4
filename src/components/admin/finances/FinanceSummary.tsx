import { useState, useMemo } from 'react'
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  FileDown,
  Globe,
  Landmark,
  Package,
  Percent,
  PiggyBank,
  Scissors,
  TrendingUp,
  Users,
  WalletCards,
  Wrench,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrency } from '@/lib/currency'
import { exportFinanceSummaryPdf } from '@/lib/finances/finance-reports-pdf-exporter'
import type { FinanceSummaryReport } from '@/lib/finance/server'
import { cn } from '@/lib/utils'
import { reconciliationGuidance } from '@/lib/finance/reconciliation-guidance'
import { comparisonText, financeHeadline } from '@/lib/finance/headline'
import {
  financeWarningAction,
  financeWarningImpact,
  financeWarningSourceHref,
  financeWarningTitle,
} from '@/lib/finance/warning-actions'
import { FinanceMetricExplanation } from './FinanceMetricExplanation'

/** Cuantos registros se nombran antes de resumir el resto en "y N mas". */
const MAX_LISTED_SOURCES = 6

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

type RevenueBreakdown = NonNullable<FinanceSummaryReport['accrued']['revenueBreakdown']>

/**
 * ¿De dónde vienen los ingresos? Mercadería, servicios, reparaciones (con su
 * mano de obra y repuestos) y pedidos web. Antes todo era un solo número.
 */
export function RevenueSourcesBreakdown({ breakdown }: { breakdown: RevenueBreakdown }) {
  const sources = [
    { key: 'merchandise', label: 'Mercadería', hint: 'Productos vendidos en caja', value: breakdown.merchandise, icon: Package },
    { key: 'services', label: 'Servicios', hint: 'Servicios y turnos cobrados en caja', value: breakdown.services, icon: Scissors },
    {
      key: 'repairs',
      label: 'Reparaciones',
      hint: breakdown.repairs.count === 1 ? '1 entregada en el período' : `${breakdown.repairs.count} entregadas en el período`,
      value: breakdown.repairs.total,
      icon: Wrench,
    },
    { key: 'orders', label: 'Pedidos web', hint: 'Tienda online', value: breakdown.orders, icon: Globe },
    { key: 'interest', label: 'Intereses', hint: 'Cobrados en cuotas de créditos', value: breakdown.interest ?? 0, icon: Percent },
    { key: 'cashOverage', label: 'Sobrantes de caja', hint: 'Contaste más de lo esperado al cerrar', value: breakdown.cashOverage ?? 0, icon: WalletCards },
    // Solo lo que tuvo movimiento: una barbería no ve «Reparaciones» en cero.
  ].filter((source) => source.value > 0)
  const total = breakdown.grossRevenue
  return (
    <section aria-labelledby="finance-revenue-sources-heading" className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="finance-revenue-sources-heading" className="text-sm font-semibold">¿De dónde vienen los ingresos?</h3>
        <span className="text-xs text-muted-foreground">
          Ventas, servicios y pedidos por fecha de venta; reparaciones por fecha de entrega
        </span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {sources.map(({ key, label, hint, value, icon: Icon }) => {
          const share = total > 0 ? Math.round((Math.max(0, value) / total) * 100) : 0
          return (
            <li key={key} className="rounded-lg border bg-muted/20 p-3" data-testid={`revenue-source-${key}`}>
              <div className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                {label}
                <span className="ml-auto text-xs font-normal text-muted-foreground">{share}%</span>
              </div>
              <p className="mt-1 text-lg font-bold tabular-nums">{formatCurrency(value)}</p>
              <p className="text-xs text-muted-foreground">{hint}</p>
              {key === 'repairs' && breakdown.repairs.total > 0 && (
                <dl className="mt-2 grid grid-cols-2 gap-1 border-t pt-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Mano de obra</dt>
                    <dd className="font-semibold tabular-nums">{formatCurrency(breakdown.repairs.labor)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Repuestos y materiales</dt>
                    <dd className="font-semibold tabular-nums">{formatCurrency(breakdown.repairs.parts)}</dd>
                  </div>
                </dl>
              )}
            </li>
          )
        })}
      </ul>
      {breakdown.refunds > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Menos devoluciones del período: <span className="font-semibold tabular-nums">{formatCurrency(breakdown.refunds)}</span>
        </p>
      )}
    </section>
  )
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
                <p className="truncate text-sm font-medium">{row.concept || 'Obligación pendiente'}</p>
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
          {/* Puede quedar negativo cuando vuelve mas mercaderia por devoluciones
              de lo que se vendio en el periodo. El numero es correcto, pero solo
              se entiende con esta aclaracion. */}
          {directCosts !== null && directCosts < 0 ? (
            <span className="text-[11px] text-muted-foreground">
              Volvió más mercadería por devoluciones que lo vendido en el período.
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground font-mono">{costDirectPercent}% de ingresos</span>
          )}
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
          <p className="text-xs text-muted-foreground">Relación entre los cobros y pagos registrados en el período.</p>
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
            <span className="text-xs text-muted-foreground">Cobros / ingresos del período</span>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-1 text-xl font-bold">
            {collectionRate !== null ? `${collectionRate}%` : 'N/A'}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            No mide la deuda cobrada: puede incluir cobros de ventas de meses anteriores y superar el 100%.
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
            Unidades monetarias cobradas por cada unidad pagada en el período.
          </p>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Flujo neto del período</span>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className={cn('mt-1 text-xl font-bold', !isPositiveFlow && 'text-destructive')}>
            {formatCurrency(netCashFlow)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Flujo neto del período. No representa el saldo disponible de caja o banco.
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
  onOpenBusinessGuide,
}: {
  summary: FinanceSummaryReport
  onViewExpenses?: (action?: 'new' | 'overdue' | 'upcoming' | 'all') => void
  onViewProfitability?: () => void
  onViewPayroll?: () => void
  onOpenBusinessGuide?: () => void
}) {
  const [view, setView] = useState<'accrued' | 'cash'>('accrued')
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [exportPdfError, setExportPdfError] = useState<string | null>(null)

  async function handleExportPdf() {
    if (isExportingPdf) return
    setIsExportingPdf(true)
    setExportPdfError(null)
    try {
      await exportFinanceSummaryPdf({
        summary,
        startDate: summary.filters?.startDate,
        endDate: summary.filters?.endDate,
      })
    } catch (err) {
      console.error('Error al exportar resumen en PDF:', err)
      setExportPdfError('No se pudo generar el reporte PDF.')
    } finally {
      setIsExportingPdf(false)
    }
  }
  /**
   * Los avisos vienen de a uno por registro. Antes se deduplicaban por mensaje y
   * se descartaba el registro, asi que el panel decia que faltaba algo pero no
   * que: 200 avisos colapsados en una frase. Ahora se agrupan conservando
   * cuantos son y como se llaman, para poder ir a completarlos.
   */
  const coverageWarnings = useMemo(() => {
    const groups = new Map<
      string,
      { code: string; message: string; count: number; labels: string[]; sources: Array<{ label: string; href: string }> }
    >()
    for (const warning of summary.coverageWarnings) {
      const key = warning.code
      const group = groups.get(key) ?? {
        code: warning.code,
        message: warning.message,
        count: 0,
        labels: [],
        sources: [],
      }
      group.count += 1
      const label = warning.sourceLabel?.trim()
      if (label && !group.labels.includes(label)) {
        group.labels.push(label)
        const href = financeWarningSourceHref(warning.sourceType, warning.sourceId)
        if (href) group.sources.push({ label, href })
      }
      groups.set(key, group)
    }
    return Array.from(groups.values())
  }, [summary.coverageWarnings])
  // «Esta semana»: 7 días desde hoy, en la zona del negocio (el servidor ya
  // calculó «hoy» así; acá se compara solo la fecha, sin hora del dispositivo).
  const weekLimit = useMemo(() => {
    const today = summary.generatedAt ? summary.generatedAt.slice(0, 10) : new Date().toISOString().slice(0, 10)
    const limit = new Date(`${today}T00:00:00Z`)
    limit.setUTCDate(limit.getUTCDate() + 7)
    return limit.toISOString().slice(0, 10)
  }, [summary.generatedAt])
  const dueThisWeek = summary.upcomingDue.filter((row) => row.dueDate <= weekLimit)
  const dueLater = summary.upcomingDue.filter((row) => row.dueDate > weekLimit)
  const headline = financeHeadline(summary.accrued)
  const previousHeadline = summary.comparison ? financeHeadline(summary.comparison.accrued) : null
  const profitComparison = comparisonText(headline.profit, previousHeadline?.profit)
  const revenueComparison = comparisonText(summary.accrued.revenue, summary.comparison?.accrued?.revenue)

  // Margen bruto y margen neto calculados
  const grossMarginPercent =
    summary.accrued.revenue > 0 && summary.accrued.grossProfit !== null
      ? `${Math.round((summary.accrued.grossProfit / summary.accrued.revenue) * 100)}% margen`
      : undefined

  const netMarginPercent =
    summary.accrued.revenue > 0 && summary.accrued.netProfit !== null
      ? `${Math.round((summary.accrued.netProfit / summary.accrued.revenue) * 100)}% margen neto`
      : undefined

  const isNetPositive = headline.profit >= 0
  const isCashPositive = summary.cash.netCashFlow >= 0

  return (
    <div className="space-y-6">
      {/* ── HERO BANNER: BALANCE FINANCIERO INTEGRAL ── */}
      <section className="rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          
          {/* Bloque 1: Ganancia Neta */}
          <div className="space-y-1.5 min-w-[220px]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {isNetPositive ? 'Ganaste' : 'Perdiste'}
              </span>
              {headline.estimated && (
                <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                  Aproximado · faltan datos
                </Badge>
              )}
              {!headline.estimated && netMarginPercent && (
                <Badge
                  variant="outline"
                  className={cn(
                    'text-[10px] font-bold',
                    isNetPositive
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : 'bg-destructive/10 text-destructive border-destructive/30'
                  )}
                >
                  {netMarginPercent}
                </Badge>
              )}
            </div>
            <p
              data-testid="finance-headline-profit"
              className={cn(
                'text-2xl sm:text-3xl font-bold tracking-tight',
                headline.estimated
                  ? 'text-foreground'
                  : isNetPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
              )}
            >
              {formatCurrency(Math.abs(headline.profit))}
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.accrued.revenue > 0
                ? headline.marginPct !== null && headline.marginPct >= 0
                  ? `Vendiste ${formatCurrency(summary.accrued.revenue)}: de cada Gs. 100 te quedaron Gs. ${headline.marginPct}`
                  : `Vendiste ${formatCurrency(summary.accrued.revenue)}, pero los costos y gastos fueron más`
                : 'Todavía no hay ventas en el período'}
            </p>
            {profitComparison && (
              <p className="text-xs font-medium text-foreground" data-testid="finance-headline-comparison">
                {isNetPositive ? 'Ganancia' : 'Resultado'}: {profitComparison}
                {revenueComparison && <span className="font-normal text-muted-foreground"> · Ventas: {revenueComparison}</span>}
              </p>
            )}
            {headline.estimated && (
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Sale más alto de lo real: hay ventas sin costo o reparaciones sin precio. Completalos abajo, en «Para que los números sean exactos».
              </p>
            )}
            <FinanceMetricExplanation kind="economic" />
          </div>

          <div className="hidden lg:block h-16 w-px bg-border/80" />

          {/* Bloque 2: Flujo de Caja en Mano */}
          <div className="space-y-1.5 min-w-[220px]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Entró menos salió
              </span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] font-bold',
                  isCashPositive
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                    : 'bg-destructive/10 text-destructive border-destructive/30'
                )}
              >
                {isCashPositive ? 'Entró más de lo que salió' : 'Salió más de lo que entró'}
              </Badge>
            </div>
            <p className={cn('text-2xl sm:text-3xl font-bold tracking-tight', isCashPositive ? 'text-foreground' : 'text-destructive')}>
              {formatCurrency(summary.cash.netCashFlow)}
            </p>
            <p className="text-xs text-muted-foreground">
              Entró {formatCurrency(summary.cash.collected)} · salió {formatCurrency(summary.cash.paid)}
            </p>
            <p className="text-xs text-muted-foreground">Es lo que se movió en el período, no lo que hay hoy en caja o en el banco.</p>
            <FinanceMetricExplanation kind="cash" />
          </div>

          <div className="hidden lg:block h-16 w-px bg-border/80" />

          {/* Bloque 3: Acciones Rápidas */}
          <div className="flex flex-wrap lg:flex-col gap-2">
            <button
              type="button"
              onClick={() => onViewExpenses?.('new')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-xs hover:bg-primary/90 transition-all active:scale-95 select-none"
            >
              <span>+ Anotar gasto</span>
            </button>
            <button
              type="button"
              onClick={onViewPayroll}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-all active:scale-95 select-none"
            >
              <span>Sueldos y comisiones</span>
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExportingPdf}
              aria-busy={isExportingPdf}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted hover:border-primary/40 transition-all active:scale-95 select-none disabled:opacity-50"
              title="Descargar balance y resumen financiero en PDF"
            >
              <FileDown className="h-3.5 w-3.5 text-primary" />
              <span>{isExportingPdf ? 'Generando…' : 'Descargar PDF'}</span>
            </button>
            {onOpenBusinessGuide && (
              <button
                type="button"
                onClick={onOpenBusinessGuide}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2 text-xs font-bold text-primary hover:bg-primary/10 transition-all active:scale-95 select-none"
              >
                <BookOpenCheck className="h-3.5 w-3.5" />
                <span>Guía de Gestión</span>
              </button>
            )}
            {exportPdfError && (
              <p role="alert" className="text-[11px] text-destructive font-medium">
                {exportPdfError}
              </p>
            )}
          </div>

        </div>
      </section>

      {/* Sección 1: Prioridades y Acciones Urgentes */}
      <section aria-labelledby="finance-priorities-heading" className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Siguiente acción</p>
            <h2 id="finance-priorities-heading" className="text-sm sm:text-base font-bold text-foreground">
              Qué necesita tu atención
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">Las cuentas a pagar incluyen las de meses anteriores que siguen sin pagar.</p>
          </div>
          {summary.complete ? (
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs gap-1 hidden sm:flex font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Costos completos
            </Badge>
          ) : null}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <PriorityAction
            title="Ya vencieron"
            description="Cuentas atrasadas: pagalas para evitar recargos o cortes."
            count={summary.overdue.length}
            tone={summary.overdue.length > 0 ? 'urgent' : 'default'}
            action="Ver y pagar"
            onClick={() => onViewExpenses?.('overdue')}
            icon={CircleAlert}
          />
          <PriorityAction
            title="Para pagar esta semana"
            description="Cuentas que vencen en los próximos 7 días."
            count={dueThisWeek.length}
            action="Ver cuentas a pagar"
            onClick={() => onViewExpenses?.('upcoming')}
            icon={CalendarClock}
          />
          <PriorityAction
            title="Faltan datos"
            description="Costos o precios sin cargar: sin ellos la ganancia sale aproximada."
            count={coverageWarnings.reduce((total, warning) => total + warning.count, 0)}
            tone={coverageWarnings.length > 0 ? 'urgent' : 'default'}
            action="Completar ahora"
            onClick={() => document.getElementById('finance-data-warnings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            icon={AlertTriangle}
          />
          {summary.receivables && summary.receivables.total > 0 ? (
            <PriorityAction
              title="Te deben"
              description={`${formatCurrency(summary.receivables.total)} de ${summary.receivables.customers === 1 ? '1 cliente' : `${summary.receivables.customers} clientes`}${summary.receivables.overdue > 0 ? ` · ${formatCurrency(summary.receivables.overdue)} ya vencido` : ''}.`}
              count={summary.receivables.customers}
              tone={summary.receivables.overdue > 0 ? 'urgent' : 'default'}
              action="Ver quién te debe"
              onClick={() => { window.location.href = '/dashboard/credits' }}
              icon={Banknote}
            />
          ) : (
            <PriorityAction
              title="Sueldos y comisiones"
              description="Prepará la liquidación del equipo y registrá el pago."
              action="Ir a sueldos"
              onClick={onViewPayroll}
              icon={Users}
            />
          )}
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
          <FinanceMetricExplanation kind="accrued" />
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
                description="Ventas, servicios, pedidos y reparaciones entregadas"
                icon={TrendingUp}
                tone="positive"
                previousValue={summary.comparison?.accrued?.revenue}
              />
              <MetricCard
                title="Ganancia bruta"
                value={summary.accrued.grossProfit}
                description="Lo que queda de los ingresos después de los costos directos, antes de gastos y nómina"
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

          {summary.accrued.revenueBreakdown && (
            <RevenueSourcesBreakdown breakdown={summary.accrued.revenueBreakdown} />
          )}

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
                description="Cobros de dinero registrados, incluidos los medios de pago integrados"
                icon={TrendingUp}
                tone="positive"
                previousValue={summary.comparison?.cash?.collected}
              />
              <MetricCard
                title="Pagos netos de anulaciones"
                value={summary.cash.paid}
                description="Pagos registrados menos sus anulaciones; puede ser negativo"
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
        <Alert id="finance-data-warnings" className="scroll-mt-24 border-amber-500/50 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
          <AlertTitle className="font-semibold">Para que los números sean exactos</AlertTitle>
          <AlertDescription className="mt-2 text-xs">
            <p className="mb-2">
              No hace falta registrar de nuevo plata ya cobrada o pagada: alcanza con completar el dato que falta.
            </p>
            <ul role="list" aria-label="Datos que faltan" className="max-h-96 overflow-y-auto pr-2 space-y-4">
              {coverageWarnings.map((warning) => {
                const action = financeWarningAction(warning.code)
                return (
                <li key={warning.code} data-testid={`finance-warning-${warning.code}`}>
                  <p className="text-sm font-semibold text-foreground">{financeWarningTitle(warning.code, warning.count)}</p>
                  <p className="text-muted-foreground">{financeWarningImpact(warning.code)}</p>
                  {warning.sources.length > 0 ? (
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      {warning.sources.slice(0, MAX_LISTED_SOURCES).map((source) => (
                        <a key={source.href} href={source.href} className="font-medium text-primary underline underline-offset-4">
                          {source.label}
                        </a>
                      ))}
                      {warning.labels.length > MAX_LISTED_SOURCES && (
                        <span className="text-muted-foreground">y {warning.labels.length - MAX_LISTED_SOURCES} más</span>
                      )}
                    </span>
                  ) : warning.labels.length > 0 ? (
                    <span className="mt-0.5 block text-muted-foreground">
                      {warning.labels.slice(0, MAX_LISTED_SOURCES).join(' · ')}
                      {warning.labels.length > MAX_LISTED_SOURCES &&
                        ` y ${warning.labels.length - MAX_LISTED_SOURCES} más`}
                    </span>
                  ) : null}
                  {action && (
                    action.kind === 'link' ? (
                      <a href={action.href} className="mt-2 inline-flex min-h-9 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                        {action.label} →
                      </a>
                    ) : (
                      <button type="button" onClick={onViewPayroll} className="mt-2 inline-flex min-h-9 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                        {action.label} →
                      </button>
                    )
                  )}
                  <details className="mt-1 rounded-md border border-border/60 bg-background/50 p-2 text-foreground">
                    <summary className="min-h-11 cursor-pointer font-medium focus-visible:ring-2 focus-visible:ring-ring">Más detalle</summary>
                    <p className="mt-2 leading-relaxed">{reconciliationGuidance(warning.code)}</p>
                    <p className="mt-2 text-muted-foreground">Cuando lo completes, actualizá el resumen con el mismo período y sucursal.</p>
                  </details>
                </li>
                )
              })}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Sección 3: Vencimientos y Obligaciones */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DueList
          title="Ya vencieron"
          rows={summary.overdue}
          description="Cuentas atrasadas: pagalas primero."
          onViewAll={() => onViewExpenses?.('overdue')}
          urgent
        />
        <DueList
          title="Para pagar esta semana"
          rows={dueThisWeek}
          description={dueLater.length > 0
            ? `Vencen en los próximos 7 días. Más adelante: ${dueLater.length} ${dueLater.length === 1 ? 'cuenta' : 'cuentas'} por ${formatCurrency(dueLater.reduce((total, row) => total + row.amount, 0))}.`
            : 'Vencen en los próximos 7 días.'}
          onViewAll={() => onViewExpenses?.('upcoming')}
        />
      </div>
    </div>
  )
}
