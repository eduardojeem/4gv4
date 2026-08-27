'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useCashRegisterContext, ZClosureRecord } from '../../contexts/CashRegisterContext'
import { CashMovement } from '@/hooks/useCashRegister'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  DoorClosed,
  DoorOpen,
  Download,
  Filter,
  History,
  RefreshCw,
  Search,
  Shield,
  ShoppingCart,
  X,
  HelpCircle,
  Receipt,
  Banknote,
  CreditCard,
  User,
  Sparkles,
  FileText,
  Layers,
  Check,
  Eye
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useAuth } from '@/contexts/auth-context'
import { formatRegisterName, formatUserLabel, formatEventConcept } from '@/app/dashboard/pos/lib/formatters'
import { downloadCsvReport } from '@/app/dashboard/pos/lib/exportCsv'
import { downloadPdfReport } from '@/app/dashboard/pos/lib/exportPdf'
import { ZClosureDetailsModal } from '@/app/dashboard/pos/components/ZClosureDetailsModal'
import { cn } from '@/lib/utils'

// ─── UTILS DE FORMATO ────────────────────────────────────────────────────────

function fmt(iso: string) {
  const d = new Date(iso)
  return {
    date: d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    shortTime: d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }),
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

type MovMeta = { label: string; icon: React.ReactNode; color: string; bg: string; sign: '+' | '-' | '' }
function movMeta(type: CashMovement['type']): MovMeta {
  switch (type) {
    case 'opening':
    case 'apertura':
      return { label: 'Apertura', icon: <DoorOpen className="h-3.5 w-3.5" />, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', sign: '+' }
    case 'closing':
    case 'cierre':
      return { label: 'Cierre', icon: <DoorClosed className="h-3.5 w-3.5" />, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', sign: '' }
    case 'sale':
    case 'venta':
      return { label: 'Venta', icon: <ShoppingCart className="h-3.5 w-3.5" />, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', sign: '+' }
    case 'cash_in':
    case 'ingreso':
      return { label: 'Ingreso', icon: <ArrowUpCircle className="h-3.5 w-3.5" />, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', sign: '+' }
    case 'cash_out':
    case 'egreso':
      return { label: 'Egreso / Gasto', icon: <ArrowDownCircle className="h-3.5 w-3.5" />, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', sign: '-' }
    default:
      return { label: type, icon: <History className="h-3.5 w-3.5" />, color: 'text-muted-foreground', bg: 'bg-muted/40 border-border/50', sign: '' }
  }
}

// ─── TIMELINE DE MOVIMIENTOS DENTRO DE UNA SESIÓN ───────────────────────────

function SessionTimeline({ movements }: { movements: CashMovement[] }) {
  const sorted = useMemo(() =>
    [...movements].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [movements]
  )

  const getMethodBadge = (m?: string) => {
    if (!m) return null
    const norm = m.toLowerCase()
    if (norm === 'cash' || norm === 'efectivo') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
          <Banknote className="h-3 w-3" /> Efectivo
        </span>
      )
    }
    if (norm === 'card' || norm === 'tarjeta') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
          <CreditCard className="h-3 w-3" /> Tarjeta
        </span>
      )
    }
    if (norm === 'transfer' || norm === 'transferencia' || norm === 'qr' || norm === 'sipap') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shrink-0">
          📱 QR / SIPAP
        </span>
      )
    }
    if (norm === 'mixed' || norm === 'mixto') {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0">
          🔄 Mixto
        </span>
      )
    }
    return null
  }

  if (sorted.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/60">
        Sin movimientos registrados en esta sesión de caja
      </div>
    )
  }

  return (
    <div className="relative pl-6 space-y-2.5">
      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border/60" />
      {sorted.map((m, i) => {
        const meta = movMeta(m.type)
        const t = fmt(m.created_at)
        const concept = formatEventConcept({
          action: m.type,
          details: m.reason,
          paymentMethod: m.payment_method,
          amount: m.amount,
          formatCurrencyFn: formatCurrency
        })
        const methodBadge = getMethodBadge(m.payment_method)

        return (
          <div key={m.id ?? i} className="relative group">
            <div className={`absolute -left-3.5 top-2 h-5 w-5 rounded-full border-2 border-background bg-card flex items-center justify-center ${meta.color} shadow-xs`}>
              <span className="scale-75">{meta.icon}</span>
            </div>
            <div className="ml-3 flex items-start justify-between gap-3 rounded-2xl border border-border/50 bg-card p-3 hover:bg-muted/30 transition-all shadow-2xs">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${meta.bg} ${meta.color}`}>
                    {meta.icon}
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                    <Clock className="h-3 w-3" />
                    {t.date} · {t.shortTime}
                  </span>
                  {methodBadge}
                </div>
                <p className="text-xs text-foreground font-medium leading-snug">{concept}</p>
                {m.reason && m.reason !== concept && (
                  <p className="text-[11px] text-muted-foreground italic">Nota: {m.reason}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className={`text-sm font-bold tabular-nums font-mono ${meta.color}`}>
                  {meta.sign}{formatCurrency(m.amount)}
                </span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── TARJETA DE SESIÓN DE CAJA ───────────────────────────────────────────────

function SessionCard({
  session,
  registers = [],
  currentUserDisplayName,
  onInspect
}: {
  session: ZClosureRecord
  registers?: Array<{ id: string; name: string }>
  currentUserDisplayName?: string
  onInspect: (session: ZClosureRecord) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isOpen = session.id === 'current'
  const diff = session.discrepancy
  const hasDiff = !isOpen && Math.abs(diff) >= 1
  const opened = fmt(session.openedAt)
  const closed = isOpen ? null : fmt(session.closedAt)
  const dur = isOpen ? 'En curso' : duration(session.openedAt, session.closedAt)

  const registerDisplayName = formatRegisterName(session.registerId, registers)
  const openedByDisplayName = formatUserLabel(session.openedBy, null, null, currentUserDisplayName)
  const closedByDisplayName = formatUserLabel(session.closedBy, null, null, currentUserDisplayName)
  const userInitial = (openedByDisplayName || 'O').charAt(0).toUpperCase()

  return (
    <div className={cn(
      "rounded-3xl border bg-card shadow-sm transition-all overflow-hidden",
      hasDiff
        ? "border-amber-300/80 dark:border-amber-800/60 shadow-amber-500/5"
        : isOpen
          ? "border-emerald-400/80 dark:border-emerald-700/60 shadow-emerald-500/5 ring-1 ring-emerald-400/20"
          : "border-border/70 hover:border-border"
    )}>
      {/* ── Cabecera de la sesión ── */}
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {/* Avatar / Icono */}
            <div className="h-10 w-10 rounded-2xl bg-primary/10 text-primary font-black text-sm flex items-center justify-center shrink-0 border border-primary/20 mt-0.5">
              {userInitial}
            </div>

            <div className="min-w-0 space-y-1.5">
              {/* Tiempos */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-xl border border-emerald-200 dark:border-emerald-900/60">
                  <DoorOpen className="h-3.5 w-3.5" />
                  Apertura: {opened.date} {opened.shortTime}
                </span>

                {closed ? (
                  <>
                    <span className="text-muted-foreground text-xs">→</span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl border border-rose-200 dark:border-rose-900/60">
                      <DoorClosed className="h-3.5 w-3.5" />
                      Cierre: {closed.date} {closed.shortTime}
                    </span>
                    <Badge variant="outline" className="text-[11px] gap-1 font-medium bg-muted/20">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {dur}
                    </Badge>
                  </>
                ) : (
                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] animate-pulse">
                    🟢 Turno en Curso
                  </Badge>
                )}
              </div>

              {/* Responsables y terminal */}
              <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                <span>Caja: <strong className="text-foreground">{registerDisplayName}</strong></span>
                {session.openedBy && <span>· Abrió: <strong className="text-foreground">{openedByDisplayName}</strong></span>}
                {!isOpen && session.closedBy && session.closedBy !== 'system' && (
                  <span>· Cerró: <strong className="text-foreground">{closedByDisplayName}</strong></span>
                )}
              </p>
            </div>
          </div>

          {/* Estadísticas de la derecha & Acciones */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
            {!isOpen && (
              <>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Ventas Turno</p>
                  <p className="text-sm font-extrabold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(session.totalSales)}
                  </p>
                </div>

                {hasDiff ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 shadow-2xs">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {diff > 0 ? '+' : ''}{formatCurrency(diff)} ({diff > 0 ? 'Sobrante' : 'Faltante'})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 shadow-2xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Caja Exacta
                  </span>
                )}

                {/* Botón Ver Ticket / Arqueo */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onInspect(session)}
                  className="h-8 gap-1.5 text-xs font-bold rounded-xl border-border/80 shadow-2xs hover:bg-muted"
                >
                  <Receipt className="h-3.5 w-3.5 text-primary" />
                  <span>Ticket / Arqueo</span>
                </Button>
              </>
            )}

            {/* Toggle Timeline */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(o => !o)}
              className="h-8 gap-1.5 text-xs font-semibold rounded-xl text-muted-foreground hover:text-foreground"
            >
              <span>{session.movementsCount} movs.</span>
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Resumen de totales de la sesión */}
        <div className="mt-3.5 pt-3 border-t border-border/40 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-2xl bg-muted/20">
            <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Fondo Inicial</span>
            <strong className="text-foreground font-mono tabular-nums">{formatCurrency(session.openingBalance)}</strong>
          </div>
          <div className="p-2.5 rounded-2xl bg-muted/20">
            <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 dark:text-blue-400 block">+ Entradas</span>
            <strong className="text-blue-700 dark:text-blue-400 font-mono tabular-nums">{formatCurrency(session.totalCashIn)}</strong>
          </div>
          <div className="p-2.5 rounded-2xl bg-muted/20">
            <span className="text-[10px] uppercase font-bold tracking-wider text-rose-600 dark:text-rose-400 block">- Salidas</span>
            <strong className="text-rose-700 dark:text-rose-400 font-mono tabular-nums">{formatCurrency(session.totalCashOut)}</strong>
          </div>
          <div className="p-2.5 rounded-2xl bg-muted/20">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400 block">Saldo Final</span>
            <strong className="text-foreground font-mono tabular-nums">{formatCurrency(session.closingBalance)}</strong>
          </div>
        </div>
      </div>

      {/* ── Timeline Desplegable ── */}
      {expanded && (
        <div className="border-t border-border/40 bg-muted/10 p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-primary" />
            Cronología de Movimientos del Turno
          </p>
          <SessionTimeline movements={session.movements} />
        </div>
      )}
    </div>
  )
}

// ─── GUÍA EXPLICATIVA: CÓMO FUNCIONA EL HISTORIAL ───────────────────────────

function HistoryHowItWorksDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-extrabold tracking-tight">
                ¿Cómo funciona el Historial de Sesiones?
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Guía completa sobre cierres Z, arqueos y control de discrepancias
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-3 text-xs text-muted-foreground leading-relaxed">
          {/* Card 1: Qué es una sesión */}
          <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-2">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <DoorOpen className="h-4 w-4 text-emerald-600" />
              <span>1. Ciclo de Turno: Apertura y Cierre Z</span>
            </div>
            <p>
              Una <strong>Sesión de Caja</strong> abarca todo el ciclo operativo de un cajero o turno:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Apertura:</strong> Se declara el fondo de cambio inicial asignado a la gaveta.</li>
              <li><strong>Operación:</strong> Se registran ventas (efectivo, tarjeta, QR), cobros, entradas y gastos.</li>
              <li><strong>Cierre Z Fiscal:</strong> El cajero cuenta el dinero físico, ingresa el arqueo y el sistema calcula automáticamente si el balance es exacto o si hay diferencias.</li>
            </ul>
          </div>

          {/* Card 2: Arqueo y Discrepancias */}
          <div className="p-4 rounded-2xl bg-card border border-border/60 space-y-2">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>2. Estados de Arqueo y Discrepancias</span>
            </div>
            <p>
              Al realizar el arqueo, el sistema compara el <strong>Saldo Esperado Teórico</strong> con el <strong>Dinero Físico Contado</strong>:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 block mb-0.5">🟢 Caja Exacta</span>
                <span>El dinero contado es 100% igual al saldo teórico (diferencia = Gs. 0).</span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <span className="font-bold text-amber-800 dark:text-amber-300 block mb-0.5">🟡 Con Discrepancia</span>
                <span>Existe un <strong>Sobrante (+)</strong> o un <strong>Faltante (-)</strong> que queda registrado para revisión pericial.</span>
              </div>
            </div>
          </div>

          {/* Card 3: Ejemplos Prácticos */}
          <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-2">
            <div className="flex items-center gap-2 text-foreground font-bold text-sm">
              <Receipt className="h-4 w-4 text-primary" />
              <span>3. Ejemplos Prácticos de Turnos</span>
            </div>
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-background border border-border/60 space-y-1">
                <span className="font-bold text-foreground block">Ejemplo A: Turno Regular sin Novedad</span>
                <p>
                  Fondo Inicial: <strong>Gs. 100.000</strong> + Ventas en Efectivo: <strong>Gs. 450.000</strong> = Saldo Esperado: <strong>Gs. 550.000</strong>.<br/>
                  El cajero cuenta Gs. 550.000 $\rightarrow$ Estado: <strong className="text-emerald-600">Caja Exacta</strong>.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-background border border-border/60 space-y-1">
                <span className="font-bold text-foreground block">Ejemplo B: Turno con Retiro / Gasto</span>
                <p>
                  Fondo: <strong>Gs. 200.000</strong> + Ventas: <strong>Gs. 300.000</strong> - Pago a Proveedor (Egreso): <strong>Gs. 80.000</strong> = Esperado: <strong>Gs. 420.000</strong>.<br/>
                  El cajero cuenta Gs. 420.000 $\rightarrow$ Estado: <strong className="text-emerald-600">Caja Exacta</strong>.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="rounded-xl w-full font-bold">
            Entendido, volver al Historial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const PAGE_SIZE = 15

// ─── PÁGINA PRINCIPAL DE HISTORIAL ──────────────────────────────────────────

export default function CashRegisterHistoryPage() {
  const { user } = useAuth()
  const { zClosureHistory, fetchZClosureHistory, checkPermission, registers, getCurrentRegister } = useCashRegisterContext()
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [period, setPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('week')
  const [status, setStatus] = useState<'all' | 'perfect' | 'with_diff' | 'open'>('all')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [selectedClosureForModal, setSelectedClosureForModal] = useState<ZClosureRecord | null>(null)

  const canAccess = user?.role === 'admin' || checkPermission('canViewReports')
  const canExport = checkPermission('canExportData')

  const userDisplayName = user?.profile?.name || (user?.user_metadata?.full_name as string) || (user?.user_metadata?.name as string) || user?.email?.split('@')[0] || ''

  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      await fetchZClosureHistory()
    } finally {
      setLoading(false)
    }
  }, [fetchZClosureHistory])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [search, period, status])

  // Todas las sesiones (Abierta en curso + Cerradas históricas)
  const reg = getCurrentRegister
  const allSessions: ZClosureRecord[] = useMemo(() => {
    const closed = [...zClosureHistory].sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
    if (reg.isOpen) {
      const movs = reg.movements || []
      const sales = movs.filter(m => m.type === 'sale' || (m.type as string) === 'venta')
      const movTotalSales = sales.reduce((s, m) => s + (Number(m.amount) || 0), 0)

      const salesByCash = sales.filter(s => s.payment_method === 'cash' || s.payment_method === 'efectivo' || !s.payment_method).reduce((s, m) => s + (Number(m.amount) || 0), 0)
      const salesByCard = sales.filter(s => s.payment_method === 'card' || s.payment_method === 'tarjeta').reduce((s, m) => s + (Number(m.amount) || 0), 0)
      const salesByTransfer = sales.filter(s => s.payment_method === 'transfer' || s.payment_method === 'transferencia' || s.payment_method === 'qr' || s.payment_method === 'sipap').reduce((s, m) => s + (Number(m.amount) || 0), 0)
      const salesByMixed = sales.filter(s => s.payment_method === 'mixed' || s.payment_method === 'mixto').reduce((s, m) => s + (Number(m.amount) || 0), 0)

      const movCashIn = movs.filter(m => m.type === 'cash_in' || (m.type as string) === 'ingreso').reduce((s, m) => s + (Number(m.amount) || 0), 0)
      const movCashOut = movs.filter(m => m.type === 'cash_out' || (m.type as string) === 'egreso').reduce((s, m) => s + (Number(m.amount) || 0), 0)

      const openingBal = (reg as any).opening_balance ?? (movs.find(m => m.type === 'opening')?.amount ?? 0)
      const totalSales = (reg as any).total_sales ?? (movTotalSales > 0 ? movTotalSales : (salesByCash + salesByCard + salesByTransfer + salesByMixed))
      const totalCashIn = (reg as any).total_cash_in ?? movCashIn
      const totalCashOut = (reg as any).total_cash_out ?? movCashOut
      const currentBalance = (reg as any).balance ?? (Number(openingBal) + Number(totalSales) + Number(totalCashIn) - Number(totalCashOut))

      const openRecord: ZClosureRecord = {
        id: 'current',
        registerId: reg.register_id || 'current',
        date: new Date().toISOString().split('T')[0],
        openedAt: reg.opened_at || new Date().toISOString(),
        closedAt: new Date().toISOString(),
        openingBalance: Number(openingBal) || 0,
        closingBalance: Number(currentBalance) || 0,
        expectedBalance: Number(currentBalance) || 0,
        discrepancy: 0,
        totalSales: Number(totalSales) || 0,
        totalCashIn: Number(totalCashIn) || 0,
        totalCashOut: Number(totalCashOut) || 0,
        salesByCash: Number(salesByCash) || 0,
        salesByCard: Number(salesByCard) || 0,
        salesByTransfer: Number(salesByTransfer) || 0,
        salesByMixed: Number(salesByMixed) || 0,
        movementsCount: movs.length,
        openedBy: reg.opened_by || userDisplayName,
        closedBy: 'En curso',
        status: 'open',
        notes: 'Turno actualmente activo',
        movements: movs
      }
      return [openRecord, ...closed]
    }
    return closed
  }, [zClosureHistory, reg, userDisplayName])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const now = new Date()
    let cutoff: Date | null = null
    if (period === 'today') { cutoff = new Date(now); cutoff.setHours(0, 0, 0, 0) }
    else if (period === 'week') { cutoff = new Date(now); cutoff.setDate(now.getDate() - 7) }
    else if (period === 'month') { cutoff = new Date(now); cutoff.setMonth(now.getMonth() - 1) }
    else if (period === 'year') { cutoff = new Date(now); cutoff.setFullYear(now.getFullYear() - 1) }

    return allSessions.filter(c => {
      if (cutoff && new Date(c.openedAt) < cutoff) return false
      if (status === 'perfect' && (c.id === 'current' || Math.abs(c.discrepancy) >= 1)) return false
      if (status === 'with_diff' && (c.id === 'current' || Math.abs(c.discrepancy) < 1)) return false
      if (status === 'open' && c.id !== 'current') return false
      if (!q) return true
      return `${c.registerId} ${c.closedBy} ${c.openedBy ?? ''} ${c.notes ?? ''} ${fmt(c.openedAt).date}`.toLowerCase().includes(q)
    })
  }, [allSessions, search, period, status])

  const summary = useMemo(() => {
    const total = filtered.length
    const perfect = filtered.filter(c => c.id !== 'current' && Math.abs(c.discrepancy) < 1).length
    const withDiff = filtered.filter(c => c.id !== 'current' && Math.abs(c.discrepancy) >= 1).length
    const sales = filtered.reduce((s, c) => s + c.totalSales, 0)

    const totalOver = filtered
      .filter(c => c.id !== 'current' && c.discrepancy > 0.5)
      .reduce((s, c) => s + c.discrepancy, 0)

    const totalShort = filtered
      .filter(c => c.id !== 'current' && c.discrepancy < -0.5)
      .reduce((s, c) => s + Math.abs(c.discrepancy), 0)

    const netDiscrepancy = filtered
      .filter(c => c.id !== 'current')
      .reduce((s, c) => s + (c.discrepancy || 0), 0)

    const closedSessions = filtered.filter(c => c.id !== 'current')
    const avgDur = closedSessions.length ? closedSessions.reduce((s, c) => {
      const ms = new Date(c.closedAt).getTime() - new Date(c.openedAt).getTime()
      return s + (ms > 0 ? ms : 0)
    }, 0) / closedSessions.length : 0
    const avgH = Math.floor(avgDur / 3600000)
    const avgM = Math.floor((avgDur % 3600000) / 60000)
    const avgDurStr = closedSessions.length ? (avgH > 0 ? `${avgH}h ${avgM}min` : `${avgM}min`) : '—'
    return { total, perfect, withDiff, sales, avgDurStr, totalOver, totalShort, netDiscrepancy }
  }, [filtered])

  const isNetOver = summary.netDiscrepancy > 0.5
  const isNetShort = summary.netDiscrepancy < -0.5

  const hasFilters = search || period !== 'all' || status !== 'all'

  const exportCsv = () => {
    if (!canExport) return

    downloadCsvReport({
      filename: `historial_cierres_caja_${new Date().toISOString().slice(0, 10)}`,
      title: 'Reporte de Historial de Sesiones y Cierres de Caja',
      subtitle: `Período: ${period === 'all' ? 'Todo el historial' : period === 'week' ? 'Últimos 7 días' : period === 'month' ? 'Último mes' : 'Último año'}`,
      generatedBy: userDisplayName,
      summaryStats: [
        { label: 'Total Sesiones Listadas:', value: filtered.length },
        { label: 'Sesiones Exactas (Sin Diferencia):', value: summary.perfect },
        { label: 'Sesiones con Descuadre:', value: summary.withDiff },
        { label: 'Diferencia Acumulada Neta:', value: isNetOver ? `+${formatCurrency(summary.netDiscrepancy)} (Sobrante Neto)` : isNetShort ? `-${formatCurrency(Math.abs(summary.netDiscrepancy))} (Faltante Neto)` : 'Gs. 0 (Exacta)' },
        { label: 'Total Sobrantes Acumulados:', value: `+${formatCurrency(summary.totalOver)}` },
        { label: 'Total Faltantes Acumulados:', value: `-${formatCurrency(summary.totalShort)}` },
        { label: 'Total Ventas Acumuladas:', value: formatCurrency(summary.sales) },
        { label: 'Duración Promedio por Turno:', value: summary.avgDurStr }
      ],
      headers: [
        'Fecha Apertura',
        'Hora Apertura',
        'Fecha Cierre',
        'Hora Cierre',
        'Duración',
        'Caja / Terminal',
        'Cajero Apertura',
        'Cajero Cierre',
        'Fondo Inicial (Gs.)',
        'Total Ventas (Gs.)',
        'Ingresos Manuales (Gs.)',
        'Egresos / Gastos (Gs.)',
        'Saldo Esperado (Gs.)',
        'Saldo Real Contado (Gs.)',
        'Diferencia (Gs.)',
        'Estado del Arqueo',
        'Total Movimientos',
        'Observaciones'
      ],
      rows: filtered.map(c => {
        const op = fmt(c.openedAt)
        const cl = c.id === 'current' ? null : fmt(c.closedAt)
        const dur = c.id === 'current' ? 'En curso' : duration(c.openedAt, c.closedAt)
        const statusLabel = c.id === 'current'
          ? 'Turno en Curso'
          : Math.abs(c.discrepancy) < 1
            ? 'Exacta (Sin diferencia)'
            : c.discrepancy > 0
              ? `Sobrante (+${formatCurrency(c.discrepancy)})`
              : `Faltante (${formatCurrency(c.discrepancy)})`

        return [
          op.date,
          op.time,
          cl ? cl.date : 'En curso',
          cl ? cl.time : 'En curso',
          dur,
          formatRegisterName(c.registerId, registers),
          formatUserLabel(c.openedBy, null, null, userDisplayName),
          formatUserLabel(c.closedBy, null, null, userDisplayName),
          c.openingBalance,
          c.totalSales,
          c.totalCashIn,
          c.totalCashOut,
          c.expectedBalance,
          c.closingBalance,
          c.discrepancy,
          statusLabel,
          c.movementsCount,
          c.notes || ''
        ]
      }),
      footerTotals: [
        'TOTALES GENERALES',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        filtered.reduce((sum, c) => sum + (c.openingBalance || 0), 0),
        filtered.reduce((sum, c) => sum + (c.totalSales || 0), 0),
        filtered.reduce((sum, c) => sum + (c.totalCashIn || 0), 0),
        filtered.reduce((sum, c) => sum + (c.totalCashOut || 0), 0),
        filtered.reduce((sum, c) => sum + (c.expectedBalance || 0), 0),
        filtered.reduce((sum, c) => sum + (c.closingBalance || 0), 0),
        filtered.reduce((sum, c) => sum + (c.discrepancy || 0), 0),
        '',
        filtered.reduce((sum, c) => sum + (c.movementsCount || 0), 0),
        ''
      ]
    })
  }

  const exportPdf = async () => {
    if (!canExport) return

    const openSessions = filtered.filter(s => s.id === 'current')
    const closedSessions = filtered.filter(s => s.id !== 'current')

    const sections: any[] = []

    // 1. SECCIÓN DE CAJAS CON TURNO ABIERTO (EN VIVO)
    if (openSessions.length > 0) {
      sections.push({
        title: '🟢 1. Cajas con Turno Abierto / En Curso (En Vivo)',
        description: 'Cajas activas actualmente operando en mostrador con balance y recaudación en tiempo real.',
        headers: [
          'Caja / Terminal',
          'Fecha y Hora Apertura',
          'Cajero Responsable',
          'Fondo Inicial',
          'Ventas Efectivo',
          'Ventas Tarjeta / QR',
          'Total Ventas Turno',
          'Entradas (+)',
          'Salidas (-)',
          'Saldo Teórico en Gaveta',
          'Estado'
        ],
        rows: openSessions.map(s => {
          const op = fmt(s.openedAt)
          const salesCash = s.salesByCash || s.movements?.filter(m => m.type === 'sale' && (!m.payment_method || m.payment_method === 'cash' || m.payment_method === 'efectivo')).reduce((sum, m) => sum + m.amount, 0) || 0
          const salesDigital = (s.totalSales || 0) - salesCash
          const currentDrawer = (s.openingBalance || 0) + (s.totalSales || 0) + (s.totalCashIn || 0) - (s.totalCashOut || 0)

          return [
            formatRegisterName(s.registerId, registers),
            `${op.date} ${op.time}`,
            formatUserLabel(s.openedBy, null, null, userDisplayName),
            formatCurrency(s.openingBalance),
            formatCurrency(salesCash),
            formatCurrency(salesDigital),
            formatCurrency(s.totalSales),
            formatCurrency(s.totalCashIn),
            formatCurrency(s.totalCashOut),
            formatCurrency(currentDrawer),
            'Turno en Curso'
          ]
        }),
        columnStyles: {
          0: { cellWidth: 75 },
          1: { cellWidth: 80, halign: 'center' },
          2: { cellWidth: 80 },
          3: { cellWidth: 65, halign: 'right' },
          4: { cellWidth: 65, halign: 'right' },
          5: { cellWidth: 70, halign: 'right' },
          6: { cellWidth: 70, halign: 'right' },
          7: { cellWidth: 60, halign: 'right' },
          8: { cellWidth: 60, halign: 'right' },
          9: { cellWidth: 75, halign: 'right' },
          10: { cellWidth: 75, halign: 'center' }
        }
      })
    }

    // 2. SECCIÓN DE HISTORIAL DE TURNOS CERRADOS
    sections.push({
      title: openSessions.length > 0 ? '🔴 2. Historial de Turnos Cerrados y Arqueos Z' : '🔴 Historial de Turnos Cerrados y Arqueos Z',
      description: 'Auditoría pericial de turnos finalizados, arqueos físicos contados y control de discrepancias.',
      headers: [
        'Caja',
        'Apertura',
        'Cajero Abre',
        'Fondo Inicial',
        'Vtas. Efectivo',
        'Vtas. Tarjeta/QR',
        'Total Ventas',
        'Entradas',
        'Salidas',
        'Cierre Z',
        'Cajero Cierra',
        'Físico Contado',
        'Descuadre',
        'Estado'
      ],
      rows: closedSessions.map(c => {
        const op = fmt(c.openedAt)
        const cl = fmt(c.closedAt)
        const salesCash = c.salesByCash || c.movements?.filter(m => m.type === 'sale' && (!m.payment_method || m.payment_method === 'cash' || m.payment_method === 'efectivo')).reduce((sum, m) => sum + m.amount, 0) || 0
        const salesDigital = (c.totalSales || 0) - salesCash
        const statusLabel = Math.abs(c.discrepancy) < 1
          ? 'Caja Exacta'
          : c.discrepancy > 0
            ? `Sobrante (+${formatCurrency(c.discrepancy)})`
            : `Faltante (${formatCurrency(c.discrepancy)})`

        return [
          formatRegisterName(c.registerId, registers),
          `${op.date}\n${op.shortTime}`,
          formatUserLabel(c.openedBy, null, null, userDisplayName),
          formatCurrency(c.openingBalance),
          formatCurrency(salesCash),
          formatCurrency(salesDigital),
          formatCurrency(c.totalSales),
          formatCurrency(c.totalCashIn),
          formatCurrency(c.totalCashOut),
          `${cl.date}\n${cl.shortTime}`,
          formatUserLabel(c.closedBy, null, null, userDisplayName),
          formatCurrency(c.closingBalance),
          c.discrepancy > 0 ? `+${formatCurrency(c.discrepancy)}` : formatCurrency(c.discrepancy),
          statusLabel
        ]
      }),
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 58, halign: 'center' },
        2: { cellWidth: 62 },
        3: { cellWidth: 52, halign: 'right' },
        4: { cellWidth: 55, halign: 'right' },
        5: { cellWidth: 55, halign: 'right' },
        6: { cellWidth: 58, halign: 'right' },
        7: { cellWidth: 48, halign: 'right' },
        8: { cellWidth: 48, halign: 'right' },
        9: { cellWidth: 58, halign: 'center' },
        10: { cellWidth: 62 },
        11: { cellWidth: 55, halign: 'right' },
        12: { cellWidth: 55, halign: 'right' },
        13: { cellWidth: 62, halign: 'center' }
      }
    })

    await downloadPdfReport({
      filename: `historial_cierres_caja_${new Date().toISOString().slice(0, 10)}`,
      title: 'Historial de Sesiones y Cierres de Caja',
      subtitle: `Período: ${period === 'all' ? 'Todo el historial' : period === 'week' ? 'Últimos 7 días' : period === 'month' ? 'Último mes' : 'Último año'}`,
      generatedBy: userDisplayName,
      orientation: 'landscape',
      summaryStats: [
        { label: 'Sesiones Listadas', value: filtered.length },
        { label: 'Cajas Exactas', value: summary.perfect },
        { label: 'Con Descuadre', value: summary.withDiff },
        { label: 'Ventas Totales', value: formatCurrency(summary.sales) },
        { label: 'Duración Promedio', value: summary.avgDurStr }
      ],
      sections
    })
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
            <Button variant="outline" className="gap-2 rounded-xl"><ArrowLeft className="h-4 w-4" />Volver a Caja</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-5 animate-in fade-in duration-300 max-w-7xl mx-auto">
      {/* ── 1. Header con Botón de ¿Cómo Funciona? ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/pos/caja">
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-extrabold tracking-tight">Historial de Sesiones de Caja</h1>
              <Badge variant="secondary" className="tabular-nums font-bold">{summary.total}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 ml-7">
              Aperturas, arqueos finales y auditoría de turnos cerrados
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHowItWorks(true)}
            className="h-9 gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 text-xs font-semibold rounded-xl"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span>¿Cómo funciona?</span>
          </Button>

          <Link href="/dashboard/pos/caja/auditoria">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold rounded-xl">
              <Shield className="h-3.5 w-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Auditoría Pericial</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={loadHistory}
            disabled={loading}
            className="h-9 gap-1.5 rounded-xl text-xs font-semibold"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportPdf}
            disabled={filtered.length === 0}
            className="h-9 gap-1.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border-red-200 dark:border-red-800/80 shadow-2xs"
          >
            <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span>Descargar PDF</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="h-9 gap-1.5 rounded-xl text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar CSV</span>
          </Button>
        </div>
      </div>

      {/* ── 2. Cards de Resumen KPI ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="rounded-2xl border border-border/70 bg-card shadow-xs">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sesiones Totales</p>
            <p className="text-2xl font-black tabular-nums mt-1">{summary.total}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">En el período</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 shadow-xs">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Sin Diferencia</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">{summary.perfect}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Arqueos exactos</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-amber-500/20 bg-amber-500/5 shadow-xs">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Con Descuadre</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums mt-1">{summary.withDiff}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{summary.totalOver > 0 && summary.totalShort > 0 ? 'Sobrantes y faltantes' : summary.totalOver > 0 ? 'Sobrantes' : summary.totalShort > 0 ? 'Faltantes' : 'Turnos con variación'}</p>
          </CardContent>
        </Card>

        <Card
          className={`rounded-2xl border shadow-xs transition-colors ${
            isNetShort
              ? 'border-rose-500/30 bg-rose-500/5'
              : isNetOver
              ? 'border-amber-500/30 bg-amber-500/5'
              : 'border-emerald-500/30 bg-emerald-500/5'
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-foreground">Dif. Acumulada</p>
              <span
                className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                  isNetShort
                    ? 'bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300'
                    : isNetOver
                    ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                    : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {isNetShort ? 'Faltante' : isNetOver ? 'Sobrante' : 'Exacto'}
              </span>
            </div>

            <p
              className={`text-lg sm:text-xl font-black mt-1 font-mono tabular-nums ${
                isNetShort
                  ? 'text-rose-600 dark:text-rose-400'
                  : isNetOver
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {isNetOver ? `+${formatCurrency(summary.netDiscrepancy)}` : isNetShort ? `-${formatCurrency(Math.abs(summary.netDiscrepancy))}` : 'Gs. 0'}
            </p>

            <div className="mt-0.5 text-[10px] text-muted-foreground truncate">
              {summary.totalOver > 0 && summary.totalShort > 0 ? (
                <span>▲ +{formatCurrency(summary.totalOver)} | ▼ -{formatCurrency(summary.totalShort)}</span>
              ) : summary.totalOver > 0 ? (
                <span className="text-amber-600 dark:text-amber-400">▲ Todo en sobrante</span>
              ) : summary.totalShort > 0 ? (
                <span className="text-rose-600 dark:text-rose-400">▼ Todo en faltante</span>
              ) : (
                <span>Totalmente cuadrado</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-violet-500/20 bg-violet-500/5 shadow-xs">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700 dark:text-violet-400">Ventas Acumuladas</p>
            <p className="text-lg sm:text-xl font-black text-foreground font-mono tabular-nums mt-1">
              {formatCurrency(summary.sales)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Total recaudado</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/70 bg-card shadow-xs col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Duración Promedio</p>
            <p className="text-2xl font-black tabular-nums mt-1">{summary.avgDurStr}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Por turno</p>
          </CardContent>
        </Card>
      </div>

      {/* ── 3. Barra de Filtros ── */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Filter className="h-3.5 w-3.5 text-primary" /> Filtros de Búsqueda
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSearch(''); setPeriod('all'); setStatus('all') }}
              className="h-7 px-2.5 text-xs gap-1 font-semibold text-muted-foreground hover:text-foreground rounded-lg"
            >
              <X className="h-3.5 w-3.5" /> Limpiar filtros
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por caja, cajero, fecha…"
              className="pl-8 h-9 text-xs bg-background rounded-xl"
            />
          </div>

          <Select value={period} onValueChange={v => setPeriod(v as typeof period)}>
            <SelectTrigger className="h-9 text-xs bg-background rounded-xl">
              <Clock className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">📅 Hoy (Turno actual)</SelectItem>
              <SelectItem value="week">📅 Esta Semana (Últimos 7 días)</SelectItem>
              <SelectItem value="month">📅 Este Mes (Últimos 30 días)</SelectItem>
              <SelectItem value="year">📅 Este Año (Últimos 365 días)</SelectItem>
              <SelectItem value="all">📅 Todo el Historial</SelectItem>
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={v => setStatus(v as typeof status)}>
            <SelectTrigger className="h-9 text-xs bg-background rounded-xl">
              <Shield className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
              <SelectValue placeholder="Estado de Arqueo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las sesiones</SelectItem>
              <SelectItem value="open">🟢 Turno en curso</SelectItem>
              <SelectItem value="perfect">✓ Solo exactas (sin diferencia)</SelectItem>
              <SelectItem value="with_diff">⚠️ Solo con descuadre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── 4. Listado de Sesiones ── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-3xl border border-border/60 bg-card p-5 space-y-3">
              <Skeleton className="h-5 w-2/3 rounded-lg" />
              <Skeleton className="h-3 w-1/2 rounded-lg" />
              <div className="flex gap-4 pt-2">
                <Skeleton className="h-4 w-20 rounded-lg" />
                <Skeleton className="h-4 w-24 rounded-lg" />
                <Skeleton className="h-4 w-20 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3 rounded-3xl border border-dashed border-border/70 bg-card text-center">
          <div className="p-5 bg-muted/40 rounded-full">
            <History className="h-10 w-10 opacity-30" />
          </div>
          <p className="font-semibold text-sm">
            {hasFilters ? 'No se encontraron sesiones para los filtros aplicados' : 'No hay sesiones registradas aún'}
          </p>
          {hasFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setSearch(''); setPeriod('all'); setStatus('all') }}
              className="gap-1.5 rounded-xl font-bold text-xs"
            >
              <X className="h-3.5 w-3.5" /> Limpiar filtros
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3.5">
            {filtered.slice(0, visibleCount).map(s => (
              <SessionCard
                key={s.id}
                session={s}
                registers={registers}
                currentUserDisplayName={userDisplayName}
                onInspect={closure => setSelectedClosureForModal(closure)}
              />
            ))}
          </div>

          {visibleCount < filtered.length ? (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">
                Mostrando <strong className="text-foreground">{Math.min(visibleCount, filtered.length)}</strong> de <strong className="text-foreground">{filtered.length}</strong> sesiones
              </span>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 rounded-xl font-bold text-xs"
                onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
              >
                Cargar {Math.min(PAGE_SIZE, filtered.length - visibleCount)} más
              </Button>
            </div>
          ) : filtered.length > PAGE_SIZE && (
            <p className="text-xs text-center text-muted-foreground pt-2">
              Todas las {filtered.length} sesiones cargadas
            </p>
          )}
        </>
      )}

      {/* ── 5. Modal ¿Cómo funciona? ── */}
      <HistoryHowItWorksDialog
        open={showHowItWorks}
        onOpenChange={setShowHowItWorks}
      />

      {/* ── 6. Modal de Detalle de Cierre Z e Impresión Térmica ── */}
      <ZClosureDetailsModal
        isOpen={!!selectedClosureForModal}
        onClose={() => setSelectedClosureForModal(null)}
        closure={selectedClosureForModal}
      />
    </div>
  )
}
