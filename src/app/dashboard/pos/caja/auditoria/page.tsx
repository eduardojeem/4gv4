'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { useCashRegisterContext, ZClosureRecord } from '../../contexts/CashRegisterContext'
import { CashMovement } from '@/hooks/useCashRegister'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Activity, AlertTriangle, ArrowDownCircle, ArrowLeft, ArrowUpCircle,
  CheckCircle2, ChevronDown, ChevronRight, Clock, Download,
  DoorClosed, DoorOpen, Filter, History, RefreshCw, Search, Shield,
  ShoppingCart, X
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { CashRegisterState } from '../../types'

// ─── utils ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    full: d.toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })
  }
}

function duration(a: string, b: string) {
  const ms = new Date(b).getTime() - new Date(a).getTime()
  if (ms < 0) return '—'
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

type MovMeta = { label: string; icon: React.ReactNode; color: string; sign: string }
function movMeta(type: CashMovement['type']): MovMeta {
  switch (type) {
    case 'opening':  return { label: 'Apertura', icon: <DoorOpen className="h-3.5 w-3.5" />,         color: 'text-emerald-600 dark:text-emerald-400', sign: '+' }
    case 'closing':  return { label: 'Cierre',   icon: <DoorClosed className="h-3.5 w-3.5" />,        color: 'text-rose-600 dark:text-rose-400',        sign: '' }
    case 'sale':     return { label: 'Venta',    icon: <ShoppingCart className="h-3.5 w-3.5" />,       color: 'text-violet-600 dark:text-violet-400',    sign: '+' }
    case 'cash_in':  return { label: 'Entrada',  icon: <ArrowUpCircle className="h-3.5 w-3.5" />,      color: 'text-blue-600 dark:text-blue-400',        sign: '+' }
    case 'cash_out': return { label: 'Salida',   icon: <ArrowDownCircle className="h-3.5 w-3.5" />,    color: 'text-amber-600 dark:text-amber-400',      sign: '-' }
    default:         return { label: type,        icon: <Activity className="h-3.5 w-3.5" />,           color: 'text-muted-foreground',                  sign: '' }
  }
}

function typeFilterMatch(type: CashMovement['type'], filter: string) {
  if (filter === 'all') return true
  return type === filter
}

// ─── timeline ───────────────────────────────────────────────────────────────

function SessionTimeline({ movements, typeFilter }: { movements: CashMovement[]; typeFilter: string }) {
  const sorted = useMemo(() =>
    [...movements]
      .filter(m => typeFilterMatch(m.type, typeFilter))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [movements, typeFilter]
  )
  if (sorted.length === 0) return (
    <p className="text-xs text-muted-foreground py-4 text-center">Sin movimientos para este filtro</p>
  )
  return (
    <div className="relative pl-6">
      <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border/50" />
      {sorted.map((m, i) => {
        const meta = movMeta(m.type)
        const t = fmt(m.created_at)
        return (
          <div key={m.id ?? i} className="relative mb-2.5 last:mb-0">
            <div className={`absolute -left-3.5 top-1 h-5 w-5 rounded-full border-2 border-background bg-card flex items-center justify-center ${meta.color}`}>
              <span className="scale-75">{meta.icon}</span>
            </div>
            <div className="ml-3 flex items-start justify-between gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 hover:bg-muted/40 transition-colors">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />{t.date} {t.time}
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

// ─── session card ────────────────────────────────────────────────────────────

function SessionCard({ session, typeFilter, isOpen }: { session: ZClosureRecord; typeFilter: string; isOpen?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const diff = session.discrepancy
  const hasDiff = !isOpen && Math.abs(diff) >= 1
  const opened = fmt(session.openedAt)
  const closed = isOpen ? null : fmt(session.closedAt)

  return (
    <div className={`rounded-xl border bg-card shadow-sm overflow-hidden ${hasDiff ? 'border-amber-300/60 dark:border-amber-700/40' : isOpen ? 'border-emerald-400/60 dark:border-emerald-700/40' : 'border-border/60'}`}>
      <button onClick={() => setExpanded(o => !o)} className="w-full text-left px-4 py-4 hover:bg-muted/30 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 text-muted-foreground shrink-0">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap text-sm">
                <span className="flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                  <DoorOpen className="h-3.5 w-3.5" /> {opened.date} {opened.time}
                </span>
                {closed ? (
                  <>
                    <span className="text-muted-foreground">→</span>
                    <span className="flex items-center gap-1 font-medium text-rose-700 dark:text-rose-400">
                      <DoorClosed className="h-3.5 w-3.5" /> {closed.date} {closed.time}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />{duration(session.openedAt, session.closedAt)}
                    </span>
                  </>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-400 dark:text-emerald-400">
                    🟢 En curso
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Caja: <span className="font-medium text-foreground">{session.registerId}</span>
                {session.openedBy && <> · Abrió: <span className="font-medium text-foreground">{session.openedBy}</span></>}
                {!isOpen && session.closedBy && session.closedBy !== 'system' && <> · Cerró: <span className="font-medium text-foreground">{session.closedBy}</span></>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 flex-wrap justify-end">
            {!isOpen && (
              <>
                <div className="text-right hidden sm:block">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ventas</p>
                  <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{formatCurrency(session.totalSales)}</p>
                </div>
                {hasDiff ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold border bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700">
                    <AlertTriangle className="h-3 w-3" />{diff > 0 ? '+' : ''}{formatCurrency(diff)}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold border bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="h-3 w-3" />OK
                  </span>
                )}
              </>
            )}
            <Badge variant="outline" className="tabular-nums text-xs">{session.movementsCount} mov.</Badge>
          </div>
        </div>
        <div className="mt-2 ml-7 flex gap-4 flex-wrap text-xs text-muted-foreground">
          <span><ArrowUpCircle className="h-3 w-3 inline text-blue-500 mr-0.5" />Entradas: {formatCurrency(session.totalCashIn)}</span>
          <span><ArrowDownCircle className="h-3 w-3 inline text-amber-500 mr-0.5" />Salidas: {formatCurrency(session.totalCashOut)}</span>
          <span><DoorOpen className="h-3 w-3 inline text-emerald-500 mr-0.5" />Apertura: {formatCurrency(session.openingBalance)}</span>
          {!isOpen && <span><DoorClosed className="h-3 w-3 inline text-rose-500 mr-0.5" />Cierre: {formatCurrency(session.closingBalance)}</span>}
        </div>
      </button>
      {expanded && (
        <div className="border-t border-border/40 bg-muted/10 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-4">
            Timeline · {session.movements.filter(m => typeFilterMatch(m.type, typeFilter)).length} eventos
          </p>
          <SessionTimeline movements={session.movements} typeFilter={typeFilter} />
        </div>
      )}
    </div>
  )
}

function KpiCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className={`rounded-xl border p-4 bg-card shadow-sm ${color ?? 'border-border/60'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
    </div>
  )
}

// ─── helpers for open session conversion ─────────────────────────────────────

function openSessionToRecord(reg: CashRegisterState): ZClosureRecord {
  const totalSales = reg.movements.filter(m => m.type === 'sale').reduce((s, m) => s + m.amount, 0)
  return {
    id: 'current',
    registerId: 'Caja actual',
    date: new Date().toISOString().split('T')[0],
    openedAt: reg.movements.find(m => m.type === 'opening')?.created_at ?? new Date().toISOString(),
    openedBy: undefined,
    openingBalance: reg.openingBalance ?? 0,
    closedAt: new Date().toISOString(),
    closedBy: '',
    closingBalance: reg.balance,
    expectedBalance: reg.balance,
    discrepancy: 0,
    totalSales,
    totalCashIn: reg.movements.filter(m => m.type === 'cash_in').reduce((s, m) => s + m.amount, 0),
    totalCashOut: reg.movements.filter(m => m.type === 'cash_out').reduce((s, m) => s + m.amount, 0),
    salesByCash: 0, salesByCard: 0, salesByTransfer: 0, salesByMixed: 0,
    movementsCount: reg.movements.length,
    movements: reg.movements as CashMovement[]
  }
}

const PAGE_SIZE = 10

// ─── main ─────────────────────────────────────────────────────────────────────

export default function CashRegisterAuditPage() {
  const { user } = useAuth()
  const {
    auditLog, fetchAuditLog,
    zClosureHistory, fetchZClosureHistory,
    registers, checkPermission, getCurrentRegister
  } = useCashRegisterContext()

  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [period, setPeriod] = useState<'all' | 'week' | 'month' | 'year'>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [view, setView] = useState<'sessions' | 'log'>('sessions')

  const canAccess = user?.role === 'admin' || checkPermission('canViewAuditLog')
  const canExport = checkPermission('canExportData')

  const loadData = useCallback(async () => {
    setLoading(true)
    try { await Promise.all([fetchAuditLog(), fetchZClosureHistory()]) }
    finally { setLoading(false) }
  }, [fetchAuditLog, fetchZClosureHistory])

  useEffect(() => { if (canAccess) loadData() }, [canAccess, loadData])
  useEffect(() => { setVisibleCount(PAGE_SIZE) }, [search, typeFilter, period, view])

  // build sessions list: current open + closed history
  const reg = getCurrentRegister
  const allSessions: ZClosureRecord[] = useMemo(() => {
    const closed = [...zClosureHistory].sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
    if (reg.isOpen) return [openSessionToRecord(reg), ...closed]
    return closed
  }, [zClosureHistory, reg])

  const hasFilters = search || typeFilter !== 'all' || period !== 'all'

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase()
    const now = new Date()
    let cutoff: Date | null = null
    if (period === 'week') { cutoff = new Date(now); cutoff.setDate(now.getDate() - 7) }
    else if (period === 'month') { cutoff = new Date(now); cutoff.setMonth(now.getMonth() - 1) }
    else if (period === 'year') { cutoff = new Date(now); cutoff.setFullYear(now.getFullYear() - 1) }

    return allSessions.filter(s => {
      if (cutoff && new Date(s.openedAt) < cutoff) return false
      if (typeFilter !== 'all' && !s.movements.some(m => m.type === typeFilter)) return false
      if (!q) return true
      return `${s.registerId} ${s.openedBy ?? ''} ${s.closedBy}`.toLowerCase().includes(q)
    })
  }, [allSessions, search, typeFilter, period])

  // flat audit log filtered
  const filteredLog = useMemo(() => {
    const q = search.trim().toLowerCase()
    return auditLog
      .filter(e => {
        if (typeFilter !== 'all' && e.action.toLowerCase() !== typeFilter) return false
        if (!q) return true
        return `${e.action} ${e.details} ${e.userName}`.toLowerCase().includes(q)
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [auditLog, search, typeFilter])

  const kpis = useMemo(() => {
    const total = zClosureHistory.length
    const open = reg.isOpen ? 1 : 0
    const perfect = zClosureHistory.filter(s => Math.abs(s.discrepancy) < 1).length
    const sales = zClosureHistory.reduce((s, c) => s + c.totalSales, 0)
    return { total, open, perfect, withDiff: total - perfect, sales }
  }, [zClosureHistory, reg.isOpen])

  const exportCsv = () => {
    if (!canExport) return
    const headers = ['Apertura', 'Cierre', 'Caja', 'Abrió', 'Cerró', 'Saldo inicial', 'Saldo final', 'Esperado', 'Diferencia', 'Ventas', 'Movimientos']
    const rows = filteredSessions.filter(s => s.id !== 'current').map(s => [
      fmt(s.openedAt).full, fmt(s.closedAt).full,
      s.registerId, s.openedBy ?? '', s.closedBy,
      s.openingBalance, s.closingBalance, s.expectedBalance, s.discrepancy, s.totalSales, s.movementsCount
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `auditoria_sesiones_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
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
          <p className="text-sm text-muted-foreground">No tenés permisos para ver la auditoría de caja.</p>
          <Link href="/dashboard/pos/caja">
            <Button variant="outline" className="gap-2"><ArrowLeft className="h-4 w-4" />Volver a Caja</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-5 animate-in fade-in duration-300">

      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/pos/caja">
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold tracking-tight">Auditoría de Caja</h1>
              <Badge variant="secondary">{filteredSessions.length} sesiones</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 ml-7">Historial de sesiones con apertura, cierre y timeline de movimientos</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/pos/caja/historial">
            <Button variant="outline" size="sm" className="gap-2"><History className="h-4 w-4" /><span className="hidden sm:inline">Historial</span></Button>
          </Link>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
          {canExport && (
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredSessions.length === 0} className="gap-2">
              <Download className="h-4 w-4" /><span className="hidden sm:inline">CSV</span>
            </Button>
          )}
        </div>
      </div>

      {/* kpis */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KpiCard label="Sesiones cerradas" value={kpis.total} />
        <KpiCard label="En curso" value={kpis.open} color={kpis.open > 0 ? 'border-emerald-300/60 dark:border-emerald-700/40' : 'border-border/60'} />
        <KpiCard label="Sin diferencia" value={kpis.perfect} color="border-emerald-200/60 dark:border-emerald-800/40" />
        <KpiCard label="Con diferencia" value={kpis.withDiff} color={kpis.withDiff > 0 ? 'border-amber-200/60 dark:border-amber-800/40' : 'border-border/60'} />
        <KpiCard label="Ventas totales" value={formatCurrency(kpis.sales)} />
      </div>

      {/* filters */}
      <div className="rounded-xl border border-border/60 bg-card shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Filter className="h-4 w-4" />Filtros
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setTypeFilter('all'); setPeriod('all') }}
              className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />Limpiar
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por caja, usuario…" className="pl-9 h-9 bg-background" />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 bg-background"><SelectValue placeholder="Tipo de movimiento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="opening">Apertura</SelectItem>
              <SelectItem value="closing">Cierre</SelectItem>
              <SelectItem value="sale">Ventas</SelectItem>
              <SelectItem value="cash_in">Entradas</SelectItem>
              <SelectItem value="cash_out">Salidas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={v => setPeriod(v as typeof period)}>
            <SelectTrigger className="h-9 bg-background"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el tiempo</SelectItem>
              <SelectItem value="week">Última semana</SelectItem>
              <SelectItem value="month">Último mes</SelectItem>
              <SelectItem value="year">Último año</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* session cards */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-4"><Skeleton className="h-3 w-16" /><Skeleton className="h-3 w-20" /></div>
            </div>
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 rounded-xl border border-border/60 bg-card text-muted-foreground">
          <div className="p-5 bg-muted/40 rounded-full"><Activity className="h-9 w-9 opacity-30" /></div>
          <p className="font-medium text-sm">{hasFilters ? 'Sin sesiones para los filtros aplicados' : 'No hay sesiones registradas'}</p>
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={() => { setSearch(''); setTypeFilter('all'); setPeriod('all') }} className="gap-1.5">
              <X className="h-3.5 w-3.5" />Limpiar filtros
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {filteredSessions.slice(0, visibleCount).map(s => (
              <SessionCard key={s.id} session={s} typeFilter={typeFilter} isOpen={s.id === 'current'} />
            ))}
          </div>
          {visibleCount < filteredSessions.length ? (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                Mostrando <span className="font-semibold text-foreground">{Math.min(visibleCount, filteredSessions.length)}</span> de <span className="font-semibold text-foreground">{filteredSessions.length}</span>
              </span>
              <Button variant="outline" size="sm" onClick={() => setVisibleCount(v => v + PAGE_SIZE)}>
                Cargar {Math.min(PAGE_SIZE, filteredSessions.length - visibleCount)} más
              </Button>
            </div>
          ) : filteredSessions.length > PAGE_SIZE && (
            <p className="text-xs text-center text-muted-foreground">Todas las {filteredSessions.length} sesiones cargadas</p>
          )}
        </>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
        <span>Esta sección es solo para administradores. Los registros se conservan indefinidamente.</span>
      </div>
    </div>
  )
}
