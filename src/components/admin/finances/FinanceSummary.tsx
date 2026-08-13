import { useState } from 'react'
import { AlertTriangle, CalendarClock, CircleAlert, Landmark, TrendingUp, WalletCards } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/currency'
import type { FinanceSummaryReport } from '@/lib/finance/server'

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string
  value: number | null
  description: string
  icon: typeof WalletCards
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 px-4 pt-4 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className="text-2xl font-semibold tracking-tight">{value === null ? 'Pendiente de costos' : formatCurrency(value)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

function DueList({
  title,
  rows,
  description,
}: {
  title: string
  rows: FinanceSummaryReport['upcomingDue']
  description: string
}) {
  if (!rows.length) return null

  return (
    <section className="rounded-lg border border-border/70 p-4" aria-label={title}>
      <div className="flex items-start gap-3">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
          <ul className="mt-3 space-y-1 text-sm" role="list">
            {rows.slice(0, 3).map((row) => (
              <li key={row.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                <span>Vence {row.dueDate}</span>
                <span className="font-medium">{formatCurrency(row.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export function FinanceSummary({ summary }: { summary: FinanceSummaryReport }) {
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
              <MetricCard title="Ingresos devengados" value={summary.accrued.revenue} description="Ventas y reparaciones completadas" icon={TrendingUp} />
              <MetricCard title="Ganancia bruta" value={summary.accrued.grossProfit} description="Ingresos menos costos directos" icon={Landmark} />
              <MetricCard title="Ganancia neta devengada" value={summary.accrued.netProfit} description="Después de gastos y nómina" icon={WalletCards} />
              <MetricCard title="Gastos y nómina" value={summary.accrued.operatingExpenses + summary.accrued.payrollCost} description="Obligaciones del período" icon={CircleAlert} />
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
              <MetricCard title="Cobrado" value={summary.cash.collected} description="Entradas de efectivo registradas" icon={TrendingUp} />
              <MetricCard title="Pagado" value={summary.cash.paid} description="Salidas de efectivo registradas" icon={Landmark} />
              <MetricCard title="Flujo de caja neto" value={summary.cash.netCashFlow} description="Cobrado menos pagado" icon={WalletCards} />
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
              {coverageWarnings.map((warning) => <li key={`${warning.code}-${warning.message}`}>{warning.message}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <DueList title="Vencidos" rows={summary.overdue} description="Requieren atención para evitar atrasos." />
        <DueList title="Próximos vencimientos" rows={summary.upcomingDue} description="Obligaciones pendientes por pagar." />
      </div>
    </div>
  )
}
