"use client"

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { AnalyticsGuideDialog } from '@/app/admin/analytics/components/AnalyticsGuideDialog'
import type { DateRange } from 'react-day-picker'
import { endOfDay, startOfDay, subDays } from 'date-fns'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Activity,
  Boxes,
  Building2,
  CalendarRange,
  Gauge,
  HelpCircle,
  LayoutDashboard,
  RefreshCw,
  ShieldAlert,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
} from './analytics-widgets'
import { WebsiteSnapshotCard } from './website-snapshot-card'
import { ChartExporter, type ChartSection } from '@/components/reports/ChartExporter'
import { useSubscriptionStatus } from '@/contexts/SubscriptionStatusContext'
import type { SiteAnalyticsRangeDays } from '@/lib/site-analytics/shared'
import {
  type AnalyticsModuleFlags,
  type AnalyticsModuleKey,
  describeAnalyticsSections,
  filterInsightsByModules,
  isHeadlineCardVisible,
  resolveAnalyticsModules,
  revenueCardId,
} from './analytics-modules'

const PRESET_OPTIONS: Array<{ value: AnalyticsPreset; label: string }> = [
  { value: 'today', label: 'Hoy' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
  { value: '90d', label: '90 días' },
]

const PRESET_DAYS: Record<Exclude<AnalyticsPreset, 'custom'>, SiteAnalyticsRangeDays> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

const KPI_ICONS: Record<string, typeof Wallet> = {
  gross: Wallet,
  'pos-revenue': Wallet,
  sales: ShoppingBag,
  ticket: Gauge,
  margin: TrendingUp,
  repairs: Wrench,
  alerts: ShieldAlert,
}

const PIE_COLORS = ['#2563eb', '#0f766e', '#d97706', '#7c3aed', '#dc2626', '#4f46e5']

type TabId = 'resumen' | 'ventas' | 'dinero' | 'inventario' | 'clientes' | 'taller'

/** Las pestañas con `module` solo aparecen si la empresa tiene ese módulo activo. */
const TABS: Array<{ id: TabId; label: string; icon: LucideIcon; module?: AnalyticsModuleKey }> = [
  { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { id: 'ventas', label: 'Ventas', icon: ShoppingBag },
  { id: 'dinero', label: 'Dinero y cajas', icon: Wallet },
  { id: 'inventario', label: 'Inventario', icon: Boxes, module: 'inventory' },
  { id: 'clientes', label: 'Clientes', icon: Users, module: 'crm' },
  { id: 'taller', label: 'Taller', icon: Wrench, module: 'repairs' },
]

function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value)
}

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

/** Tarjeta de sección: título corto, una línea que explica para qué sirve, y el contenido. */
function Panel({
  title,
  description,
  action,
  className,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Card className={cn('min-w-0 gap-0 border border-gray-200 py-0 shadow-sm dark:border-slate-800', className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 px-5 pt-5 pb-3">
        <div className="min-w-0">
          <CardTitle className="text-base">{title}</CardTitle>
          {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </CardHeader>
      <CardContent className="px-5 pb-5">{children}</CardContent>
    </Card>
  )
}

function RankingTable({
  rows,
  columns,
  emptyTitle,
  emptyDescription,
}: {
  rows: AnalyticsTableRow[]
  /** Encabezados de nombre, métrica, dato secundario y detalle. */
  columns: [string, string, string, string?]
  emptyTitle: string
  emptyDescription: string
}) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }

  const [nameLabel, metricLabel, secondaryLabel, detailLabel] = columns

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead>{nameLabel}</TableHead>
            <TableHead className="text-right">{metricLabel}</TableHead>
            <TableHead className="text-right">{secondaryLabel}</TableHead>
            {detailLabel ? <TableHead className="hidden md:table-cell">{detailLabel}</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={row.id}>
              <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
              <TableCell className="max-w-[260px] truncate font-medium text-foreground">{row.label}</TableCell>
              <TableCell className="text-right font-semibold tabular-nums">{row.metric}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{row.secondary}</TableCell>
              {detailLabel ? (
                <TableCell className="hidden text-muted-foreground md:table-cell">{row.detail || '--'}</TableCell>
              ) : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function MetricGrid({
  cards,
  className,
}: {
  cards: AnalyticsMetricCard[]
  className?: string
}) {
  if (!cards.length) return null
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4', className)}>
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

function SalesTrendChart({
  data,
  height = 300,
  chartRef,
  showRepairs = true,
}: {
  data: Array<{ shortLabel: string; posRevenue: number; repairRevenue: number }>
  height?: number
  chartRef?: React.RefObject<HTMLDivElement | null>
  /** Sin taller, la serie de reparaciones sería una línea plana en cero. */
  showRepairs?: boolean
}) {
  return (
    <div
      ref={chartRef}
      style={{ height }}
      role="img"
      aria-label={showRepairs ? 'Gráfico de ventas POS y reparaciones por día' : 'Gráfico de ventas POS por día'}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="analytics-pos" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="analytics-repairs" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0f766e" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#0f766e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.25)" />
          <XAxis dataKey="shortLabel" tickLine={false} axisLine={false} tickMargin={10} minTickGap={16} />
          <YAxis tickFormatter={(value) => formatCompact(value)} tickLine={false} axisLine={false} width={64} />
          <Tooltip content={<ChartTooltip />} />
          {showRepairs ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
          <Area type="monotone" dataKey="posRevenue" stroke="#2563eb" fill="url(#analytics-pos)" name="POS" strokeWidth={2.5} />
          {showRepairs ? (
            <Area type="monotone" dataKey="repairRevenue" stroke="#0f766e" fill="url(#analytics-repairs)" name="Reparaciones" strokeWidth={2.5} />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default function AnalyticsDashboard() {
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('vista')
  const [tab, setTab] = useState<TabId>(isTabId(requestedTab) ? requestedTab : 'resumen')
  const { status: subscriptionStatus, effectiveModules } = useSubscriptionStatus()
  const modules: AnalyticsModuleFlags = useMemo(
    () => resolveAnalyticsModules(subscriptionStatus, effectiveModules),
    [subscriptionStatus, effectiveModules],
  )
  const visibleTabs = TABS.filter((item) => !item.module || modules[item.module])
  const activeTab = visibleTabs.some((item) => item.id === tab) ? tab : 'resumen'
  const handleTabChange = useCallback((value: string) => {
    if (!isTabId(value)) return
    setTab(value)
    const url = new URL(window.location.href)
    url.searchParams.set('vista', value)
    window.history.replaceState(null, '', url)
  }, [])

  const [preset, setPreset] = useState<AnalyticsPreset>('30d')
  const [branch, setBranch] = useState('all')
  const [dateRange, setDateRange] = useState<DateRange | undefined>(buildPresetRange('30d'))
  const [guideOpen, setGuideOpen] = useState(false)

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

  // Sin taller no se exporta su grafico. Las tres listas se arman con el
  // mismo criterio para que ref, titulo y datos sigan alineados.
  const exportChartRefs = [
    salesTrendRef,
    hourlyRef,
    branchRef,
    categoriesRef,
    ...(modules.repairs ? [repairsRef] : []),
    financeRef,
  ]
  const exportChartTitles = [
    'Ventas del período',
    'Ventas por hora',
    'Movimiento por sucursal',
    'Categorías top',
    ...(modules.repairs ? ['Estados de reparación'] : []),
    'Ingresos vs egresos',
  ]
  // Cada dataset dice que es: el exportador elegia el tipo de grafico y la
  // tabla por la POSICION en el arreglo, cableada al orden de la pagina de
  // reportes. Estos seis van en otro orden, asi que uno reventaba y los demas
  // se dibujaban en cero.
  const exportChartData: ChartSection[] = [
    { id: 'generic', kind: 'area', rows: snapshot.salesTrend, formatValue: formatCurrency },
    { id: 'generic', kind: 'bar', rows: snapshot.hourlySales, formatValue: formatCurrency },
    { id: 'generic', kind: 'bar', rows: snapshot.salesByBranch, formatValue: formatCurrency },
    { id: 'generic', kind: 'donut', rows: snapshot.topCategories, formatValue: formatCurrency },
    ...(modules.repairs
      ? [{ id: 'generic', kind: 'donut', rows: snapshot.repairStatus, formatValue: (v: number) => `${v} equipos` } satisfies ChartSection]
      : []),
    { id: 'generic', kind: 'bar', rows: snapshot.financeComparison, formatValue: formatCurrency },
  ]
  // Los KPI del PDF salen de las tarjetas de arriba, mas el detalle de taller.
  //
  // Las tarjetas resumen las reparaciones en una sola cifra —las que estan en
  // curso— y el informe se leia como si el taller no hubiera terminado nada.
  // Estas cuatro dicen exactamente que mide cada una, porque «reparaciones» a
  // secas puede significar cuatro cosas distintas y las cuatro dan numeros
  // distintos.
  const repairs = snapshot.repairs
  const headlineCards = snapshot.headlineCards.filter((card) => isHeadlineCardVisible(card.id, modules))
  const repairMetrics: Record<string, string> = {
    'Reparaciones ingresadas': String(repairs.receivedCount),
    'Reparaciones terminadas (listas + entregadas)': String(repairs.finishedCount),
    'Reparaciones entregadas (de las ingresadas)': String(repairs.completedCount),
    'Listas sin retirar': String(repairs.readyForPickupCount),
    // Solo si la instalacion tiene la fecha de entrega cargada: un cero aca se
    // leeria como «no entregamos nada» y seria mentira.
    ...(repairs.deliveredInPeriodCount !== null
      ? { 'Entregadas en el período': String(repairs.deliveredInPeriodCount) }
      : {}),
    ...(repairs.cancelledCount > 0 ? { 'Reparaciones canceladas': String(repairs.cancelledCount) } : {}),
    'Facturado en taller': formatCurrency(repairs.revenue),
  }
  const exportMetrics = {
    ...Object.fromEntries(headlineCards.map((c) => [c.label, c.value])),
    ...(modules.repairs ? repairMetrics : {}),
  }

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


  const cardsById = new Map(headlineCards.map((card) => [card.id, card]))
  const pickCards = (ids: string[]) =>
    ids.map((id) => cardsById.get(id)).filter((card): card is AnalyticsMetricCard => Boolean(card))

  const websiteDays: SiteAnalyticsRangeDays = preset === 'custom' ? 30 : PRESET_DAYS[preset]
  const websiteNote = preset === 'custom' ? 'Últimos 30 días: las visitas usan períodos fijos' : undefined

  const goToTab = (id: TabId) => (
    <Button variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => handleTabChange(id)}>
      Ver detalle
    </Button>
  )

  const financeStats = (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2">
        <MiniStat label="Entró" value={formatCurrency(snapshot.finance.grossRevenue)} tone="info" />
        <MiniStat label="Salió" value={formatCurrency(snapshot.finance.visibleExpenses)} tone="warning" />
        <MiniStat label="Quedó" value={snapshot.finance.estimatedProfit === null ? 'Pendiente' : formatCurrency(snapshot.finance.estimatedProfit)} tone={snapshot.finance.estimatedProfit === null ? 'warning' : snapshot.finance.estimatedProfit >= 0 ? 'success' : 'danger'} />
        <MiniStat label="Margen" value={snapshot.finance.margin === null ? 'Pendiente' : `${snapshot.finance.margin.toFixed(1)}%`} tone={snapshot.finance.margin === null ? 'warning' : snapshot.finance.margin >= 20 ? 'success' : snapshot.finance.margin >= 10 ? 'warning' : 'danger'} />
      </div>
      {!snapshot.finance.complete ? (
        <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">Resultado financiero incompleto</p>
          <p className="mt-1">{snapshot.finance.coverageWarnings[0]?.message || 'Faltan costos o cobros fechados para completar el resultado.'}</p>
        </div>
      ) : null}
    </div>
  )

  const categoryTotal = snapshot.topCategories.reduce((sum, item) => sum + (item.value || 0), 0)
  const insights = filterInsightsByModules(snapshot.insights, modules)
  const revenueCard = revenueCardId(modules)
  const salesSourcesLabel = modules.repairs ? 'POS y reparaciones' : 'POS'

  // «Para atender»: cajas siempre; el resto según lo que use la empresa, hasta completar cuatro.
  const attentionStats = [
    { key: 'registers', label: 'Cajas abiertas', value: String(snapshot.operations.openRegisters), tone: 'info' as const },
    { key: 'critical', label: 'Alertas graves', value: String(snapshot.operations.criticalAlerts), tone: snapshot.operations.criticalAlerts > 0 ? 'danger' as const : 'success' as const },
    ...(modules.inventory
      ? [{ key: 'stock', label: 'Poco stock', value: String(snapshot.inventory.lowStockCount), tone: snapshot.inventory.lowStockCount > 0 ? 'warning' as const : 'success' as const }]
      : []),
    ...(modules.repairs
      ? [{ key: 'workshop', label: 'En el taller', value: String(snapshot.repairs.activeCount), tone: 'info' as const }]
      : []),
    ...(modules.crm
      ? [{ key: 'customers', label: 'Clientes nuevos', value: String(snapshot.customers.newCount), tone: 'info' as const }]
      : []),
    { key: 'unresolved', label: 'Alertas sin resolver', value: String(snapshot.operations.unresolvedAlerts), tone: snapshot.operations.unresolvedAlerts > 0 ? 'warning' as const : 'success' as const },
  ].slice(0, 4)

  return (
    <div className="space-y-6">
      <AnalyticsGuideDialog open={guideOpen} onOpenChange={setGuideOpen} />

      {/* Encabezado */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">¿Cómo va el negocio?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {describeAnalyticsSections(modules)}, comparados automáticamente con el período anterior.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setGuideOpen(true)}>
            <HelpCircle className="h-4 w-4" />
            ¿Cómo funciona?
          </Button>
          <ChartExporter
            title={`Analytics — ${organizationName || 'Mi Negocio'}`}
            data={snapshot.salesTrend}
            metrics={exportMetrics}
            chartRefs={exportChartRefs}
            chartTitles={exportChartTitles}
            chartData={exportChartData}
          />
        </div>
      </div>

      {/* Filtros */}
      <div className="space-y-2">
        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-card p-3 shadow-sm dark:border-slate-800 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="inline-flex w-fit rounded-lg border bg-muted/40 p-0.5" role="group" aria-label="Período">
              {PRESET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handlePresetChange(option.value)}
                  aria-pressed={preset === option.value}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                    preset === option.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <DatePickerWithRange date={dateRange} onDateChange={handleDateChange} className="w-full sm:w-auto" />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Sucursal" />
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
                        {subtitle ? <span className="truncate text-xs text-muted-foreground">{subtitle}</span> : null}
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={forceRefresh} disabled={refreshing}>
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              Actualizar
            </Button>
          </div>
        </div>

        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarRange className="h-3.5 w-3.5" />
            {snapshot.periodLabel} · comparado con el período anterior
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Actualizado {lastUpdatedLabel}
          </span>
        </p>
      </div>

      {error ? (
        <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Algunos datos no se pudieron cargar: {error}
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="gap-0">
        <div className="overflow-x-auto border-b border-gray-200 dark:border-slate-800">
          <TabsList variant="line" className="h-auto w-max min-w-full justify-start gap-1 rounded-none bg-transparent p-0">
            {visibleTabs.map((item) => {
              const Icon = item.icon
              return (
                <TabsTrigger key={item.id} value={item.id} className="flex-none px-3 py-2.5">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        {/* ── Resumen ─────────────────────────────────────────────────────── */}
        <TabsContent value="resumen" className="mt-6 space-y-6">
          <MetricGrid cards={pickCards([revenueCard, 'sales', 'ticket', 'margin'])} />

          <div className="grid gap-6 xl:grid-cols-3">
            <Panel
              title="Ventas del período"
              description={modules.repairs ? 'Lo que entró por POS y por reparaciones, día por día.' : 'Lo que entró por POS, día por día.'}
              action={goToTab('ventas')}
              className="xl:col-span-2"
            >
              {snapshot.salesTrend.length ? (
                <SalesTrendChart data={snapshot.salesTrend} height={360} chartRef={salesTrendRef} showRepairs={modules.repairs} />
              ) : (
                <EmptyState
                  title="No hay ventas en el rango actual"
                  description="Ajustá la fecha o revisá si el período todavía no tiene transacciones completadas."
                />
              )}
            </Panel>

            <Panel title="Lo que tenés que mirar" description="El sistema compara el período y te avisa qué cambió.">
              {insights.length ? (
                <div className="space-y-3">
                  {insights.map((insight) => (
                    <InsightItem
                      key={insight.id}
                      title={insight.title}
                      description={insight.description}
                      context={insight.context}
                      tone={insight.tone}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState title="Todo en orden" description="No hay alertas para este período." />
              )}
            </Panel>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <Panel title="Dinero" description="Lo que entró, lo que salió y lo que quedó." action={goToTab('dinero')}>
              {financeStats}
            </Panel>

            <WebsiteSnapshotCard days={websiteDays} rangeNote={websiteNote} />

            <Panel title="Para atender" description="Señales de la operación que conviene revisar.">
              <div className="grid grid-cols-2 gap-3">
                {attentionStats.map((stat) => (
                  <MiniStat key={stat.key} label={stat.label} value={stat.value} tone={stat.tone} />
                ))}
              </div>
            </Panel>
          </div>
        </TabsContent>

        {/* ── Ventas ──────────────────────────────────────────────────────── */}
        <TabsContent value="ventas" className="mt-6 space-y-6">
          <MetricGrid cards={pickCards(modules.repairs ? ['gross', 'pos-revenue', 'sales', 'ticket'] : ['pos-revenue', 'sales', 'ticket', 'margin'])} />

          <Panel title="Ventas por día" description={`${salesSourcesLabel} del período elegido.`}>
            {snapshot.salesTrend.length ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <MiniStat label="Total vendido" value={formatCurrency(snapshot.finance.operationalRevenue)} tone="info" />
                  <MiniStat label="Ganancia neta devengada" value={snapshot.finance.netProfit === null ? 'Pendiente' : formatCurrency(snapshot.finance.netProfit)} tone={snapshot.finance.netProfit === null ? 'warning' : snapshot.finance.netProfit >= 0 ? 'success' : 'danger'} />
                  <MiniStat label="vs. período anterior" value={formatPercent(snapshot.finance.growth)} tone={snapshot.finance.growth !== null && snapshot.finance.growth >= 0 ? 'success' : 'warning'} />
                </div>
                <SalesTrendChart data={snapshot.salesTrend} height={320} chartRef={salesTrendRef} showRepairs={modules.repairs} />
              </div>
            ) : (
              <EmptyState
                title="No hay ventas en el rango actual"
                description="Ajustá la fecha o revisá si el período todavía no tiene transacciones completadas."
              />
            )}
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel title="¿A qué hora se vende más?" description="Útil para planificar turnos y horarios de caja.">
              <div ref={hourlyRef} className="h-[260px]" role="img" aria-label="Gráfico de ventas por hora del día">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={snapshot.hourlySales}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} interval={3} tickMargin={8} />
                    <YAxis tickFormatter={(value) => formatCompact(value)} tickLine={false} axisLine={false} width={56} />
                    <Tooltip content={<NumberTooltip />} />
                    <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} name="Ingreso por hora" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Ventas por sucursal" description="Movimiento del POS en cada local.">
              <div ref={branchRef} className="h-[260px]">
                {snapshot.salesByBranch.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={snapshot.salesByBranch}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                      <YAxis tickFormatter={(value) => formatCompact(value)} tickLine={false} axisLine={false} width={56} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="value" fill="#0f766e" radius={[6, 6, 0, 0]} name="Movimiento POS" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyState
                    title="Sin movimiento por sucursal"
                    description="No hay sesiones o movimientos POS suficientes para comparar sucursales."
                  />
                )}
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Productos más vendidos" description="Ordenados por lo facturado en el período.">
              <RankingTable
                rows={snapshot.topProducts}
                columns={['Producto', 'Vendido', 'Unidades', 'Margen y stock']}
                emptyTitle="Todavía no hay ranking de productos"
                emptyDescription="Se necesita al menos una venta con ítems para armar la tabla."
              />
            </Panel>
            <Panel title="Ventas por cajero" description="Quién facturó más en el período.">
              <RankingTable
                rows={snapshot.salesByCashier}
                columns={['Cajero', 'Facturado', 'Ventas', 'Ticket medio']}
                emptyTitle="Sin desempeño por cajero"
                emptyDescription="Cuando las ventas tengan cajero asociado, el ranking aparece acá."
              />
            </Panel>
          </div>

          {snapshot.quickStats.length ? (
            <Panel title="Atajo: ventas POS recientes" description="Siempre sobre hoy, los últimos 7 y los últimos 30 días, sin importar el filtro.">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {snapshot.quickStats.map((stat) => (
                  <MiniStat key={stat.id} label={stat.label} value={stat.formattedValue} tone="neutral" />
                ))}
              </div>
            </Panel>
          ) : null}
        </TabsContent>

        {/* ── Dinero y cajas ─────────────────────────────────────────────── */}
        <TabsContent value="dinero" className="mt-6 space-y-6">
          <MetricGrid cards={pickCards([revenueCard, 'margin', 'alerts'])} className="xl:grid-cols-3" />

          <div className="grid gap-6 xl:grid-cols-5">
            <Panel title="Resultado del período" description="Ingresos, egresos y ganancia comparados con el período anterior." className="xl:col-span-3">
              {financeStats}
              <div ref={financeRef} className="mt-6 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={snapshot.financeComparison}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickFormatter={(value) => formatCompact(value)} tickLine={false} axisLine={false} width={56} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="ingresos" fill="#2563eb" radius={[6, 6, 0, 0]} name="Ingresos" />
                    <Bar dataKey="egresos" fill="#d97706" radius={[6, 6, 0, 0]} name="Egresos" />
                    <Bar dataKey="ganancia" fill="#0f766e" radius={[6, 6, 0, 0]} name="Ganancia" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel title="Estado de cajas" description="Cajas abiertas, diferencias y movimientos de efectivo." className="xl:col-span-2">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Cajas abiertas" value={String(snapshot.operations.openRegisters)} tone="info" />
                <MiniStat label="Alertas graves" value={String(snapshot.operations.criticalAlerts)} tone={snapshot.operations.criticalAlerts > 0 ? 'danger' : 'success'} />
                <MiniStat label="Diferencias de dinero" value={formatCurrency(snapshot.operations.discrepancies)} tone={snapshot.operations.discrepancies > 0 ? 'warning' : 'success'} />
                <MiniStat label="Alertas sin resolver" value={String(snapshot.operations.unresolvedAlerts)} tone={snapshot.operations.unresolvedAlerts > 0 ? 'warning' : 'success'} />
                <MiniStat label="Dinero retirado" value={formatCurrency(snapshot.operations.withdrawals)} tone="warning" />
                <MiniStat label="Dinero ingresado" value={formatCurrency(snapshot.operations.deposits)} tone="info" />
              </div>
            </Panel>
          </div>
        </TabsContent>

        {/* ── Inventario ─────────────────────────────────────────────────── */}
        {modules.inventory ? (
          <TabsContent value="inventario" className="mt-6 space-y-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat label="Productos con poco stock" value={String(snapshot.inventory.lowStockCount)} tone={snapshot.inventory.lowStockCount > 0 ? 'warning' : 'success'} />
              <MiniStat label="Productos sin ventas" value={String(snapshot.inventory.idleProductsCount)} tone="info" />
              <MiniStat label="Rotación" value={`${snapshot.inventory.turnover.toFixed(1)}%`} tone="neutral" />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Panel title="Categorías que más venden" description="Participación de cada categoría en lo vendido.">
                {snapshot.topCategories.length ? (
                  <div className="grid items-center gap-5 sm:grid-cols-[200px_minmax(0,1fr)]">
                    <div ref={categoriesRef} className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={snapshot.topCategories} dataKey="value" nameKey="label" innerRadius={52} outerRadius={84} paddingAngle={3}>
                            {snapshot.topCategories.map((entry, index) => (
                              <Cell key={entry.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <ul className="space-y-2">
                      {snapshot.topCategories.map((entry, index) => (
                        <li key={entry.label} className="flex items-center justify-between gap-3 text-sm">
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                            <span className="truncate">{entry.label}</span>
                          </span>
                          <span className="shrink-0 tabular-nums text-muted-foreground">
                            {categoryTotal > 0 ? `${Math.round((entry.value / categoryTotal) * 100)}%` : '--'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <EmptyState
                    title="Sin suficiente detalle de inventario"
                    description="Todavía no hay ventas que permitan ver qué categorías rotan."
                  />
                )}
              </Panel>

              <Panel title="Por agotarse" description="Productos en o por debajo del stock mínimo.">
                <RankingTable
                  rows={snapshot.lowStockProducts}
                  columns={['Producto', 'Stock', 'Mínimo', 'Categoría']}
                  emptyTitle="Nada por agotarse"
                  emptyDescription="Ningún producto está por debajo de su stock mínimo."
                />
              </Panel>
            </div>
          </TabsContent>
        ) : null}

        {/* ── Clientes ───────────────────────────────────────────────────── */}
        {modules.crm ? (
          <TabsContent value="clientes" className="mt-6 space-y-6">
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
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

            <Panel title="Mejores clientes" description="Quiénes más compraron en el período.">
              <RankingTable
                rows={snapshot.customerLeaders}
                columns={['Cliente', 'Compró', 'Compras', 'Perfil']}
                emptyTitle="Sin compradores destacados"
                emptyDescription="Todavía no hay suficientes clientes identificados en el rango para armar el ranking."
              />
            </Panel>
          </TabsContent>
        ) : null}

        {/* ── Taller ─────────────────────────────────────────────────────── */}
        {modules.repairs ? (
          <TabsContent value="taller" className="mt-6 space-y-6">
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <MiniStat label="Ingresadas" value={String(repairs.receivedCount)} tone="info" />
              <MiniStat label="En curso" value={String(repairs.activeCount)} tone="info" />
              <MiniStat label="Terminadas" value={String(repairs.finishedCount)} tone="success" hint="Listas para retirar más entregadas" />
              <MiniStat label="Listas sin retirar" value={String(repairs.readyForPickupCount)} tone={repairs.readyForPickupCount > 0 ? 'warning' : 'success'} />
              <MiniStat label="Entregadas" value={String(repairs.completedCount)} tone="success" hint="De las ingresadas en el período" />
              <MiniStat label="Demora promedio" value={`${repairs.avgCycleDays.toFixed(1)} días`} tone="neutral" />
              <MiniStat label="Facturado" value={formatCurrency(repairs.revenue)} tone="success" />
              {repairs.cancelledCount > 0 ? (
                <MiniStat label="Canceladas" value={String(repairs.cancelledCount)} tone="warning" />
              ) : null}
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Panel title="Estado de las reparaciones" description="Dónde están hoy los equipos ingresados.">
                <div ref={repairsRef} className="h-[260px]">
                  {snapshot.repairStatus.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={snapshot.repairStatus} layout="vertical">
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="rgba(148,163,184,0.22)" />
                        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={110} />
                        <Tooltip content={<NumberTooltip />} />
                        <Bar dataKey="value" fill="#0f766e" radius={[0, 6, 6, 0]} name="Reparaciones" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState
                      title="Sin reparaciones en el período"
                      description="Cuando ingresen equipos al taller, acá vas a ver en qué estado está cada uno."
                    />
                  )}
                </div>
              </Panel>

              <Panel title="Técnicos" description="Entregas, facturación y demora de cada técnico.">
                <RankingTable
                  rows={snapshot.technicians}
                  columns={['Técnico', 'Entregadas', 'Facturado', 'Demora']}
                  emptyTitle="Sin técnicos evaluables"
                  emptyDescription="Se necesitan reparaciones con técnico asignado para comparar."
                />
              </Panel>
            </div>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  )
}
