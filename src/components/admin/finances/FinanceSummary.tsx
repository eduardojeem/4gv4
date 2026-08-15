import { useState } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import { AlertTriangle, CalendarClock, CircleAlert, Landmark, TrendingUp, WalletCards } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrency } from '@/lib/currency'
import type { FinanceSummaryReport } from '@/lib/finance/server'
import { cn } from '@/lib/utils'

// Acento por tipo de métrica: da jerarquía visual para escanear de un vistazo
// (entra plata = verde, sale plata = ámbar, resultado = neutro) en vez de que
// las cuatro tarjetas se vean idénticas. El borde izquierdo de color sigue el
// mismo patrón que las tarjetas KPI de Reportes, para que el admin se sienta
// una sola app. Nunca es el único indicador: el título y la descripción dicen
// qué es cada número.
type MetricTone = 'positive' | 'expense' | 'neutral'

const METRIC_TONE: Record<MetricTone, { border: string; icon: string }> = {
  positive: { border: 'border-l-emerald-500', icon: 'text-emerald-600 dark:text-emerald-400' },
  expense: { border: 'border-l-amber-500', icon: 'text-amber-600 dark:text-amber-400' },
  neutral: { border: 'border-l-slate-400', icon: 'text-muted-foreground' },
}

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  tone = 'neutral',
}: {
  title: string
  value: number | null
  description: string
  icon: typeof WalletCards
  tone?: MetricTone
}) {
  const isNegative = value !== null && value < 0
  // Una métrica "positiva" que da negativa (p. ej. ganancia neta en pérdida)
  // deja de ser verde: el rojo del número manda y el borde acompaña.
  const toneStyle = isNegative ? { border: 'border-l-destructive', icon: 'text-destructive' } : METRIC_TONE[tone]

  return (
    <Card className={cn('border-l-4 border-border/70 shadow-sm', toneStyle.border)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 px-4 pt-4 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn('h-4 w-4', toneStyle.icon)} aria-hidden="true" />
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className={cn('text-2xl font-semibold tracking-tight', isNegative && 'text-destructive')}>
          {value === null ? 'Pendiente de costos' : formatCurrency(value)}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
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
  /** Los vencidos son urgentes: se pintan con acento destructivo para que no
   *  se confundan con los próximos, que antes se veían idénticos. */
  urgent?: boolean
}) {
  if (!rows.length) return null

  const visible = rows.slice(0, 3)
  const remaining = rows.length - visible.length
  const Icon = urgent ? CircleAlert : CalendarClock

  return (
    <section
      className={cn(
        'rounded-lg border p-4',
        urgent
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-border/70',
      )}
      aria-label={title}
    >
      <div className="flex items-start gap-3">
        <Icon
          className={cn('mt-0.5 h-4 w-4 shrink-0', urgent ? 'text-destructive' : 'text-muted-foreground')}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className={cn('text-sm font-semibold', urgent && 'text-destructive')}>{title}</h3>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
                urgent
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {rows.length}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{description}</p>
          <ul className="mt-3 space-y-1 text-sm" role="list">
            {visible.map((row) => {
                const parsed = parseISO(row.dueDate)
                const dateLabel = isValid(parsed) ? format(parsed, 'dd/MM/yyyy') : row.dueDate
                return (
                  <li key={row.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                    <span>Vence {dateLabel}</span>
                    <span className="font-medium">{formatCurrency(row.amount)}</span>
                  </li>
                )
              })}
          </ul>
          {remaining > 0 ? (
            <button
              type="button"
              onClick={onViewAll}
              className="mt-2 text-xs text-primary underline-offset-2 hover:underline"
            >
              y {remaining} más →
            </button>
          ) : null}
        </div>
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
}: {
  title: string
  description: string
  count?: number
  tone?: 'default' | 'urgent'
  action: string
  onClick?: () => void
}) {
  // #3 — Forzar tono neutral cuando el contador existe pero es cero.
  // Un badge "0" en rojo genera alarma innecesaria; la card se vuelve informativa.
  const effectiveTone = tone === 'urgent' && count === 0 ? 'default' : tone

  return (
    <article className={cn('rounded-lg border p-3', effectiveTone === 'urgent' ? 'border-destructive/40 bg-destructive/5' : 'border-border/70 bg-card')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={cn('text-sm font-semibold', effectiveTone === 'urgent' && 'text-destructive')}>{title}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        {/* Solo mostrar el badge si count tiene valor y es mayor que cero */}
        {count !== undefined && count > 0 ? (
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', effectiveTone === 'urgent' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground')}>
            {count}
          </span>
        ) : null}
      </div>
      <button type="button" onClick={onClick} className="mt-3 text-xs font-medium text-primary underline-offset-2 hover:underline">
        {action} →
      </button>
    </article>
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
  const coverageWarnings = Array.from(
    new Map(
      summary.coverageWarnings.map((warning) => [
        `${warning.code}:${warning.message}`,
        warning,
      ]),
    ).values(),
  )

  return (
    <div className="space-y-5">
      <section aria-labelledby="finance-priorities-heading" className="rounded-xl border border-border/70 bg-muted/20 p-4">
        <div className="mb-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Siguiente acción</p>
          <h2 id="finance-priorities-heading" className="text-base font-semibold">Qué requiere atención hoy</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <PriorityAction title="Pagos vencidos" description="Regularizá obligaciones atrasadas." count={summary.overdue.length} tone="urgent" action="Ver gastos" onClick={onViewExpenses} />
          <PriorityAction title="Próximos vencimientos" description="Planificá los pagos que están por vencer." count={summary.upcomingDue.length} action="Ver gastos" onClick={onViewExpenses} />
          <PriorityAction title="Datos pendientes" description="Completá costos para medir la ganancia real." count={coverageWarnings.length} action="Revisar rentabilidad" onClick={onViewProfitability} />
          <PriorityAction title="Nómina del equipo" description="Prepará, aprobá y registrá pagos al personal." action="Administrar nómina" onClick={onViewPayroll} />
        </div>
      </section>
      <Tabs value={view} onValueChange={(value) => setView(value as 'accrued' | 'cash')} className="space-y-4">
        {/* #5 — Las definiciones de cada tab se mueven a Tooltips en los triggers
            para liberar el espacio vertical que ocupaban siempre visibles. */}
        <TooltipProvider>
          <TabsList aria-label="Tipo de indicadores financieros">
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="accrued">Devengado</TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-center text-xs">
                Ingresos y costos del período, aunque no se hayan cobrado o pagado.
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <TabsTrigger value="cash">Caja</TabsTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-center text-xs">
                Dinero efectivamente cobrado y pagado durante el período.
              </TooltipContent>
            </Tooltip>
          </TabsList>
        </TooltipProvider>


        <TabsContent value="accrued">
          <section aria-labelledby="finance-accrued-heading">
            <div className="mb-3 flex items-center gap-2">
              <Landmark className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <h2 id="finance-accrued-heading" className="text-base font-semibold">Resultado devengado</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard title="Ingresos devengados" value={summary.accrued.revenue} description="Ventas y reparaciones completadas" icon={TrendingUp} tone="positive" />
              <MetricCard title="Ganancia bruta" value={summary.accrued.grossProfit} description="Ingresos menos costos directos" icon={Landmark} tone="positive" />
              <MetricCard title="Ganancia neta devengada" value={summary.accrued.netProfit} description="Después de gastos y nómina" icon={WalletCards} tone="positive" />
              <MetricCard title="Gastos y nómina" value={summary.accrued.operatingExpenses + summary.accrued.payrollCost} description="Obligaciones del período" icon={CircleAlert} tone="expense" />
            </div>
          </section>
        </TabsContent>

        <TabsContent value="cash">
          <section aria-labelledby="finance-cash-heading">
            <div className="mb-3 flex items-center gap-2">
              <WalletCards className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              <h2 id="finance-cash-heading" className="text-base font-semibold">Flujo de caja</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <MetricCard title="Cobrado" value={summary.cash.collected} description="Entradas de efectivo registradas" icon={TrendingUp} tone="positive" />
              <MetricCard title="Pagado" value={summary.cash.paid} description="Salidas de efectivo registradas" icon={Landmark} tone="expense" />
              <MetricCard title="Flujo de caja neto" value={summary.cash.netCashFlow} description="Cobrado menos pagado" icon={WalletCards} tone="neutral" />
            </div>
          </section>
        </TabsContent>
      </Tabs>

      {coverageWarnings.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>Faltan costos o datos para completar el resultado</AlertTitle>
          <AlertDescription>
            <ul role="list">
              {coverageWarnings.map((warning) => (
                <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <DueList
          title="Vencidos"
          rows={summary.overdue}
          description="Requieren atención para evitar atrasos."
          onViewAll={onViewExpenses}
          urgent
        />
        <DueList
          title="Próximos vencimientos"
          rows={summary.upcomingDue}
          description="Obligaciones pendientes por pagar."
          onViewAll={onViewExpenses}
        />
      </div>
    </div>
  )
}
