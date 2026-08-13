"use client"

import { useMemo, useRef, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { endOfDay, startOfDay, subDays } from 'date-fns'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  Building2,
  CalendarRange,
  Gauge,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Wallet,
  Wrench,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { formatCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import {
  type AdminAnalyticsFilters,
  type AnalyticsMetricCard,
  type AnalyticsPreset,
  type AnalyticsTableRow,
  useAdminAnalytics,
} from '@/hooks/use-admin-analytics'
import {
  AnalyticsLoadingState,
  EmptyState,
  InsightItem,
  MetricCard,
  MiniStat,
  SectionFrame,
} from './analytics-widgets'
import { ChartExporter } from '@/components/reports/ChartExporter'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'

const PRESET_OPTIONS: Array<{ value: AnalyticsPreset; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
]

const KPI_ICONS: Record<string, typeof Wallet> = {
  gross: Wallet,
  sales: ShoppingBag,
  ticket: Gauge,
  margin: TrendingUp,
  repairs: Wrench,
  alerts: ShieldAlert,
}

const PIE_COLORS = ['#2563eb', '#0f766e', '#d97706', '#7c3aed', '#dc2626', '#4f46e5']

function buildPresetRange(preset: AnalyticsPreset): DateRange {
  const now = new Date()

  if (preset === 'today') {
    return { from: startOfDay(now), to: endOfDay(now) }
  }

  if (preset === '7d') {
    return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) }
  }

  if (preset === '90d') {
    return { from: startOfDay(subDays(now, 89)), to: endOfDay(now) }
  }

  return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) }
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '--'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat('es-PY', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}


function HeroQuickStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 px-4 py-3 dark:border-slate-800">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-50">{value}</p>
    </div>
  )
}

function SectionBadge({
  children,
}: {
  children: string
}) {
  return (
    <Badge
      variant="outline"
      className="border-blue-200 text-blue-600 dark:border-blue-900 dark:text-blue-400"
    >
      {children}
    </Badge>
  )
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-md dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div className="mt-3 space-y-2">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-5 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color || '#2563eb' }} />
              {item.name}
            </div>
            <span className="font-medium text-foreground">{formatCurrency(item.value || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function NumberTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-md dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-semibold text-foreground">{label}</p>
      <div className="mt-3 space-y-2">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color || '#2563eb' }} />
              {item.name}
            </div>
            <span className="font-medium text-foreground">{formatCompact(item.value || 0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RankingTable({
  rows,
  emptyTitle,
  emptyDescription,
}: {
  rows: AnalyticsTableRow[]
  emptyTitle: string
  emptyDescription: string
}) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  return (
    <ScrollArea className="h-[320px] pr-3">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Metrica</TableHead>
            <TableHead>Secundario</TableHead>
            <TableHead>Detalle</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-foreground">{row.label}</TableCell>
              <TableCell>{row.metric}</TableCell>
              <TableCell>{row.secondary}</TableCell>
              <TableCell className="text-muted-foreground">{row.detail || '--'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ScrollArea>
  )
}

function MetricGrid({
  cards,
}: {
  cards: AnalyticsMetricCard[]
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = KPI_ICONS[card.id] || Activity
        return (
          <MetricCard
            key={card.id}
            title={card.label}
            value={card.value}
            helper={card.helper}
            delta={card.delta}
            tone={card.tone}
            icon={Icon}
          />
        )
      })}
    </div>
  )
}

export default function AnalyticsDashboard() {
  const [preset, setPreset] = useState<AnalyticsPreset>('30d')
  const [branch, setBranch] = useState('all')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(buildPresetRange('30d'))

  const normalizedRange = useMemo(() => {
    const fallback = buildPresetRange(preset)
    const from = dateRange?.from ? startOfDay(dateRange.from) : fallback.from!
    const to = dateRange?.to ? endOfDay(dateRange.to) : endOfDay(dateRange?.from || fallback.to || new Date())
    return { from, to }
  }, [dateRange, preset])

  const filters = useMemo<AdminAnalyticsFilters>(() => ({
    from: normalizedRange.from,
    to: normalizedRange.to,
    preset,
    branch,
  }), [branch, normalizedRange.from, normalizedRange.to, preset])

  const {
    snapshot,
    branchOptions,
    error,
    loading,
    forceRefresh,
    refreshing,
  } = useAdminAnalytics(filters)
  const { organizationName } = useSubscriptionStatus()

  const handlePresetChange = (nextPreset: AnalyticsPreset) => {
    setPreset(nextPreset)
    setDateRange(buildPresetRange(nextPreset))
  }

  const handleDateChange = (nextRange: DateRange | undefined) => {
    setDateRange(nextRange)
    if (nextRange?.from && nextRange?.to) {
      setPreset('custom')
    }
  }

  // Refs a cada gráfico para capturarlos como imagen en las descargas (PDF/Excel con gráficos).
  const salesTrendRef = useRef<HTMLDivElement>(null)
  const hourlyRef = useRef<HTMLDivElement>(null)
  const branchRef = useRef<HTMLDivElement>(null)
  const categoriesRef = useRef<HTMLDivElement>(null)
  const repairsRef = useRef<HTMLDivElement>(null)
  const financeRef = useRef<HTMLDivElement>(null)

  const exportChartRefs = [salesTrendRef, hourlyRef, branchRef, categoriesRef, repairsRef, financeRef]
  const exportChartTitles = [
    'Ventas del período',
    'Ventas por hora',
    'Movimiento por sucursal',
    'Categorías top',
    'Estados de reparación',
    'Ingresos vs egresos',
  ]
  const exportChartData = [
    snapshot.salesTrend,
    snapshot.hourlySales,
    snapshot.salesByBranch,
    snapshot.topCategories,
    snapshot.repairStatus,
    snapshot.financeComparison,
  ]
  const exportMetrics = Object.fromEntries(snapshot.headlineCards.map((c) => [c.label, c.value]))

  const lastUpdatedLabel = snapshot.generatedAt
    ? new Date(snapshot.generatedAt).toLocaleTimeString('es-PY', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--'

  if (loading) {
    return <AnalyticsLoadingState />
  }

  if (error && snapshot.headlineCards.length === 0) {
    return (
      <EmptyState
        title="No pudimos construir el dashboard analytics"
        description={`${error} Revisa la conexion con Supabase y vuelve a intentar.`}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">¿Cómo va el negocio?</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Ventas, inventario, cajas, reparaciones y clientes. Se compara automáticamente con el periodo anterior.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
          {snapshot.quickStats.map((stat) => (
            <HeroQuickStat key={stat.id} label={stat.label} value={stat.formattedValue} />
          ))}
        </div>
      </div>

      {/* Filtros y acciones */}
      <Card className="border border-gray-200 dark:border-slate-800 shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={preset === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handlePresetChange(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <DatePickerWithRange
                date={dateRange}
                onDateChange={handleDateChange}
                className="w-full"
              />

              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger className="w-full min-w-[180px] md:w-[220px]">
                  <Building2 className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <SelectValue placeholder="Sucursal operativa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las sucursales</SelectItem>
                  {branchOptions.map((option) => {
                    // Subtítulo para distinguir sucursales con nombre igual o parecido.
                    const subtitle = [option.city, option.code].filter(Boolean).join(' · ')
                    return (
                      <SelectItem key={option.id} value={option.id}>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate">{option.name}</span>
                          {subtitle ? (
                            <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
                          ) : null}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={forceRefresh}>
                <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                Actualizar
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-200 pt-3 text-sm text-gray-500 dark:border-slate-800 dark:text-gray-400 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2">
                <CalendarRange className="h-4 w-4" />
                {snapshot.periodLabel}
              </span>
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Se compara con el periodo anterior
              </span>
            </div>
            <span className="inline-flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Ultima actualizacion {lastUpdatedLabel}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Descargas con gráficos y detalle */}
      <div className="flex flex-wrap justify-end gap-2">
        <ChartExporter
          title={`Analytics — ${organizationName || 'Mi Negocio'}`}
          data={snapshot.salesTrend}
          metrics={exportMetrics}
          chartRefs={exportChartRefs}
          chartTitles={exportChartTitles}
          chartData={exportChartData}
        />
      </div>

      <MetricGrid cards={snapshot.headlineCards} />

      <div className="grid gap-6 xl:grid-cols-12">
        <SectionFrame
          title="Ventas del periodo"
          description="Cuánto vendiste por día, de dónde viene el ingreso (POS y reparaciones), y en qué horarios se vende más."
          badge={<SectionBadge>Ventas</SectionBadge>}
          className="xl:col-span-8"
        >
          {snapshot.salesTrend.length ? (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_280px]">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <MiniStat label="Total vendido" value={formatCurrency(snapshot.finance.operationalRevenue)} tone="info" />
                  <MiniStat label="Ganancia neta devengada" value={snapshot.finance.netProfit === null ? 'Pendiente' : formatCurrency(snapshot.finance.netProfit)} tone={snapshot.finance.netProfit === null ? 'warning' : snapshot.finance.netProfit >= 0 ? 'success' : 'danger'} />
                  <MiniStat label="vs. periodo anterior" value={formatPercent(snapshot.finance.growth)} tone={snapshot.finance.growth !== null && snapshot.finance.growth >= 0 ? 'success' : 'warning'} />
                </div>

                <div ref={salesTrendRef} className="h-[320px]" role="img" aria-label="Gráfico de tendencia de ventas POS y reparaciones">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={snapshot.salesTrend}>
                      <defs>
                        <linearGradient id="analytics-pos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="analytics-repairs" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f766e" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
                      <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} tickMargin={10} />
                      <YAxis tickFormatter={(value) => formatCompact(value)} tickLine={false} axisLine={false} width={80} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="posRevenue" stroke="#2563eb" fill="url(#analytics-pos)" name="POS" strokeWidth={2.5} />
                      <Area type="monotone" dataKey="repairRevenue" stroke="#0f766e" fill="url(#analytics-repairs)" name="Reparaciones" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 dark:border-slate-800 p-4">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-foreground">¿A qué hora se vende más?</p>
                  <p className="text-sm text-muted-foreground">Útil para planificar turnos y horarios de caja.</p>
                </div>
                <div ref={hourlyRef} className="h-[320px]" role="img" aria-label="Gráfico de ventas por hora del día">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={snapshot.hourlySales}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} interval={3} tickMargin={8} />
                      <YAxis tickFormatter={(value) => formatCompact(value)} tickLine={false} axisLine={false} width={70} />
                      <Tooltip content={<NumberTooltip />} />
                      <Bar dataKey="value" fill="#0f172a" radius={[10, 10, 0, 0]} name="Ingreso por hora" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No hay ventas en el rango actual"
              description="Ajusta la fecha o revisa si el periodo seleccionado todavia no tiene transacciones completadas."
            />
          )}
        </SectionFrame>

        <SectionFrame
          title="Dinero: ingresos vs gastos"
          description="Cuánto entró, cuánto salió y cuánto quedó de ganancia. Se compara con el periodo anterior."
          badge={<SectionBadge>Finanzas</SectionBadge>}
          className="xl:col-span-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniStat label="Entró" value={formatCurrency(snapshot.finance.grossRevenue)} tone="info" />
            <MiniStat label="Salió" value={formatCurrency(snapshot.finance.visibleExpenses)} tone="warning" />
            <MiniStat label="Quedó" value={formatCurrency(snapshot.finance.estimatedProfit)} tone={snapshot.finance.estimatedProfit >= 0 ? 'success' : 'danger'} />
            <MiniStat label="Margen" value={`${snapshot.finance.margin.toFixed(1)}%`} tone={snapshot.finance.margin >= 20 ? 'success' : snapshot.finance.margin >= 10 ? 'warning' : 'danger'} />
          </div>

          {!snapshot.finance.complete ? (
            <div role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <p className="font-semibold">Resultado financiero incompleto</p>
              <p className="mt-1">{snapshot.finance.coverageWarnings[0]?.message || 'Faltan costos o cobros fechados para completar el resultado.'}</p>
            </div>
          ) : null}

          <div ref={financeRef} className="mt-6 h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={snapshot.financeComparison}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickFormatter={(value) => formatCompact(value)} tickLine={false} axisLine={false} width={70} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="ingresos" fill="#2563eb" radius={[10, 10, 0, 0]} name="Ingresos" />
                <Bar dataKey="egresos" fill="#d97706" radius={[10, 10, 0, 0]} name="Egresos" />
                <Bar dataKey="ganancia" fill="#0f766e" radius={[10, 10, 0, 0]} name="Ganancia" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionFrame>

        <SectionFrame
          title="Lo que deberías saber"
          description="Alertas y observaciones importantes del periodo: qué mejoró, qué necesita atención y dónde hay riesgo."
          badge={<SectionBadge>Alertas</SectionBadge>}
          className="xl:col-span-4"
        >
          <div className="space-y-3">
            {snapshot.insights.map((insight) => (
              <InsightItem
                key={insight.id}
                title={insight.title}
                description={insight.description}
                context={insight.context}
                tone={insight.tone}
              />
            ))}
          </div>

          {/* "Clientes que vuelven" es el único dato que no tiene sección
              propia en otro lado, así que se queda acá. Margen, cajas abiertas
              y poco stock se quitaron: ya se muestran en Dinero, Estado de
              cajas e Inventario respectivamente — repetirlos era ruido. */}
          <Separator className="my-6" />

          <MiniStat
            label="Clientes que vuelven"
            value={`${snapshot.customers.recurrenceRate.toFixed(1)}%`}
            tone={snapshot.customers.recurrenceRate >= 35 ? 'success' : 'info'}
          />
        </SectionFrame>

        <SectionFrame
          title="Estado de cajas"
          description="Cuántas cajas están abiertas, si hay diferencias de dinero, y cuánto se retiró en el periodo."
          badge={<SectionBadge>Cajas</SectionBadge>}
          className="xl:col-span-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniStat label="Cajas abiertas" value={String(snapshot.operations.openRegisters)} tone="info" />
            <MiniStat label="Alertas graves" value={String(snapshot.operations.criticalAlerts)} tone={snapshot.operations.criticalAlerts > 0 ? 'danger' : 'success'} />
            <MiniStat label="Diferencias de dinero" value={formatCurrency(snapshot.operations.discrepancies)} tone={snapshot.operations.discrepancies > 0 ? 'warning' : 'success'} />
            <MiniStat label="Dinero retirado" value={formatCurrency(snapshot.operations.withdrawals)} tone="warning" />
          </div>

          <div ref={branchRef} className="mt-6 h-[220px]">
            {snapshot.salesByBranch.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={snapshot.salesByBranch}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickFormatter={(value) => formatCompact(value)} tickLine={false} axisLine={false} width={70} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="value" fill="#2563eb" radius={[10, 10, 0, 0]} name="Movimiento POS" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState
                title="Sin movimiento por sucursal"
                description="No hay sesiones o movimientos POS suficientes para dibujar el reparto operativo."
              />
            )}
          </div>
        </SectionFrame>

        <SectionFrame
          title="Inventario"
          description="Qué categorías se venden más, qué productos están por agotarse y cuáles no se mueven."
          badge={<SectionBadge>Inventario</SectionBadge>}
          className="xl:col-span-4"
        >
          {snapshot.topCategories.length ? (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <MiniStat label="Poco stock" value={String(snapshot.inventory.lowStockCount)} tone={snapshot.inventory.lowStockCount > 0 ? 'warning' : 'success'} />
                <MiniStat label="Sin ventas" value={String(snapshot.inventory.idleProductsCount)} tone="info" />
                <MiniStat label="Rotación" value={`${snapshot.inventory.turnover.toFixed(1)}%`} tone="neutral" />
              </div>

              <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div ref={categoriesRef} className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={snapshot.topCategories}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={52}
                        outerRadius={84}
                        paddingAngle={3}
                      >
                        {snapshot.topCategories.map((entry, index) => (
                          <Cell key={entry.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {snapshot.lowStockProducts.slice(0, 4).map((row) => (
                    <div key={row.id} className="rounded-lg border border-gray-200 dark:border-slate-800 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{row.label}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{row.detail}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        >
                          {row.metric}
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">{row.secondary}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Sin suficiente detalle de inventario"
              description="Todavia no hay ventas o movimientos que permitan componer una lectura de rotacion util."
            />
          )}
        </SectionFrame>

        <SectionFrame
          title="Clientes"
          description="Cuántos clientes nuevos entraron, cuántos vuelven a comprar y quiénes son los mejores compradores."
          badge={<SectionBadge>Clientes</SectionBadge>}
          className="xl:col-span-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniStat
              label="Clientes nuevos"
              value={String(snapshot.customers.newCount)}
              tone="info"
              hint={branch !== 'all' ? 'Todo el negocio (los clientes no son por sucursal)' : undefined}
            />
            <MiniStat label="Volvieron a comprar" value={String(snapshot.customers.recurrentCount)} tone="success" />
            <MiniStat label="% que vuelven" value={`${snapshot.customers.recurrenceRate.toFixed(1)}%`} tone={snapshot.customers.recurrenceRate >= 35 ? 'success' : 'neutral'} />
            <MiniStat label="Crecimiento" value={formatPercent(snapshot.customers.growth)} tone={snapshot.customers.growth !== null && snapshot.customers.growth >= 0 ? 'success' : 'warning'} />
          </div>

          <div className="mt-5 space-y-3">
            {snapshot.customerLeaders.slice(0, 4).length ? (
              snapshot.customerLeaders.slice(0, 4).map((row) => (
                <div key={row.id} className="rounded-lg border border-gray-200 dark:border-slate-800 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{row.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{row.secondary}</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{row.metric}</p>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{row.detail}</p>
                </div>
              ))
            ) : (
              <EmptyState
                title="Sin compradores destacados"
                description="Todavia no hay suficientes clientes identificados en el rango para construir un ranking confiable."
              />
            )}
          </div>
        </SectionFrame>

        <SectionFrame
          title="Taller de reparaciones"
          description="Cuántas reparaciones hay en curso, cuántas se entregaron, cuánto tardan en promedio y cuánto facturó el taller."
          badge={<SectionBadge>Taller</SectionBadge>}
          className="xl:col-span-8"
        >
          <div className="grid gap-3 md:grid-cols-4">
            <MiniStat label="En curso" value={String(snapshot.repairs.activeCount)} tone="info" />
            <MiniStat label="Entregadas" value={String(snapshot.repairs.completedCount)} tone="success" />
            <MiniStat label="Demora promedio" value={`${snapshot.repairs.avgCycleDays.toFixed(1)} días`} tone="neutral" />
            <MiniStat label="Facturado" value={formatCurrency(snapshot.repairs.revenue)} tone="success" />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div ref={repairsRef} className="h-[260px]">
              {snapshot.repairStatus.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={snapshot.repairStatus} layout="vertical">
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                    <XAxis type="number" tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={100} />
                    <Tooltip content={<NumberTooltip />} />
                    <Bar dataKey="value" fill="#0f766e" radius={[0, 10, 10, 0]} name="Reparaciones" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  title="Sin reparaciones en el periodo"
                  description="Cuando existan ingresos de taller, aqui veras el reparto de estados y cuello de botella."
                />
              )}
            </div>

            <div className="space-y-3">
              {snapshot.technicians.slice(0, 4).map((row) => (
                <div key={row.id} className="rounded-lg border border-gray-200 dark:border-slate-800 p-4">
                  <p className="font-medium text-foreground">{row.label}</p>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">{row.metric}</span>
                    <span className="text-sm font-semibold text-foreground">{row.secondary}</span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{row.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </SectionFrame>

        <SectionFrame
          title="Los mejores del periodo"
          description="Qué productos se vendieron más, qué cajeros facturaron más, quiénes son los mejores clientes y técnicos."
          badge={<SectionBadge>Rankings</SectionBadge>}
          className="xl:col-span-12"
          contentClassName="pt-0"
        >
          <Tabs defaultValue="productos" className="mt-6">
            <TabsList variant="line" className="w-full justify-start gap-2 overflow-x-auto rounded-none px-0">
              <TabsTrigger value="productos">Productos</TabsTrigger>
              <TabsTrigger value="cajeros">Cajeros</TabsTrigger>
              <TabsTrigger value="clientes">Clientes</TabsTrigger>
              <TabsTrigger value="tecnicos">Tecnicos</TabsTrigger>
            </TabsList>

            <TabsContent value="productos" className="pt-6">
              <RankingTable
                rows={snapshot.topProducts}
                emptyTitle="Todavia no hay ranking de productos"
                emptyDescription="Se necesita al menos una venta con items para construir la tabla de productos top."
              />
            </TabsContent>

            <TabsContent value="cajeros" className="pt-6">
              <RankingTable
                rows={snapshot.salesByCashier}
                emptyTitle="Sin desempeño por cajero"
                emptyDescription="Cuando el sistema registre ventas con usuario o cajero asociado, el ranking aparecera aqui."
              />
            </TabsContent>

            <TabsContent value="clientes" className="pt-6">
              <RankingTable
                rows={snapshot.customerLeaders}
                emptyTitle="Sin cartera destacada"
                emptyDescription="Todavia no hay suficiente actividad de clientes identificados para construir el ranking."
              />
            </TabsContent>

            <TabsContent value="tecnicos" className="pt-6">
              <RankingTable
                rows={snapshot.technicians}
                emptyTitle="Sin tecnicos evaluables"
                emptyDescription="Se necesitan reparaciones con tecnico asignado para armar una comparativa util."
              />
            </TabsContent>
          </Tabs>
        </SectionFrame>
      </div>
    </div>
  )
}
