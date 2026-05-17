"use client"

import { useMemo, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { endOfDay, startOfDay, subDays } from 'date-fns'
import { toast } from 'sonner'
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
  ChevronDown,
  Download,
  Gauge,
  LayoutDashboard,
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
import { DatePickerWithRange } from '@/components/ui/date-range-picker'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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

function buildCsv(snapshot: ReturnType<typeof useAdminAnalytics>['snapshot']): string {
  const sections: string[] = []

  sections.push('Resumen general')
  sections.push('Metrica,Valor')
  snapshot.headlineCards.forEach((metric) => {
    sections.push(`${metric.label},${metric.rawValue}`)
  })

  sections.push('')
  sections.push('Productos top')
  sections.push('Nombre,Metrica,Secundario,Detalle')
  snapshot.topProducts.forEach((row) => {
    sections.push([row.label, row.metric, row.secondary, row.detail || ''].join(','))
  })

  sections.push('')
  sections.push('Clientes top')
  sections.push('Nombre,Metrica,Secundario,Detalle')
  snapshot.customerLeaders.forEach((row) => {
    sections.push([row.label, row.metric, row.secondary, row.detail || ''].join(','))
  })

  sections.push('')
  sections.push('Tecnicos top')
  sections.push('Nombre,Metrica,Secundario,Detalle')
  snapshot.technicians.forEach((row) => {
    sections.push([row.label, row.metric, row.secondary, row.detail || ''].join(','))
  })

  return sections.join('\n')
}

async function exportAnalyticsExcel(snapshot: ReturnType<typeof useAdminAnalytics>['snapshot']) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()

  const summarySheet = XLSX.utils.json_to_sheet(
    snapshot.headlineCards.map((metric) => ({
      metrica: metric.label,
      valor: metric.value,
      delta: formatPercent(metric.delta),
      contexto: metric.helper,
    }))
  )

  const productsSheet = XLSX.utils.json_to_sheet(
    snapshot.topProducts.map((row) => ({
      producto: row.label,
      ingresos: row.metric,
      volumen: row.secondary,
      detalle: row.detail || '',
    }))
  )

  const customersSheet = XLSX.utils.json_to_sheet(
    snapshot.customerLeaders.map((row) => ({
      cliente: row.label,
      total: row.metric,
      compras: row.secondary,
      detalle: row.detail || '',
    }))
  )

  const techniciansSheet = XLSX.utils.json_to_sheet(
    snapshot.technicians.map((row) => ({
      tecnico: row.label,
      reparaciones: row.metric,
      facturacion: row.secondary,
      detalle: row.detail || '',
    }))
  )

  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen')
  XLSX.utils.book_append_sheet(workbook, productsSheet, 'Productos')
  XLSX.utils.book_append_sheet(workbook, customersSheet, 'Clientes')
  XLSX.utils.book_append_sheet(workbook, techniciansSheet, 'Tecnicos')

  XLSX.writeFile(workbook, `analytics_admin_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

async function exportAnalyticsPdf(snapshot: ReturnType<typeof useAdminAnalytics>['snapshot']) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const getLastTableY = () => {
    const tableAwareDoc = doc as typeof doc & { lastAutoTable?: { finalY?: number } }
    return tableAwareDoc.lastAutoTable?.finalY ?? 96
  }

  doc.setFontSize(22)
  doc.text('Analytics admin', 40, 50)
  doc.setFontSize(11)
  doc.text(`Periodo ${snapshot.periodLabel}`, 40, 72)

  autoTable(doc, {
    startY: 96,
    head: [['Metrica', 'Valor', 'Delta', 'Contexto']],
    body: snapshot.headlineCards.map((metric) => [
      metric.label,
      metric.value,
      formatPercent(metric.delta),
      metric.helper,
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [37, 99, 235] },
  })

  autoTable(doc, {
    startY: getLastTableY() + 24,
    head: [['Producto', 'Ingresos', 'Volumen', 'Detalle']],
    body: snapshot.topProducts.map((row) => [row.label, row.metric, row.secondary, row.detail || '']),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [13, 148, 136] },
  })

  doc.addPage()
  doc.setFontSize(18)
  doc.text('Clientes y tecnicos', 40, 50)

  autoTable(doc, {
    startY: 78,
    head: [['Cliente', 'Total', 'Compras', 'Detalle']],
    body: snapshot.customerLeaders.map((row) => [row.label, row.metric, row.secondary, row.detail || '']),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [245, 158, 11] },
  })

  autoTable(doc, {
    startY: getLastTableY() + 24,
    head: [['Tecnico', 'Entregadas', 'Facturacion', 'Detalle']],
    body: snapshot.technicians.map((row) => [row.label, row.metric, row.secondary, row.detail || '']),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [124, 58, 237] },
  })

  doc.save(`analytics_admin_${new Date().toISOString().slice(0, 10)}.pdf`)
}

function HeroQuickStat({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/40 bg-white/70 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">{value}</p>
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
      className="rounded-full border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-sky-700 dark:text-sky-300"
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
    <div className="rounded-2xl border border-border/70 bg-background/95 px-4 py-3 shadow-xl backdrop-blur">
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
    <div className="rounded-2xl border border-border/70 bg-background/95 px-4 py-3 shadow-xl backdrop-blur">
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
    refresh,
    forceRefresh,
    refreshing,
  } = useAdminAnalytics(filters)

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

  const handleCsvExport = () => {
    try {
      const blob = new Blob([buildCsv(snapshot)], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `analytics_admin_${new Date().toISOString().slice(0, 10)}.csv`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('CSV generado')
    } catch {
      toast.error('Error al generar CSV')
    }
  }

  const handleExcelExport = async () => {
    try {
      await exportAnalyticsExcel(snapshot)
      toast.success('Excel generado')
    } catch {
      toast.error('Error al generar Excel')
    }
  }

  const handlePdfExport = async () => {
    try {
      await exportAnalyticsPdf(snapshot)
      toast.success('PDF generado')
    } catch {
      toast.error('Error al generar PDF')
    }
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

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-border/70 bg-card/95 shadow-sm shadow-black/5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.14),transparent_34%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.10),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.24),transparent_55%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.22),transparent_34%),radial-gradient(circle_at_top_right,rgba(14,165,233,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_55%)]" />
        <div className="relative space-y-6 p-6 lg:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-4">
              <Badge className="rounded-full bg-foreground px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-background">
                Resumen del negocio
              </Badge>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-500/20 bg-sky-500/10 text-sky-700 shadow-sm dark:text-sky-300">
                    <LayoutDashboard className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                      ¿Cómo va el negocio?
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ventas, inventario, cajas, reparaciones y clientes — todo en un solo lugar.
                    </p>
                  </div>
                </div>
                <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                  Seleccioná un periodo para ver los números. Se compara automáticamente con el periodo anterior para que veas si vas mejor o peor.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[420px]">
              {snapshot.quickStats.map((stat) => (
                <HeroQuickStat key={stat.id} label={stat.label} value={stat.formattedValue} />
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/40 bg-white/70 p-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={preset === option.value ? 'default' : 'outline'}
                    size="sm"
                    className={cn(
                      'rounded-full',
                      preset === option.value
                        ? 'bg-foreground text-background hover:bg-foreground/90'
                        : 'border-border/70 bg-background/70'
                    )}
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
                  <SelectTrigger className="w-full min-w-[180px] rounded-full border-border/70 bg-background/80 md:w-[220px]">
                    <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="Sucursal operativa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las sucursales</SelectItem>
                    {branchOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  className="rounded-full border-border/70 bg-background/80"
                  onClick={forceRefresh}
                >
                  <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
                  Actualizar
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="rounded-full">
                      <Download className="h-4 w-4" />
                      Exportar
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Descargas</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={handleCsvExport}>CSV ejecutivo</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void handleExcelExport()}>Excel multihoja</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void handlePdfExport()}>PDF ejecutivo</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
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
          </div>
        </div>
      </section>

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
                  <MiniStat label="Total vendido" value={formatCurrency(snapshot.finance.grossRevenue)} tone="info" />
                  <MiniStat label="Ganancia estimada" value={formatCurrency(snapshot.finance.estimatedProfit)} tone={snapshot.finance.estimatedProfit >= 0 ? 'success' : 'danger'} />
                  <MiniStat label="vs. periodo anterior" value={formatPercent(snapshot.finance.growth)} tone={snapshot.finance.growth !== null && snapshot.finance.growth >= 0 ? 'success' : 'warning'} />
                </div>

                <div className="h-[320px]" role="img" aria-label="Gráfico de tendencia de ventas POS y reparaciones">
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

              <div className="rounded-[24px] border border-border/70 bg-background/60 p-4">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-foreground">¿A qué hora se vende más?</p>
                  <p className="text-sm text-muted-foreground">Útil para planificar turnos y horarios de caja.</p>
                </div>
                <div className="h-[320px]" role="img" aria-label="Gráfico de ventas por hora del día">
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

          <Separator className="my-6" />

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            <MiniStat label="Margen de ganancia" value={`${snapshot.finance.margin.toFixed(1)}%`} tone={snapshot.finance.margin >= 20 ? 'success' : snapshot.finance.margin >= 10 ? 'warning' : 'danger'} />
            <MiniStat label="Clientes que vuelven" value={`${snapshot.customers.recurrenceRate.toFixed(1)}%`} tone={snapshot.customers.recurrenceRate >= 35 ? 'success' : 'info'} />
            <MiniStat label="Cajas abiertas" value={String(snapshot.operations.openRegisters)} tone="info" />
            <MiniStat label="Productos con poco stock" value={String(snapshot.inventory.lowStockCount)} tone={snapshot.inventory.lowStockCount > 0 ? 'warning' : 'success'} />
          </div>
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

          <div className="mt-6 h-[220px]">
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
                <div className="h-[220px]">
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
                    <div key={row.id} className="rounded-2xl border border-border/70 bg-background/60 p-4">
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
            <MiniStat label="Clientes nuevos" value={String(snapshot.customers.newCount)} tone="info" />
            <MiniStat label="Volvieron a comprar" value={String(snapshot.customers.recurrentCount)} tone="success" />
            <MiniStat label="% que vuelven" value={`${snapshot.customers.recurrenceRate.toFixed(1)}%`} tone={snapshot.customers.recurrenceRate >= 35 ? 'success' : 'neutral'} />
            <MiniStat label="Crecimiento" value={formatPercent(snapshot.customers.growth)} tone={snapshot.customers.growth !== null && snapshot.customers.growth >= 0 ? 'success' : 'warning'} />
          </div>

          <div className="mt-5 space-y-3">
            {snapshot.customerLeaders.slice(0, 4).length ? (
              snapshot.customerLeaders.slice(0, 4).map((row) => (
                <div key={row.id} className="rounded-2xl border border-border/70 bg-background/60 p-4">
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
          className="xl:col-span-6"
        >
          <div className="grid gap-3 md:grid-cols-4">
            <MiniStat label="En curso" value={String(snapshot.repairs.activeCount)} tone="info" />
            <MiniStat label="Entregadas" value={String(snapshot.repairs.completedCount)} tone="success" />
            <MiniStat label="Demora promedio" value={`${snapshot.repairs.avgCycleDays.toFixed(1)} días`} tone="neutral" />
            <MiniStat label="Facturado" value={formatCurrency(snapshot.repairs.revenue)} tone="success" />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="h-[260px]">
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
                <div key={row.id} className="rounded-2xl border border-border/70 bg-background/60 p-4">
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
          title="Dinero: ingresos vs gastos"
          description="Cuánto entró, cuánto salió y cuánto quedó de ganancia. Se compara con el periodo anterior."
          badge={<SectionBadge>Finanzas</SectionBadge>}
          className="xl:col-span-6"
        >
          <div className="grid gap-3 md:grid-cols-4">
            <MiniStat label="Entró" value={formatCurrency(snapshot.finance.grossRevenue)} tone="info" />
            <MiniStat label="Salió" value={formatCurrency(snapshot.finance.visibleExpenses)} tone="warning" />
            <MiniStat label="Quedó" value={formatCurrency(snapshot.finance.estimatedProfit)} tone={snapshot.finance.estimatedProfit >= 0 ? 'success' : 'danger'} />
            <MiniStat label="Margen" value={`${snapshot.finance.margin.toFixed(1)}%`} tone={snapshot.finance.margin >= 20 ? 'success' : snapshot.finance.margin >= 10 ? 'warning' : 'danger'} />
          </div>

          <div className="mt-6 h-[280px]">
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
