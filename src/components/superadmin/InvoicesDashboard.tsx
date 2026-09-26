'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowUpDown,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Minus,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
  XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Pagination } from '@/components/ui/pagination'
import { useUrlListState } from '@/hooks/useUrlListState'
import { cn } from '@/lib/utils'
import { paginateList, SUPERADMIN_PAGE_SIZES } from '@/lib/superadmin/list-pagination'
import { sumMoneyByCurrency, type CurrencyTotal } from '@/lib/superadmin/money-totals'
import { paymentMethodLabel } from '@/lib/i18n/labels'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InvoiceRow = {
  id: string
  organizationId: string
  organizationName: string | null
  organizationSlug: string | null
  organizationPlan: string | null
  planId: string | null
  amount: number
  currency: string
  status: string
  paymentMethod: string | null
  provider: string | null
  providerPaymentId: string | null
  externalReference: string | null
  receiptUrl: string | null
  paidAt: string | null
  createdAt: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-PY', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'PYG' ? 0 : 2,
    }).format(amount)
  } catch {
    return `${amount.toLocaleString('es-PY')} ${currency}`
  }
}

function formatCurrencyTotals(totals: CurrencyTotal[]) {
  if (totals.length === 0) return formatMoney(0, 'PYG')
  return totals.map(({ amount, currency }) => formatMoney(amount, currency)).join(' + ')
}

function formatDateShort(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-PY', { dateStyle: 'medium' }).format(new Date(value))
}

function getInitials(name: string | null) {
  if (!name) return '—'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function csvCell(v: unknown) { return `"${String(v ?? '').replace(/"/g, '""')}"` }

function SortIndicator({
  col,
  sortKey,
  sortDir,
}: {
  col: SortKey
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
}) {
  if (sortKey !== col) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />
  return sortDir === 'asc'
    ? <ChevronUp className="ml-1 h-3 w-3 text-indigo-500" />
    : <ChevronDown className="ml-1 h-3 w-3 text-indigo-500" />
}

const STATUS_META: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  paid:      { label: 'Pagada',      color: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300', icon: CheckCircle2 },
  pending:   { label: 'Pendiente',   color: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300',            icon: Clock },
  failed:    { label: 'Fallida',     color: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300',                        icon: XCircle },
  refunded:  { label: 'Reembolsada', color: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',                icon: ArrowUpDown },
  cancelled: { label: 'Cancelada',   color: 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',                icon: XCircle },
}

const PLAN_COLORS: Record<string, string> = {
  FREE: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400',
  BASIC: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-300',
  PRO: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300',
  ENTERPRISE: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300',
}

const PROVIDER_META: Record<string, { label: string; color: string }> = {
  pagopar: { label: 'Pagopar', color: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-300' },
  mercado_pago: { label: 'Mercado Pago', color: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/20 dark:text-cyan-300' },
  stripe: { label: 'Stripe', color: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-300' },
  bancard: { label: 'Bancard', color: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300' },
  manual: { label: 'Manual', color: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400' },
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, icon: Icon, tone = 'default' }: {
  label: string; value: string | number; sub: string
  icon: React.ComponentType<{ className?: string }>
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const tones = {
    default: 'bg-card border',
    success: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20',
    warning: 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20',
    danger:  'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20',
    info:    'border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/20',
  }
  const iconTones = {
    default: 'text-slate-500',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger:  'text-red-600 dark:text-red-400',
    info:    'text-blue-600 dark:text-blue-400',
  }
  return (
    <div className={cn('rounded-xl border p-5', tones[tone])}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-50 truncate">{value}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sub}</p>
        </div>
        <div className={cn('rounded-lg border bg-background p-2', iconTones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Provider distribution bar
// ---------------------------------------------------------------------------

function ProviderDistribution({ rows }: { rows: InvoiceRow[] }) {
  const counts = new Map<string, { count: number; total: number }>()
  rows.forEach((r) => {
    const key = r.provider ?? 'manual'
    const c = counts.get(key) ?? { count: 0, total: 0 }
    c.count++
    if (r.status === 'paid') c.total += r.amount
    counts.set(key, c)
  })
  const total = rows.length
  if (total === 0) return null

  const entries = Array.from(counts.entries()).sort((a, b) => b[1].count - a[1].count)

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Distribución por proveedor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {entries.map(([key, c]) => {
          const meta = PROVIDER_META[key] ?? { label: key, color: 'border-slate-200 bg-slate-50 text-slate-600' }
          const percent = Math.round((c.count / total) * 100)
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-sm">
                <Badge variant="outline" className={cn('rounded-full text-[10px]', meta.color)}>
                  {meta.label}
                </Badge>
                <span className="font-medium tabular-nums text-slate-500">
                  {c.count} pagos · {formatMoney(c.total, 'PYG')}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div className="h-full rounded-full bg-indigo-500" style={{ width: `${percent}%` }} />
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

type SortKey = 'date' | 'org' | 'amount' | 'status'
type FilterStatus = 'all' | 'paid' | 'pending' | 'failed'
type DateFilter = 'all' | '7d' | '30d' | '90d'

export function InvoicesDashboard({ rows, referenceTime }: { rows: InvoiceRow[]; referenceTime: string }) {
  const router = useRouter()
  const { state, setValue } = useUrlListState({
    q: '',
    status: 'all',
    period: 'all',
    provider: 'all',
    sort: 'date',
    dir: 'desc',
    page: '1',
    size: '25',
  })
  const search = state.q
  const statusFilter = state.status as FilterStatus
  const dateFilter = state.period as DateFilter
  const providerFilter = state.provider
  const sortKey = state.sort as SortKey
  const sortDir = state.dir as 'asc' | 'desc'
  const setFilter = (key: 'q' | 'status' | 'period' | 'provider', value: string) => {
    setValue(key, value)
    setValue('page', '1')
  }
  const setSearch = (value: string) => setFilter('q', value)
  const setStatusFilter = (value: FilterStatus) => setFilter('status', value)
  const setDateFilter = (value: DateFilter) => setFilter('period', value)
  const setProviderFilter = (value: string) => setFilter('provider', value)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setValue('dir', sortDir === 'asc' ? 'desc' : 'asc')
    else {
      setValue('sort', key)
      setValue('dir', key === 'date' || key === 'amount' ? 'desc' : 'asc')
    }
    setValue('page', '1')
  }

  const stats = useMemo(() => {
    const paid = rows.filter((r) => r.status === 'paid')
    const pending = rows.filter((r) => r.status === 'pending')
    const failed = rows.filter((r) => r.status === 'failed')

    const totalRevenue = sumMoneyByCurrency(paid)

    const now = new Date(referenceTime).getTime()
    const monthAgo = now - 30 * 86400000
    const thisMonthRevenue = sumMoneyByCurrency(
      paid.filter((r) => r.paidAt && new Date(r.paidAt).getTime() >= monthAgo)
    )

    const pendingAmount = sumMoneyByCurrency(pending)
    const successRate = (paid.length + failed.length) > 0
      ? Math.round((paid.length / (paid.length + failed.length)) * 100)
      : 0

    return {
      total: rows.length, paid: paid.length, pending: pending.length, failed: failed.length,
      totalRevenue, thisMonthRevenue, pendingAmount, successRate,
    }
  }, [referenceTime, rows])

  const statusCounts = useMemo(() => {
    const m = new Map<string, number>()
    rows.forEach((r) => m.set(r.status, (m.get(r.status) ?? 0) + 1))
    return m
  }, [rows])

  const providerOptions = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((r) => set.add(r.provider ?? 'manual'))
    return Array.from(set).sort()
  }, [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const now = new Date(referenceTime).getTime()
    const cutoff = dateFilter === '7d' ? now - 7 * 86400000
      : dateFilter === '30d' ? now - 30 * 86400000
      : dateFilter === '90d' ? now - 90 * 86400000
      : 0

    let list = rows.filter((r) => {
      const matchQ = !q || [
        r.organizationName, r.organizationSlug, r.externalReference,
        r.providerPaymentId, r.id, r.paymentMethod,
      ].some((v) => v?.toLowerCase().includes(q))
      const matchStatus = statusFilter === 'all' || r.status === statusFilter
      const matchProvider = providerFilter === 'all' || (r.provider ?? 'manual') === providerFilter
      const matchDate = cutoff === 0 || (r.createdAt && new Date(r.createdAt).getTime() >= cutoff)
      return matchQ && matchStatus && matchProvider && matchDate
    })

    list = [...list].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'date') cmp = (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
      else if (sortKey === 'org') cmp = (a.organizationName ?? '').localeCompare(b.organizationName ?? '')
      else if (sortKey === 'amount') cmp = a.amount - b.amount
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status)
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [rows, search, statusFilter, providerFilter, dateFilter, sortKey, sortDir, referenceTime])
  const pagination = useMemo(
    () => paginateList(filtered, state.page, state.size),
    [filtered, state.page, state.size]
  )

  function exportCsv() {
    const header = ['Fecha', 'Organización', 'Slug', 'Plan', 'Monto', 'Moneda', 'Estado', 'Proveedor', 'Método', 'Referencia', 'Provider ID']
    const data = filtered.map((r) => [
      r.createdAt ?? '', r.organizationName ?? '', r.organizationSlug ?? '',
      r.planId ?? '', r.amount, r.currency, r.status,
      r.provider ?? '', r.paymentMethod ?? '', r.externalReference ?? '', r.providerPaymentId ?? '',
    ])
    const blob = new Blob([[header, ...data].map((row) => row.map(csvCell).join(',')).join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `facturas-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const thClass = 'px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400'
  const thBtn = 'flex cursor-pointer select-none items-center whitespace-nowrap hover:text-slate-800 dark:hover:text-slate-200 transition-colors'

  const statusPills: Array<{ key: FilterStatus; label: string }> = [
    { key: 'all', label: 'Todos' },
    { key: 'paid', label: 'Pagadas' },
    { key: 'pending', label: 'Pendientes' },
    { key: 'failed', label: 'Fallidas' },
  ]

  const datePills: Array<{ key: DateFilter; label: string }> = [
    { key: 'all', label: 'Todo' },
    { key: '7d', label: '7 días' },
    { key: '30d', label: '30 días' },
    { key: '90d', label: '90 días' },
  ]

  return (
    <div className="mx-auto flex max-w-[1480px] flex-col gap-6">

      {/* Header */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            <FileText className="h-3.5 w-3.5" />
            Facturación SaaS
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Historial de pagos</h1>
          <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            Comprobantes y pagos recibidos vía Pagopar, Mercado Pago, Bancard y otros proveedores.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => router.refresh()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total recaudado" value={formatCurrencyTotals(stats.totalRevenue)} sub={`${stats.paid} pagos confirmados`} icon={TrendingUp} tone="success" />
        <StatCard label="Este mes" value={formatCurrencyTotals(stats.thisMonthRevenue)} sub="últimos 30 días" icon={Calendar} tone="info" />
        <StatCard label="Pendientes" value={formatCurrencyTotals(stats.pendingAmount)} sub={`${stats.pending} pagos en espera`} icon={Clock} tone={stats.pending > 0 ? 'warning' : 'default'} />
        <StatCard label="Tasa de éxito" value={`${stats.successRate}%`} sub={`${stats.failed} pagos fallidos`} icon={CheckCircle2} tone={stats.successRate >= 90 ? 'success' : stats.successRate >= 70 ? 'warning' : 'danger'} />
      </div>

      {/* Provider distribution */}
      {rows.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <ProviderDistribution rows={rows} />
          </div>
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Resumen rápido</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-lg border bg-emerald-50/50 p-3 dark:bg-emerald-950/10">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Pagos exitosos</p>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-900 dark:text-slate-100">{stats.paid}</strong> de {stats.total} pagos completados correctamente
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-lg border bg-amber-50/50 p-3 dark:bg-amber-950/10">
                <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">Cobros pendientes</p>
                  <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                    <strong className="text-slate-900 dark:text-slate-100">{formatCurrencyTotals(stats.pendingAmount)}</strong> en {stats.pending} pagos esperando confirmación
                  </p>
                </div>
              </div>
              {stats.failed > 0 && (
                <div className="flex items-start gap-3 rounded-lg border bg-red-50/50 p-3 dark:bg-red-950/10 sm:col-span-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-300">Atención requerida</p>
                    <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                      <strong className="text-slate-900 dark:text-slate-100">{stats.failed}</strong> pagos fallidos — revisá los errores y considerá contactar al cliente.
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Invoice table */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>Historial de pagos</CardTitle>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {filtered.length} de {rows.length} pagos
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="h-9 w-64 pl-9 text-sm"
                  placeholder="Buscar org, referencia, ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {providerOptions.length > 1 && (
                <select
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">Todos los proveedores</option>
                  {providerOptions.map((p) => (
                    <option key={p} value={p}>{PROVIDER_META[p]?.label ?? p}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            {/* Status pills */}
            <div className="flex flex-wrap gap-1">
              {statusPills.map((f) => {
                const count = f.key === 'all' ? rows.length : (statusCounts.get(f.key) ?? 0)
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setStatusFilter(f.key)}
                    className={cn(
                      'flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                      statusFilter === f.key
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    )}
                  >
                    {f.label}
                    <span className={cn(
                      'flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold',
                      statusFilter === f.key ? 'bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100' : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                    )}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

            {/* Date pills */}
            <div className="flex flex-wrap gap-1">
              {datePills.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setDateFilter(f.key)}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
                    dateFilter === f.key
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-300'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {(search || statusFilter !== 'all' || dateFilter !== 'all' || providerFilter !== 'all') && (
              <button
                type="button"
                onClick={() => { setSearch(''); setStatusFilter('all'); setDateFilter('all'); setProviderFilter('all') }}
                className="h-7 rounded-full px-3 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Limpiar
              </button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="border-b border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className={cn(thClass, 'pl-4')}>
                    <button className={thBtn} onClick={() => toggleSort('date')}>
                      Fecha <SortIndicator col="date" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className={thClass}>
                    <button className={thBtn} onClick={() => toggleSort('org')}>
                      Organización <SortIndicator col="org" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className={thClass}>
                    <button className={thBtn} onClick={() => toggleSort('amount')}>
                      Monto <SortIndicator col="amount" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className={thClass}>
                    <button className={thBtn} onClick={() => toggleSort('status')}>
                      Estado <SortIndicator col="status" sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                  <th className={thClass}>Proveedor</th>
                  <th className={thClass}>Referencia</th>
                  <th className={cn(thClass, 'pr-4 text-right')}>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <Minus className="mx-auto h-8 w-8 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-500">
                        {rows.length === 0 ? 'No hay pagos registrados aún' : 'Sin resultados con estos filtros'}
                      </p>
                    </td>
                  </tr>
                ) : pagination.items.map((r) => {
                  const statusMeta = STATUS_META[r.status] ?? { label: r.status, color: 'border-slate-200 bg-slate-50 text-slate-500', icon: AlertCircle }
                  const providerMeta = PROVIDER_META[r.provider ?? 'manual'] ?? { label: r.provider ?? '—', color: 'border-slate-200 bg-slate-50 text-slate-600' }
                  const StatusIcon = statusMeta.icon

                  return (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                    >
                      {/* Fecha */}
                      <td className="py-3 pl-4 pr-3">
                        <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          {formatDateShort(r.createdAt)}
                        </div>
                        {r.paidAt && r.paidAt !== r.createdAt && (
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                            Pagada: {formatDateShort(r.paidAt)}
                          </div>
                        )}
                      </td>

                      {/* Org */}
                      <td className="px-3 py-3">
                        {r.organizationName ? (
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                              {getInitials(r.organizationName)}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/superadmin/organizations`}
                                className="block truncate text-sm font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400"
                              >
                                {r.organizationName}
                              </Link>
                              <div className="flex items-center gap-1.5">
                                <p className="truncate text-xs text-slate-400">/{r.organizationSlug}</p>
                                {r.organizationPlan && (
                                  <Badge variant="outline" className={cn('rounded-full text-[10px] h-4 px-1.5', PLAN_COLORS[r.organizationPlan] ?? PLAN_COLORS.FREE)}>
                                    {r.organizationPlan}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </td>

                      {/* Monto */}
                      <td className="px-3 py-3">
                        <div className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-50">
                          {formatMoney(r.amount, r.currency)}
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={cn('rounded-full gap-1 text-[11px]', statusMeta.color)}>
                          <StatusIcon className="h-3 w-3" />
                          {statusMeta.label}
                        </Badge>
                      </td>

                      {/* Provider */}
                      <td className="px-3 py-3">
                        <Badge variant="outline" className={cn('rounded-full gap-1 text-[11px]', providerMeta.color)}>
                          <CreditCard className="h-3 w-3" />
                          {providerMeta.label}
                        </Badge>
                        {r.paymentMethod && r.paymentMethod !== providerMeta.label && (
                          <p className="mt-1 text-[11px] text-slate-400">{paymentMethodLabel(r.paymentMethod)}</p>
                        )}
                      </td>

                      {/* Referencia */}
                      <td className="px-3 py-3">
                        <div className="font-mono text-xs text-slate-500 truncate max-w-[180px]" title={r.externalReference ?? r.providerPaymentId ?? r.id}>
                          {r.externalReference ?? r.providerPaymentId ?? r.id.slice(0, 12)}
                        </div>
                      </td>

                      {/* Comprobante */}
                      <td className="py-3 pl-3 pr-4 text-right">
                        {r.receiptUrl ? (
                          <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                            <a href={r.receiptUrl} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" />
                              Ver
                            </a>
                          </Button>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            className="border-t px-4 py-3"
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            itemsPerPage={pagination.pageSize}
            totalItems={filtered.length}
            itemsPerPageOptions={[...SUPERADMIN_PAGE_SIZES]}
            onPageChange={(page) => setValue('page', String(page))}
            onItemsPerPageChange={(size) => {
              setValue('size', String(size))
              setValue('page', '1')
            }}
          />
        </CardContent>
      </Card>
    </div>
  )
}
