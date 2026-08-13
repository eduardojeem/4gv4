import { useState } from 'react'
import { AlertTriangle, CalendarClock, CircleAlert, Landmark, TrendingUp, WalletCards } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
            {visible.map((row) => (
              <li key={row.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                <span>Vence {row.dueDate}</span>
                <span className="font-medium">{formatCurrency(row.amount)}</span>
              </li>
            ))}
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

export function FinanceSummary({
  summary,
  onViewExpenses,
}: {
  summary: FinanceSummaryReport
  onViewExpenses?: () => void
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
      <Tabs value={view} onValueChange={(value) => setView(value as 'accrued' | 'cash')} className="space-y-4">
        <div className="rounded-lg border border-border/70 p-3">
          <TabsList aria-label="Tipo de indicadores financieros">
            <TabsTrigger value="accrued">Devengado</TabsTrigger>
            <TabsTrigger value="cash">Caja</TabsTrigger>
          </TabsList>
          <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            <p><span className="font-medium text-foreground">Resultado devengado</span>: ingresos y costos del período, aunque no se hayan cobrado o pagado.</p>
            <p><span className="font-medium text-foreground">Flujo de caja</span>: dinero efectivamente cobrado y pagado durante el período.</p>
          </div>
        </div>

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
