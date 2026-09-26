'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns'
import { es } from 'date-fns/locale'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  Landmark,
  TrendingUp,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminFinances } from '@/hooks/use-admin-finances'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

type PeriodKey = 'day' | 'week' | 'month' | 'year'

const PERIODS: { key: PeriodKey; label: string; build: (now: Date) => { from: Date; to: Date } }[] = [
  { key: 'day', label: 'Hoy', build: (now) => ({ from: startOfDay(now), to: endOfDay(now) }) },
  // La semana arranca el lunes, igual que en los filtros de Finanzas.
  { key: 'week', label: 'Semana', build: (now) => ({ from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) }) },
  { key: 'month', label: 'Mes', build: (now) => ({ from: startOfMonth(now), to: endOfMonth(now) }) },
  { key: 'year', label: 'Año', build: (now) => ({ from: startOfYear(now), to: endOfYear(now) }) },
]

const DEFAULT_PERIOD: PeriodKey = 'month'

type Tone = 'revenue' | 'result' | 'cash' | 'flow'

const TONE: Record<Tone, { border: string; icon: string }> = {
  revenue: { border: 'border-l-emerald-500', icon: 'text-emerald-600 dark:text-emerald-400' },
  result: { border: 'border-l-primary', icon: 'text-primary' },
  cash: { border: 'border-l-blue-500', icon: 'text-blue-500' },
  flow: { border: 'border-l-violet-500', icon: 'text-violet-500' },
}

// El porcentaje solo tiene sentido si hay una base contra la cual comparar: con
// período anterior en cero, un "+100%" sería inventado.
function deltaPercent(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

function DeltaBadge({ current, previous }: { current: number | null; previous: number | null }) {
  const delta = deltaPercent(current, previous)
  if (delta === null) {
    return <span className="text-[11px] text-muted-foreground">Sin base de comparación</span>
  }

  const isUp = delta >= 0
  const Icon = isUp ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums',
        isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {Math.abs(delta).toFixed(1)}%
      <span className="font-normal text-muted-foreground"> vs período anterior</span>
    </span>
  )
}

function SnapshotMetric({
  label,
  value,
  previous,
  icon: Icon,
  tone,
  hint,
}: {
  label: string
  value: number | null
  previous: number | null
  icon: LucideIcon
  tone: Tone
  hint: string
}) {
  const toneStyle = TONE[tone]
  return (
    <Card className={cn('border-l-4 shadow-sm', toneStyle.border)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p
              className={cn(
                'mt-1 text-xl font-bold tabular-nums',
                value !== null && value < 0 ? 'text-destructive' : 'text-foreground',
              )}
            >
              {value === null ? 'Sin cobertura' : formatCurrency(value)}
            </p>
          </div>
          <Icon className={cn('h-5 w-5 shrink-0', toneStyle.icon)} aria-hidden="true" />
        </div>
        <div className="mt-2">
          <DeltaBadge current={value} previous={previous} />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

export function FinanceSnapshot() {
  const { summary, filters, setDateRange, isLoading, isRefreshing, error, refresh } = useAdminFinances()
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD)
  const appliedDefault = useRef(false)

  // El hook arranca con los últimos 30 días; el panel muestra el mes en curso,
  // así que se aplica el período por defecto una sola vez al montar.
  useEffect(() => {
    if (appliedDefault.current) return
    appliedDefault.current = true
    const preset = PERIODS.find((item) => item.key === DEFAULT_PERIOD)
    if (preset) setDateRange(preset.build(new Date()))
  }, [setDateRange])

  function applyPeriod(key: PeriodKey) {
    const preset = PERIODS.find((item) => item.key === key)
    if (!preset) return
    setPeriod(key)
    setDateRange(preset.build(new Date()))
  }

  const rangeLabel = useMemo(() => {
    const from = new Date(`${filters.startDate}T00:00:00`)
    const to = new Date(`${filters.endDate}T00:00:00`)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null
    if (filters.startDate === filters.endDate) {
      return format(from, "d 'de' MMMM yyyy", { locale: es })
    }
    return `${format(from, 'd MMM', { locale: es })} – ${format(to, 'd MMM yyyy', { locale: es })}`
  }, [filters.endDate, filters.startDate])

  const showSkeleton = isLoading && !summary && !error
  const overdueCount = summary?.overdue.length ?? 0

  return (
    <section className="space-y-3" aria-labelledby="admin-finance-snapshot">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="admin-finance-snapshot" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Finanzas de la organización
          </h2>
          {rangeLabel ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {rangeLabel}
              {isRefreshing ? ' · actualizando…' : ''}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Período">
            {PERIODS.map((item) => (
              <Button
                key={item.key}
                type="button"
                size="sm"
                variant={period === item.key ? 'default' : 'outline'}
                aria-pressed={period === item.key}
                onClick={() => applyPeriod(item.key)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link href="/admin/finances">
              Ver detalle
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <Card role="alert" className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                No pudimos cargar el resumen financiero. {error.message}
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {showSkeleton ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true" aria-label="Cargando finanzas">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-[124px] w-full rounded-xl" />
          ))}
        </div>
      ) : summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SnapshotMetric
              label="Ingresos"
              value={summary.accrued.revenue}
              previous={summary.comparison.accrued.revenue}
              icon={TrendingUp}
              tone="revenue"
              hint="Ventas y reparaciones del período"
            />
            <SnapshotMetric
              label="Ganancia neta"
              value={summary.accrued.netProfit}
              previous={summary.comparison.accrued.netProfit}
              icon={Landmark}
              tone="result"
              hint="Después de costos, gastos y nómina"
            />
            <SnapshotMetric
              label="Cobrado"
              value={summary.cash.collected}
              previous={summary.comparison.cash.collected}
              icon={Banknote}
              tone="cash"
              hint="Dinero efectivamente ingresado"
            />
            <SnapshotMetric
              label="Flujo de caja neto"
              value={summary.cash.netCashFlow}
              previous={summary.comparison.cash.netCashFlow}
              icon={WalletCards}
              tone="flow"
              hint="Cobrado menos pagado"
            />
          </div>

          {(!summary.complete || overdueCount > 0) ? (
            <div className="flex flex-wrap items-center gap-2">
              {!summary.complete ? (
                <Badge variant="outline" className="gap-1 border-amber-300/70 bg-amber-50 font-normal text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  Faltan costos: la ganancia es provisoria
                </Badge>
              ) : null}
              {overdueCount > 0 ? (
                <Badge variant="outline" className="gap-1 border-destructive/40 bg-destructive/10 font-normal text-destructive">
                  {overdueCount} {overdueCount === 1 ? 'obligación vencida' : 'obligaciones vencidas'}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  )
}
