'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useCashRegisterContext, ZClosureRecord } from '../../contexts/CashRegisterContext'
import { CashMovement } from '@/hooks/useCashRegister'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertTriangle, ArrowLeft, ArrowDownCircle, ArrowUpCircle,
  CheckCircle2, ChevronDown, ChevronRight, Clock,
  DoorClosed, DoorOpen, Download, Filter,
  History, RefreshCw, Search, Shield, ShoppingCart, X
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useAuth } from '@/contexts/auth-context'

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }),
    full: d.toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })
  }
}

function duration(openedAt: string, closedAt: string): string {
  const ms = new Date(closedAt).getTime() - new Date(openedAt).getTime()
  if (ms < 0) return '—'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h === 0) return `${m}min`
  return `${h}h ${m}min`
}

type MovMeta = { label: string; icon: React.ReactNode; color: string; sign: '+' | '-' | '' }
function movMeta(type: CashMovement['type']): MovMeta {
  switch (type) {
    case 'opening': return { label: 'Apertura', icon: <DoorOpen className="h-3.5 w-3.5" />, color: 'text-emerald-600 dark:text-emerald-400', sign: '+' }
    case 'closing': return { label: 'Cierre', icon: <DoorClosed className="h-3.5 w-3.5" />, color: 'text-rose-600 dark:text-rose-400', sign: '' }
    case 'sale': return { label: 'Venta', icon: <ShoppingCart className="h-3.5 w-3.5" />, color: 'text-violet-600 dark:text-violet-400', sign: '+' }
    case 'cash_in': return { label: 'Entrada', icon: <ArrowUpCircle className="h-3.5 w-3.5" />, color: 'text-blue-600 dark:text-blue-400', sign: '+' }
    case 'cash_out': return { label: 'Salida', icon: <ArrowDownCircle className="h-3.5 w-3.5" />, color: 'text-amber-600 dark:text-amber-400', sign: '-' }
    default: return { label: type, icon: null, color: 'text-muted-foreground', sign: '' }
  }
}

// ─── sub-components ──────────────────────────────────────────────────────────

function SessionTimeline({ movements }: { movements: CashMovement[] }) {
  const sorted = useMemo(() => [...movements].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()), [movements])

  if (sorted.length === 0) return (
    <p className="text-xs text-muted-foreground py-4 text-center">Sin movimientos registrados en esta sesión</p>
  )

  return (
    <div className="relative pl-6">
      {/* vertical line */}
      <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border/60" />

      {sorted.map((m, i) => {
        const meta = movMeta(m.type)
        const t = fmt(m.created_at)
        return (
          <div key={m.id ?? i} className="relative mb-3 last:mb-0">
            {/* dot */}
            <div className={`absolute -left-3.5 top-1 h-5 w-5 rounded-full border-2 border-background bg-card flex items-center justify-center ${meta.color}`}>
              <span className="scale-75">{meta.icon}</span>
            </div>

            <div className="ml-3 flex items-start justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 hover:bg-muted/40 transition-colors">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />{t.time}
                  </span>
                </div>
                {m.reason && <p className="text-xs text-muted-foreground mt-0.5 truncate">{m.reason}</p>}
              </div>
              <span className={`text-sm font-bold tabular-nums shrink-0 ${meta.color}`}>
                {meta.sign}{formatCurrency(m.amount)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SessionCard({ session }: { session: ZClosureRecord }) {
  const [open, setOpen] = useState(false)
  const diff = session.discrepancy
  const hasDiff = Math.abs(diff) >= 1
  const opened = fmt(session.openedAt)
  const closed = fmt(session.closedAt)
  const dur = duration(session.openedAt, session.closedAt)

  return (
    <div className={`rounded-xl border bg-card shadow-sm overflow-hidden transition-all ${hasDiff ? 'border-amber-300/60 dark:border-amber-700/40' : 'border-border/60'}`}>
      {/* ── session header ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full text-left px-4 py-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            {/* expand icon */}
            <div className="mt-0.5 text-muted-foreground shrink-0">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>

            {/* times */}
            <div className="min-w-0">
              {/* Open → Close row */}
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                  <DoorOpen className="h-3.5 w-3.5" />
                  {opened.date} {opened.time}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="flex items-center gap-1 font-medium text-rose-700 dark:text-rose-400">
                  <DoorClosed className="h-3.5 w-3.5" />
                  {closed.date} {closed.time}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />{dur}
                </span>
              </div>

              {/* register + user */}
              <p className="text-xs text-muted-foreground mt-1">
                Caja: <span className="font-medium text-foreground">{session.registerId}</span>
                {session.openedBy && <> · Abrió: <span className="font-medium text-foreground">{session.openedBy}</span></>}
                {session.closedBy && session.closedBy !== 'system' && <> · Cerró: <span className="font-medium text-foreground">{session.closedBy}</span></>}
              </p>
            </div>
          </div>

          {/* right stats */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ventas</p>
              <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrency(session.totalSales)}</p>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Saldo final</p>
              <p className="text-sm font-bold tabular-nums">{formatCurrency(session.closingBalance)}</p>
            </div>
            {hasDiff ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold border bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700">
                <AlertTriangle className="h-3 w-3" />
                {diff > 0 ? '+' : ''}{formatCurrency(diff)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold border bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                <CheckCircle2 className="h-3 w-3" /> OK
              </span>
            )}
          </div>
        </div>

        {/* mini stats row */}
        <div className="mt-3 ml-7 flex gap-4 flex-wrap text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3" />{session.movements.filter(m => m.type === 'sale').length} ventas</span>
          <span className="flex items-center gap-1"><ArrowUpCircle className="h-3 w-3 text-blue-500" />Entradas: {formatCurrency(session.totalCashIn)}</span>
          <span className="flex items-center gap-1"><ArrowDownCircle className="h-3 w-3 text-amber-500" />Salidas: {formatCurrency(session.totalCashOut)}</span>
          <span className="flex items-center gap-1"><DoorOpen className="h-3 w-3 text-emerald-500" />Apertura: {formatCurrency(session.openingBalance)}</span>
          <span>{session.movementsCount} mov. totales</span>
        </div>
      </button>

      {/* ── timeline ── */}
      {open && (
        <div className="border-t border-border/40 bg-muted/10 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Timeline de la sesión
          </p>
          <SessionTimeline movements={session.movements} />
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className={`rounded-xl border p-4 bg-card shadow-sm ${color ?? 'border-border/60'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

const PAGE_SIZE = 15

// ─── main page ────────────────────────────────────────────────────────────────
export default function CashRegisterHistoryPage() {
  const { user } = useAuth()
  const { zClosureHistory, fetchZClosureHistory, checkPermission } = useCashRegisterContext()
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<'all' | 'week' | 'month' | 'year'>('all')
  const [status, setStatus] = useState<'all' | 'perfect' | 'with_diff'>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const canAccess = user?.role === 'admin' || checkPermission('canViewReports')
  const canExport = checkPermission('canExportData')

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try { await fetchZClosureHistory() } finally { setLoading(false) }
  }, [fetchZClosureHistory])

  useEffect(() => { if (canAccess) loadHistory() }, [canAccess, loadHistory])
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [search, period, status])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const now = new Date()
    let cutoff: Date | null = null
    if (period === 'week') { cutoff = new Date(now); cutoff.setDate(now.getDate() - 7) }
    else if (period === 'month') { cutoff = new Date(now); cutoff.setMonth(now.getMonth() - 1) }
    else if (period === 'year') { cutoff = new Date(now); cutoff.setFullYear(now.getFullYear() - 1) }

    return [...zClosureHistory]
      .filter(c => {
        if (cutoff && new Date(c.closedAt) < cutoff) return false
        if (status === 'perfect' && Math.abs(c.discrepancy) >= 1) return false
        if (status === 'with_diff' && Math.abs(c.discrepancy) < 1) return false
        if (!q) return true
        return `${c.registerId} ${c.closedBy} ${c.openedBy ?? ''} ${c.notes ?? ''} ${fmt(c.closedAt).date}`.toLowerCase().includes(q)
      })
      .sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
  }, [zClosureHistory, search, period, status])

  const summary = useMemo(() => {
    const total = filtered.length
    const perfect = filtered.filter(c => Math.abs(c.discrepancy) < 1).length
    const sales = filtered.reduce((s, c) => s + c.totalSales, 0)
    const diffAmount = filtered.reduce((s, c) => s + Math.abs(c.discrepancy), 0)
    const avgDur = filtered.length ? filtered.reduce((s, c) => {
      const ms = new Date(c.closedAt).getTime() - new Date(c.openedAt).getTime()
      return s + (ms > 0 ? ms : 0)
    }, 0) / filtered.length : 0
    const avgH = Math.floor(avgDur / 3600000)
    const avgM = Math.floor((avgDur % 3600000) / 60000)
    const avgDurStr = filtered.length ? (avgH > 0 ? `${avgH}h ${avgM}min` : `${avgM}min`) : '—'
    return { total, perfect, withDiff: total - perfect, sales, diffAmount, avgDurStr }
  }, [filtered])

  const hasFilters = search || period !== 'all' || status !== 'all'

  const exportCsv = () => {
    if (!canExport) return
    const headers = ['Apertura', 'Cierre', 'Duración', 'Caja', 'Abrió', 'Cerró', 'Saldo inicial', 'Saldo final', 'Esperado', 'Diferencia', 'Ventas', 'Entradas', 'Salidas', 'Movimientos']
    const rows = filtered.map(c => [
      fmt(c.openedAt).full, fmt(c.closedAt).full, duration(c.openedAt, c.closedAt),
      c.registerId, c.openedBy ?? '', c.closedBy,
      c.openingBalance, c.closingBalance, c.expectedBalance, c.discrepancy,
      c.totalSales, c.totalCashIn, c.totalCashOut, c.movementsCount
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `historial_cierres_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-950/30 flex items-center justify-center">
            <Shield className="h-8 w-8 text-rose-600 dark:text-rose-400" />
          </div>
          <h1 className="text-lg font-bold">Acceso restringido</h1>
          <p className="text-sm text-muted-foreground">No tenés permisos para ver el historial de cierres.</p>
          <Link href="/dashboard/pos/caja">
            <Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" />Volver a Caja</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-5 animate-in fade-in duration-300">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/pos/caja">
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold tracking-tight">Historial de Sesiones</h1>
              <Badge variant="secondary" className="tabular-nums">{summary.total}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 ml-7">Apertura → Cierre por sesión, con timeline de movimientos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/pos/caja/auditoria">
            <Button variant="outline" size="sm" className="gap-2"><Shield className="h-4 w-4" /><span className="hidden sm:inline">Auditoría</span></Button>
          </Link>
          <Button variant="outline" size="sm" onClick={loadHistory} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          {canExport && (
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0} className="gap-2">
              <Download className="h-4 w-4" /><span className="hidden sm:inline">CSV</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KpiCard label="Sesiones" value={summary.total} />
        <KpiCard label="Sin diferencia" value={summary.perfect} color="border-emerald-200/60 dark:border-emerald-800/40" />
        <KpiCard label="Con diferencia" value={summary.withDiff} color={summary.withDiff > 0 ? 'border-amber-200/60 dark:border-amber-800/40' : 'border-border/60'} />
        <KpiCard label="Ventas acumuladas" value={formatCurrency(summary.sales)} />
        <KpiCard label="Duración promedio" value={summary.avgDurStr} />
      </div>

      {/* ── Filters ── */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" /> Filtros
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setPeriod('all'); setStatus('all') }}
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" /> Limpiar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por caja, usuario…" className="pl-9 h-9 bg-background" />
          </div>
          <Select value={period} onValueChange={v => setPeriod(v as typeof period)}>
            <SelectTrigger className="h-9 bg-background"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el tiempo</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mes</SelectItem>
              <SelectItem value="year">Último año</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={v => setStatus(v as typeof status)}>
            <SelectTrigger className="h-9 bg-background"><SelectValue placeholder="Estado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="perfect">Sin diferencia</SelectItem>
              <SelectItem value="with_diff">Con diferencia</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Session cards ── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-4">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3 rounded-xl border border-border/60 bg-card">
          <div className="p-5 bg-muted/40 rounded-full">
            <History className="h-9 w-9 opacity-30" />
          </div>
          <p className="font-medium text-sm">{hasFilters ? 'Sin sesiones para los filtros aplicados' : 'No hay sesiones cerradas aún'}</p>
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={() => { setSearch(''); setPeriod('all'); setStatus('all') }} className="gap-1.5">
              <X className="h-3.5 w-3.5" /> Limpiar filtros
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {filtered.slice(0, visibleCount).map(s => <SessionCard key={s.id} session={s} />)}
          </div>

          {visibleCount < filtered.length ? (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                Mostrando <span className="font-semibold text-foreground">{Math.min(visibleCount, filtered.length)}</span> de <span className="font-semibold text-foreground">{filtered.length}</span> sesiones
              </span>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => setVisibleCount(v => v + PAGE_SIZE)}>
                Cargar {Math.min(PAGE_SIZE, filtered.length - visibleCount)} más
              </Button>
            </div>
          ) : filtered.length > PAGE_SIZE && (
            <p className="text-xs text-center text-muted-foreground">Todas las {filtered.length} sesiones cargadas</p>
          )}
        </>
      )}
    </div>
  )
}
