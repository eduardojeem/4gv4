'use client'

import {
  AlertCircle,
  CalendarClock,
  CircleDollarSign,
  CreditCard,
  HandCoins,
  Landmark,
  ReceiptText,
  TrendingUp,
  TriangleAlert,
  Users,
  FileText,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { exportCreditsSectionPDF, type ReportContext } from '@/lib/reports/section-pdf-exporter'
import type { CreditReport } from '@/lib/reports/credit-report'

type ReportsCreditsTabProps = {
  /** Nombre del negocio, para que el PDF diga de quién es. */
  brand?: string
  /** Período, sucursal y quién lo descarga: identifica el PDF una vez guardado. */
  context?: ReportContext
  report: CreditReport | null
  loading: boolean
  error: string | null
}

const statusLabels = {
  active: 'Al día',
  overdue: 'Con mora',
  completed: 'Cancelados',
} as const

const statusColors = {
  active: 'bg-blue-500',
  overdue: 'bg-rose-500',
  completed: 'bg-emerald-500',
} as const

function formatGs(value: number) {
  return `Gs. ${Math.round(value).toLocaleString('es-PY')}`
}

function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = 'text-slate-700 dark:text-slate-200',
}: {
  label: string
  value: string
  description: string
  icon: typeof CreditCard
  tone?: string
}) {
  return (
    <Card className="rounded-xl border-slate-200/80 shadow-xs dark:border-white/10 dark:bg-[#0d1117]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={`mt-2 break-words font-mono text-xl font-bold ${tone}`}>{value}</p>
          </div>
          <span className="rounded-lg bg-muted p-2 text-muted-foreground" aria-hidden="true">
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  )
}

export function ReportsCreditsTab({ brand, context, report, loading, error }: ReportsCreditsTabProps) {
  if (loading && !report) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando reporte de créditos">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error && !report) {
    return (
      <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-semibold">No se pudo cargar el reporte de créditos</p>
          <p className="mt-1 text-xs">{error}</p>
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <Card className="rounded-xl border-dashed">
        <CardContent className="flex min-h-64 flex-col items-center justify-center p-6 text-center">
          <CreditCard className="h-10 w-10 text-muted-foreground/50" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold">No hay créditos para analizar</h3>
          <p className="mt-1 max-w-md text-xs text-muted-foreground">
            Cuando registres ventas o reparaciones financiadas, el movimiento y la cartera aparecerán aquí.
          </p>
        </CardContent>
      </Card>
    )
  }

  const maxPayment = Math.max(...report.paymentTrend.map((entry) => entry.amount), 1)
  const totalStatuses = report.statusDistribution.reduce((sum, entry) => sum + entry.count, 0)

  return (
    <div className="space-y-5">
      {/* Cabecera de la sección de Créditos con botón de descarga */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200/80 bg-white/90 shadow-xs dark:border-slate-800/80 dark:bg-slate-950/70">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Análisis de Créditos, Cartera y Cobranzas
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Comportamiento de cobros, financiamiento activo y salud crediticia
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 hover:bg-rose-100"
          onClick={() => exportCreditsSectionPDF({
            title: `Reporte de Créditos y Cartera${brand ? ` - ${brand}` : ''}`,
            context,
            report
          })}
        >
          <FileText className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
          PDF de Créditos
        </Button>
      </div>

      {error ? (
        <div role="status" className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          Se conservan los últimos datos disponibles. {error}
        </div>
      ) : null}

      <section aria-labelledby="credit-period-title" className="space-y-3">
        <div>
          <h2 id="credit-period-title" className="text-base font-bold">Movimiento del período</h2>
          <p className="text-xs text-muted-foreground">
            Créditos otorgados y cobranzas registradas dentro del rango seleccionado.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Créditos otorgados" value={String(report.period.grantedCount)} description="Operaciones creadas durante el período." icon={CreditCard} />
          <MetricCard label="Capital otorgado" value={formatGs(report.period.principalGranted)} description="Importe original financiado, sin intereses." icon={Landmark} />
          <MetricCard label="Total financiado" value={formatGs(report.period.financedTotal)} description={`Incluye ${formatGs(report.period.scheduledInterest)} de interés programado.`} icon={ReceiptText} />
          <MetricCard label="Cobrado en el período" value={formatGs(report.period.paymentsReceived)} description={`Tasa media de los créditos nuevos: ${report.period.averageInterestRate.toFixed(1)}%.`} icon={HandCoins} tone="text-emerald-700 dark:text-emerald-400" />
        </div>
      </section>

      <section aria-labelledby="credit-portfolio-title" className="space-y-3">
        <div>
          <h2 id="credit-portfolio-title" className="text-base font-bold">Cartera actual</h2>
          <p className="text-xs text-muted-foreground">
            Fotografía del saldo pendiente a hoy; no está limitada a créditos creados en el período.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Créditos activos" value={String(report.portfolio.activeCredits)} description="Créditos que todavía tienen saldo pendiente." icon={CircleDollarSign} />
          <MetricCard label="Saldo pendiente" value={formatGs(report.portfolio.outstandingAmount)} description={`Cobranza acumulada del plan: ${report.portfolio.collectionRate.toFixed(1)}%.`} icon={TrendingUp} />
          <MetricCard label="Monto vencido" value={formatGs(report.portfolio.overdueAmount)} description={`${report.portfolio.overdueInstallments} ${report.portfolio.overdueInstallments === 1 ? 'cuota vencida' : 'cuotas vencidas'} · ${report.portfolio.overdueCustomers} ${report.portfolio.overdueCustomers === 1 ? 'cliente' : 'clientes'}`} icon={TriangleAlert} tone="text-rose-700 dark:text-rose-400" />
          <MetricCard label="Próximos 30 días" value={formatGs(report.portfolio.dueSoonAmount)} description="Saldo de cuotas con vencimiento cercano." icon={CalendarClock} tone="text-amber-700 dark:text-amber-400" />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="rounded-xl border-slate-200/80 shadow-xs dark:border-white/10 dark:bg-[#0d1117]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Cobranzas por día</CardTitle>
          </CardHeader>
          <CardContent>
            {report.paymentTrend.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No hubo cobranzas en el período.</p>
            ) : (
              <div className="space-y-3">
                {report.paymentTrend.map((entry) => (
                  <div key={entry.date} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{entry.date.split('-').reverse().join('/')}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(4, (entry.amount / maxPayment) * 100)}%` }} />
                    </div>
                    <span className="font-mono font-semibold">{formatGs(entry.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-slate-200/80 shadow-xs dark:border-white/10 dark:bg-[#0d1117]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Estado de la cartera</CardTitle>
          </CardHeader>
          <CardContent>
            {totalStatuses === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No hay créditos registrados.</p>
            ) : (
              <div className="space-y-4">
                {report.statusDistribution.map((entry) => {
                  const percentage = (entry.count / totalStatuses) * 100
                  return (
                    <div key={entry.status}>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 font-medium">
                          <span className={`h-2.5 w-2.5 rounded-full ${statusColors[entry.status]}`} aria-hidden="true" />
                          {statusLabels[entry.status]}
                        </span>
                        <span className="font-mono font-semibold">{entry.count} · {percentage.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className={`h-full rounded-full ${statusColors[entry.status]}`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Users className="h-3.5 w-3.5" aria-hidden="true" />
        Los saldos se calculan con las cuotas y pagos registrados; los importes nunca se reconstruyen desde el navegador.
      </p>
    </div>
  )
}
