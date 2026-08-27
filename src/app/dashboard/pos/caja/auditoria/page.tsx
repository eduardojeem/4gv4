'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { useCashRegisterContext, ZClosureRecord, AuditLogEntry } from '../../contexts/CashRegisterContext'
import { CashMovement } from '@/hooks/useCashRegister'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  DoorClosed,
  DoorOpen,
  Eye,
  Filter,
  History,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  HelpCircle,
  Layers,
  FileText,
  User,
  Banknote,
  Copy,
  Check,
  CreditCard,
  Receipt,
  X
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { CashRegisterState } from '../../types'
import { cn } from '@/lib/utils'
import { formatRegisterName, formatUserLabel, formatEventConcept } from '@/app/dashboard/pos/lib/formatters'
import { downloadCsvReport } from '@/app/dashboard/pos/lib/exportCsv'
import { downloadPdfReport } from '@/app/dashboard/pos/lib/exportPdf'

// ─── UTILS DE FECHA Y FORMATO ───────────────────────────────────────────────

function fmt(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return { date: '—', time: '—', full: '—' }
  }
  return {
    date: d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    full: d.toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' })
  }
}

function duration(a: string, b: string) {
  const ms = new Date(b).getTime() - new Date(a).getTime()
  if (ms < 0 || Number.isNaN(ms)) return '—'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}h ${m}min` : `${m}min`
}

type MovMeta = { label: string; icon: React.ReactNode; color: string; sign: string; bg: string }

function movMeta(type: CashMovement['type']): MovMeta {
  switch (type) {
    case 'opening':
      return {
        label: 'Apertura',
        icon: <DoorOpen className="h-3.5 w-3.5" />,
        color: 'text-emerald-700 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60',
        sign: '+'
      }
    case 'closing':
      return {
        label: 'Cierre',
        icon: <DoorClosed className="h-3.5 w-3.5" />,
        color: 'text-rose-700 dark:text-rose-400',
        bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60',
        sign: ''
      }
    case 'sale':
      return {
        label: 'Venta',
        icon: <ShoppingCart className="h-3.5 w-3.5" />,
        color: 'text-violet-700 dark:text-violet-400',
        bg: 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900/60',
        sign: '+'
      }
    case 'cash_in':
      return {
        label: 'Entrada',
        icon: <ArrowUpCircle className="h-3.5 w-3.5" />,
        color: 'text-blue-700 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60',
        sign: '+'
      }
    case 'cash_out':
      return {
        label: 'Salida',
        icon: <ArrowDownCircle className="h-3.5 w-3.5" />,
        color: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60',
        sign: '-'
      }
    default:
      return {
        label: type,
        icon: <Activity className="h-3.5 w-3.5" />,
        color: 'text-muted-foreground',
        bg: 'bg-muted/40 border-border/50',
        sign: ''
      }
  }
}

function getEventMeta(action: string): MovMeta {
  const norm = (action || '').toLowerCase().replace(/_/g, ' ')
  if (norm.includes('open') || norm.includes('apertur')) {
    return {
      label: 'Apertura de Turno',
      icon: <DoorOpen className="h-3.5 w-3.5" />,
      color: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60',
      sign: '+'
    }
  }
  if (norm.includes('z closure') || norm.includes('cierre z')) {
    return {
      label: 'Cierre Z Fiscal',
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
      color: 'text-purple-700 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/60',
      sign: ''
    }
  }
  if (norm.includes('clos') || norm.includes('cierre')) {
    return {
      label: 'Cierre de Turno',
      icon: <DoorClosed className="h-3.5 w-3.5" />,
      color: 'text-rose-700 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60',
      sign: ''
    }
  }
  if (norm.includes('sale') || norm.includes('venta')) {
    return {
      label: 'Venta Registrada',
      icon: <ShoppingCart className="h-3.5 w-3.5" />,
      color: 'text-violet-700 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-900/60',
      sign: '+'
    }
  }
  if (norm.includes('cash in') || norm.includes('ingreso') || norm.includes('entrad')) {
    return {
      label: 'Ingreso Manual',
      icon: <ArrowUpCircle className="h-3.5 w-3.5" />,
      color: 'text-blue-700 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60',
      sign: '+'
    }
  }
  if (norm.includes('cash out') || norm.includes('egreso') || norm.includes('salid') || norm.includes('retiro')) {
    return {
      label: 'Egreso / Retiro',
      icon: <ArrowDownCircle className="h-3.5 w-3.5" />,
      color: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60',
      sign: '-'
    }
  }
  return {
    label: action || 'Evento de Sistema',
    icon: <Activity className="h-3.5 w-3.5" />,
    color: 'text-muted-foreground',
    bg: 'bg-muted/40 border-border/50',
    sign: ''
  }
}

function EventDetailCell({
  entry,
  concept
}: {
  entry: AuditLogEntry
  concept: string
}) {
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

  const parts = concept.split('•').map(p => p.trim())
  const title = parts[0] || 'Operación de caja'
  const subtitle = parts.slice(1).join(' • ')
  const methodBadge = getMethodBadge(entry.paymentMethod)

  return (
    <div className="flex flex-col gap-0.5 py-0.5 min-w-0 max-w-full">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="font-semibold text-foreground text-xs leading-tight">
          {title}
        </span>
        {methodBadge}
      </div>
      {subtitle && !methodBadge && (
        <span className="text-[11px] text-muted-foreground line-clamp-1">
          {subtitle}
        </span>
      )}
    </div>
  )
}

function EventInspectDialog({
  event,
  open,
  onOpenChange,
  registers = [],
  currentUserDisplayName
}: {
  event: AuditLogEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  registers?: Array<{ id: string; name: string }>
  currentUserDisplayName?: string
}) {
  const [copied, setCopied] = useState(false)
  if (!event) return null
  const meta = getEventMeta(event.action)
  const t = fmt(event.timestamp)
  const userDisplayName = formatUserLabel(event.userName, event.userEmail, event.userId, currentUserDisplayName)
  const registerDisplayName = formatRegisterName(event.registerId, registers)
  const formattedConcept = formatEventConcept({
    action: event.action,
    details: event.details,
    paymentMethod: event.paymentMethod,
    amount: event.amount,
    formatCurrencyFn: formatCurrency
  })

  const handleCopyId = () => {
    if (!event?.id) return
    navigator.clipboard.writeText(event.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getMethodDisplay = (m?: string) => {
    if (!m) return { label: 'Efectivo / Estándar', icon: <Banknote className="h-3.5 w-3.5 text-emerald-500" /> }
    const norm = m.toLowerCase()
    if (norm === 'cash' || norm === 'efectivo') return { label: 'Efectivo en Caja', icon: <Banknote className="h-3.5 w-3.5 text-emerald-500" /> }
    if (norm === 'card' || norm === 'tarjeta') return { label: 'Tarjeta Débito / Crédito', icon: <CreditCard className="h-3.5 w-3.5 text-blue-500" /> }
    if (norm === 'transfer' || norm === 'transferencia' || norm === 'qr' || norm === 'sipap') return { label: 'Transferencia / QR SIPAP', icon: <span className="text-xs">📱</span> }
    if (norm === 'mixed' || norm === 'mixto') return { label: 'Pago Combinado / Mixto', icon: <span className="text-xs">🔄</span> }
    return { label: m.toUpperCase(), icon: <CreditCard className="h-3.5 w-3.5 text-primary" /> }
  }

  const methodInfo = getMethodDisplay(event.paymentMethod)
  const userInitial = userDisplayName.charAt(0).toUpperCase()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-[calc(100vw-2rem)] sm:w-full max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl border-border/80 shadow-2xl bg-card">
        {/* Header Modal */}
        <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-border/50 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className={cn("h-11 w-11 rounded-2xl border flex items-center justify-center shadow-xs shrink-0", meta.bg, meta.color)}>
              {meta.icon}
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground truncate">
                Detalle de la Operación
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground truncate">
                Trazabilidad inmutable e irrepudiable en caja
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto px-5 sm:px-6 py-4 space-y-3.5 max-h-[65vh]">
          {/* Hero Banner: Action Badge & Impact */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-muted/40 via-card to-muted/20 border border-border/70 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
                Tipo de Registro
              </span>
              <Badge variant="outline" className={cn("gap-1.5 font-bold text-xs py-1 px-2.5 rounded-xl shadow-xs", meta.bg, meta.color)}>
                {meta.icon}
                <span className="truncate">{meta.label}</span>
              </Badge>
            </div>

            {event.amount !== undefined && event.amount > 0 ? (
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                  Monto Involucrado
                </span>
                <p className={cn("text-lg sm:text-xl font-extrabold font-mono tracking-tight", meta.color)}>
                  {meta.sign}{formatCurrency(event.amount)}
                </p>
              </div>
            ) : (
              <div className="text-right shrink-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-0.5">
                  Impacto
                </span>
                <span className="text-xs font-semibold text-muted-foreground">Informativo</span>
              </div>
            )}
          </div>

          {/* Cuadrícula 2x2 de Actores y Terminales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {/* Usuario / Operador */}
            <div className="p-3 rounded-2xl bg-background border border-border/60 shadow-xs flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary font-black text-sm flex items-center justify-center shrink-0 border border-primary/20">
                {userInitial}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Usuario / Operador
                </span>
                <p className="font-bold text-foreground truncate text-xs sm:text-sm">
                  {userDisplayName}
                </p>
                {event.userEmail && event.userEmail !== userDisplayName && (
                  <p className="text-[10px] text-muted-foreground truncate">{event.userEmail}</p>
                )}
              </div>
            </div>

            {/* Caja / Terminal */}
            <div className="p-3 rounded-2xl bg-background border border-border/60 shadow-xs flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0 border border-border/60">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Caja Registradora
                </span>
                <p className="font-bold text-foreground truncate text-xs sm:text-sm">
                  {registerDisplayName}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">Terminal asignada</p>
              </div>
            </div>

            {/* Fecha y Hora */}
            <div className="p-3 rounded-2xl bg-background border border-border/60 shadow-xs flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0 border border-border/60">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Momento Exacto
                </span>
                <p className="font-bold text-foreground text-xs">
                  {t.date}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">{t.time}</p>
              </div>
            </div>

            {/* Forma de Pago */}
            <div className="p-3 rounded-2xl bg-background border border-border/60 shadow-xs flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-muted text-muted-foreground flex items-center justify-center shrink-0 border border-border/60">
                {methodInfo.icon}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Método de Pago
                </span>
                <p className="font-bold text-foreground truncate text-xs">
                  {methodInfo.label}
                </p>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Procesado</p>
              </div>
            </div>
          </div>

          {/* Tarjeta de Concepto y Motivo */}
          <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Concepto y Justificación
            </span>
            <p className="text-xs sm:text-sm text-foreground font-semibold leading-relaxed">
              {formattedConcept}
            </p>
            {event.details && event.details !== formattedConcept && (
              <p className="text-[11px] text-muted-foreground pt-1.5 border-t border-border/40">
                <strong className="text-foreground/70">Observación original:</strong> {event.details}
              </p>
            )}
          </div>

          {/* UUID de Transacción / Auditoría */}
          <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-muted/15 border border-border/40 text-[10px] sm:text-[11px] font-mono text-muted-foreground">
            <span className="truncate">Hash: {event.id}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyId}
              className="h-6 px-2 text-[10px] gap-1 font-semibold rounded-lg shrink-0 hover:bg-muted"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3 text-emerald-600" />
                  <span className="text-emerald-600">Copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  <span>Copiar ID</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Footer Modal */}
        <div className="p-4 sm:p-5 border-t border-border/50 bg-muted/10 flex items-center justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-xl px-5 font-bold text-xs h-9 w-full sm:w-auto"
          >
            Cerrar Detalle
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function typeFilterMatch(type: CashMovement['type'], filter: string) {
  if (filter === 'all') return true
  return type === filter
}

// ─── TIMELINE DE MOVIMIENTOS DENTRO DE UNA SESIÓN ───────────────────────────

function SessionTimeline({ movements, typeFilter }: { movements: CashMovement[]; typeFilter: string }) {
  const sorted = useMemo(() =>
    [...movements]
      .filter(m => typeFilterMatch(m.type, typeFilter))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [movements, typeFilter]
  )

  if (sorted.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground bg-muted/10 rounded-xl border border-dashed border-border/60">
        Sin movimientos registrados para el filtro seleccionado
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

        return (
          <div key={m.id ?? i} className="relative group">
            <div className={`absolute -left-3.5 top-2 h-5 w-5 rounded-full border-2 border-background bg-card flex items-center justify-center ${meta.color} shadow-xs`}>
              <span className="scale-75">{meta.icon}</span>
            </div>
            <div className="ml-3 flex items-start justify-between gap-3 rounded-xl border border-border/50 bg-card p-3 hover:bg-muted/30 transition-all shadow-2xs">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${meta.bg} ${meta.color}`}>
                    {meta.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {t.date} · {t.time}
                  </span>
                  {m.payment_method && (
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                      {m.payment_method}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-foreground font-medium leading-snug">{concept}</p>
                {m.reason && m.reason !== concept && (
                  <p className="text-[11px] text-muted-foreground italic">Nota: {m.reason}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className={`text-sm font-bold tabular-nums ${meta.color}`}>
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

function SessionCard({ session, typeFilter, isOpen, registers = [], currentUserDisplayName }: { session: ZClosureRecord; typeFilter: string; isOpen?: boolean; registers?: Array<{ id: string; name: string }>; currentUserDisplayName?: string }) {
  const [expanded, setExpanded] = useState(false)
  const diff = session.discrepancy
  const hasDiff = !isOpen && Math.abs(diff) >= 1
  const opened = fmt(session.openedAt)
  const closed = isOpen ? null : fmt(session.closedAt)

  const registerDisplayName = formatRegisterName(session.registerId, registers)
  const openedByDisplayName = formatUserLabel(session.openedBy, null, null, currentUserDisplayName)
  const closedByDisplayName = formatUserLabel(session.closedBy, null, null, currentUserDisplayName)

  return (
    <div className={cn(
      "rounded-2xl border bg-card shadow-sm transition-all overflow-hidden",
      hasDiff
        ? "border-amber-300/80 dark:border-amber-800/60 shadow-amber-500/5"
        : isOpen
          ? "border-emerald-400/80 dark:border-emerald-700/60 shadow-emerald-500/5 ring-1 ring-emerald-400/20"
          : "border-border/70 hover:border-border"
    )}>
      <button
        type="button"
        onClick={() => setExpanded(o => !o)}
        className="w-full text-left p-4 sm:p-5 hover:bg-muted/20 transition-colors"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-1 h-7 w-7 rounded-xl bg-muted/60 flex items-center justify-center text-muted-foreground shrink-0 transition-transform group-hover:scale-105">
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
            
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-900/60">
                  <DoorOpen className="h-3.5 w-3.5" />
                  Apertura: {opened.date} {opened.time}
                </span>

                {closed ? (
                  <>
                    <span className="text-muted-foreground text-xs">→</span>
                    <span className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60">
                      <DoorClosed className="h-3.5 w-3.5" />
                      Cierre: {closed.date} {closed.time}
                    </span>
                    <Badge variant="outline" className="text-[11px] gap-1 font-medium bg-background">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      {duration(session.openedAt, session.closedAt)}
                    </Badge>
                  </>
                ) : (
                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] animate-pulse">
                    🟢 Turno en Curso
                  </Badge>
                )}
              </div>

              <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                <span>Caja: <strong className="text-foreground">{registerDisplayName}</strong></span>
                {session.openedBy && <span>· Abrió: <strong className="text-foreground">{openedByDisplayName}</strong></span>}
                {!isOpen && session.closedBy && session.closedBy !== 'system' && (
                  <span>· Cerró: <strong className="text-foreground">{closedByDisplayName}</strong></span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
            {!isOpen && (
              <>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Ventas Turno</p>
                  <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(session.totalSales)}
                  </p>
                </div>

                {hasDiff ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {diff > 0 ? '+' : ''}{formatCurrency(diff)} ({diff > 0 ? 'Sobrante' : 'Faltante'})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Caja Exacta
                  </span>
                )}
              </>
            )}
            <Badge variant="secondary" className="tabular-nums text-xs font-bold px-2.5 py-1 rounded-lg">
              {session.movementsCount} movs.
            </Badge>
          </div>
        </div>

        {/* Resumen de totales de la sesión */}
        <div className="mt-3.5 pt-3 border-t border-border/40 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2 rounded-xl bg-muted/20">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Fondo Apertura</span>
            <strong className="text-foreground tabular-nums">{formatCurrency(session.openingBalance)}</strong>
          </div>
          <div className="p-2 rounded-xl bg-muted/20">
            <span className="text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 block">+ Entradas</span>
            <strong className="text-blue-700 dark:text-blue-400 tabular-nums">{formatCurrency(session.totalCashIn)}</strong>
          </div>
          <div className="p-2 rounded-xl bg-muted/20">
            <span className="text-[10px] uppercase tracking-wider text-rose-600 dark:text-rose-400 block">- Salidas</span>
            <strong className="text-rose-700 dark:text-rose-400 tabular-nums">{formatCurrency(session.totalCashOut)}</strong>
          </div>
          <div className="p-2 rounded-xl bg-muted/20">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">Saldo Cierre</span>
            <strong className="text-foreground tabular-nums">
              {isOpen ? 'En curso' : formatCurrency(session.closingBalance)}
            </strong>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/60 bg-muted/10 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Timeline de la Sesión ({session.movements.filter(m => typeFilterMatch(m.type, typeFilter)).length} eventos)
            </h4>
            <span className="text-[11px] text-muted-foreground">Orden cronológico</span>
          </div>
          <SessionTimeline movements={session.movements} typeFilter={typeFilter} />
        </div>
      )}
    </div>
  )
}

// ─── KPI CARD ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, color }: { label: string; value: string | number; icon?: React.ReactNode; color?: string }) {
  return (
    <Card className={cn("border shadow-sm rounded-2xl overflow-hidden", color || "border-border/60 bg-card")}>
      <CardContent className="p-4 sm:p-5 space-y-1">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
          {icon}
        </div>
        <p className="text-2xl font-bold tracking-tight tabular-nums text-foreground">{value}</p>
      </CardContent>
    </Card>
  )
}

// ─── MODAL DE AYUDA / GUÍA DE AUDITORÍA CON EJEMPLOS ─────────────────────────

function AuditHowItWorksDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[92vh] p-0 overflow-hidden rounded-3xl border-border shadow-2xl flex flex-col">
        
        {/* Cabecera */}
        <div className="bg-gradient-to-br from-indigo-700 via-blue-700 to-slate-900 p-6 text-white text-left relative shrink-0 overflow-hidden">
          <div className="absolute top-0 right-0 w-36 h-36 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md text-white shadow-inner">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <Badge className="bg-white/20 text-white border-0 text-[10px] font-bold uppercase tracking-wider">
                Módulo de Control Forense
              </Badge>
              <DialogTitle className="text-xl font-bold text-white tracking-tight mt-0.5">
                ¿Cómo funciona la Auditoría de Caja?
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-blue-100 text-xs leading-relaxed max-w-xl">
            La auditoría garantiza la total trazabilidad del dinero mediante el registro automático e inmutable de cada turno, arqueo y movimiento de efectivo.
          </DialogDescription>
        </div>

        {/* Contenido con Scroll */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 text-left">
          
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Niveles de Inspección y Seguridad
            </h4>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="p-3.5 rounded-2xl border border-border/60 bg-muted/20 space-y-1">
                <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <DoorOpen className="h-3.5 w-3.5 text-blue-600" />
                  1. Auditoría por Sesión
                </h5>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Evalúa turnos completos: quién abrió la caja, a qué hora cerró, cuánto se vendió y si hubo descuadres de arqueo.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl border border-border/60 bg-muted/20 space-y-1">
                <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5 text-indigo-600" />
                  2. Bitácora Atómica (Log)
                </h5>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Registra segundo a segundo cada ingreso, egreso, venta o modificación con usuario responsable y motivo.
                </p>
              </div>
            </div>
          </div>

          {/* 3 Casos Prácticos de Negocio */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Banknote className="h-4 w-4 text-emerald-600" />
              Casos Prácticos y Ejemplos de Uso
            </h4>

            {/* Caso 1 */}
            <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/20 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                Caso 1 · Detección de Faltante en Cierre Z (-20.000 Gs.)
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong>Situación:</strong> El cajero finaliza el turno con saldo esperado de 850.000 Gs., pero declara físicamente 830.000 Gs.
              </p>
              <div className="p-2 rounded-xl bg-background/80 border border-amber-200/60 dark:border-amber-900/40 text-[11px] font-mono text-amber-950 dark:text-amber-100">
                Auditoría marca la sesión con badge rojo (-20.000 Gs.) y permite al supervisor revisar el timeline de egresos y notas del cajero.
              </div>
            </div>

            {/* Caso 2 */}
            <div className="p-3.5 rounded-2xl border border-blue-200 bg-blue-50/40 dark:border-blue-900/40 dark:bg-blue-950/20 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                Caso 2 · Retiro no Planificado de Caja (Pago a Proveedor)
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong>Situación:</strong> El administrador nota una salida de 150.000 Gs. a las 15:30.
              </p>
              <div className="p-2 rounded-xl bg-background/80 border border-blue-200/60 dark:border-blue-900/40 text-[11px] font-mono text-blue-950 dark:text-blue-100">
                En la Bitácora busca "150.000" y visualiza: Usuario "carlos@taller.com" · Motivo: "Factura repuestos N° 8492" · Timestamp exacto.
              </div>
            </div>

            {/* Caso 3 */}
            <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/40 dark:border-emerald-900/40 dark:bg-emerald-950/20 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Caso 3 · Conciliación de Ventas Digitales vs. Efectivo
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong>Situación:</strong> Las ventas fueron de 4.000.000 Gs., pero el cajón solo tiene 1.500.000 Gs.
              </p>
              <div className="p-2 rounded-xl bg-background/80 border border-emerald-200/60 dark:border-emerald-900/40 text-[11px] font-mono text-emerald-950 dark:text-emerald-100">
                El timeline de la sesión demuestra que 2.500.000 Gs. fueron cobrados con Tarjeta POS y QR, validando el cuadre exacto.
              </div>
            </div>
          </div>

          {/* Tip de Seguridad */}
          <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-border/70 flex items-start gap-2.5">
            <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="text-[11px] text-muted-foreground leading-snug">
              <strong className="text-foreground">Inmutabilidad:</strong> Los registros de auditoría no pueden ser eliminados ni editados manualmente, protegiendo la integridad financiera de tu negocio.
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-muted/20 border-t border-border/50 sm:justify-end shrink-0">
          <Button
            type="button"
            className="rounded-xl text-xs font-bold px-6 shadow-md"
            onClick={() => onOpenChange(false)}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── CONVERSIÓN DE SESIÓN ABIERTA A RECORD ───────────────────────────────────

function openSessionToRecord(reg: CashRegisterState, currentUserName?: string): ZClosureRecord {
  const movs = reg.movements || []
  const sales = movs.filter(m => m.type === 'sale' || (m.type as string) === 'venta')
  const movTotalSales = sales.reduce((s, m) => s + (Number(m.amount) || 0), 0)

  const salesByCash = sales.filter(s => s.payment_method === 'cash' || s.payment_method === 'efectivo' || !s.payment_method).reduce((s, m) => s + (Number(m.amount) || 0), 0)
  const salesByCard = sales.filter(s => s.payment_method === 'card' || s.payment_method === 'tarjeta').reduce((s, m) => s + (Number(m.amount) || 0), 0)
  const salesByTransfer = sales.filter(s => s.payment_method === 'transfer' || s.payment_method === 'transferencia' || s.payment_method === 'qr' || s.payment_method === 'sipap').reduce((s, m) => s + (Number(m.amount) || 0), 0)
  const salesByMixed = sales.filter(s => s.payment_method === 'mixed' || s.payment_method === 'mixto').reduce((s, m) => s + (Number(m.amount) || 0), 0)

  const movCashIn = movs.filter(m => m.type === 'cash_in' || (m.type as string) === 'ingreso').reduce((s, m) => s + (Number(m.amount) || 0), 0)
  const movCashOut = movs.filter(m => m.type === 'cash_out' || (m.type as string) === 'egreso').reduce((s, m) => s + (Number(m.amount) || 0), 0)

  const openingBal = (reg as any).opening_balance ?? (reg.movements.find(m => m.type === 'opening' || (m.type as string) === 'apertura')?.amount ?? 0)
  const totalSales = (reg as any).total_sales ?? (movTotalSales > 0 ? movTotalSales : (salesByCash + salesByCard + salesByTransfer + salesByMixed))
  const totalCashIn = (reg as any).total_cash_in ?? movCashIn
  const totalCashOut = (reg as any).total_cash_out ?? movCashOut
  const currentBalance = (reg as any).balance ?? (Number(openingBal) + Number(totalSales) + Number(totalCashIn) - Number(totalCashOut))

  return {
    id: 'current',
    registerId: (reg as any).register_id || 'Caja actual',
    date: new Date().toISOString().split('T')[0],
    openedAt: (reg as any).opened_at || reg.movements.find(m => m.type === 'opening')?.created_at || new Date().toISOString(),
    openedBy: (reg as any).opened_by || currentUserName || 'Operador en turno',
    openingBalance: Number(openingBal) || 0,
    closedAt: new Date().toISOString(),
    closedBy: 'En curso',
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
    movements: movs as CashMovement[]
  }
}

const PAGE_SIZE = 10

// ─── COMPONENTE PRINCIPAL ───────────────────────────────────────────────────

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
  const [discrepancyFilter, setDiscrepancyFilter] = useState<'all' | 'perfect' | 'discrepancy' | 'open'>('all')
  const [period, setPeriod] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('week')
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [activeTab, setActiveTab] = useState<'sessions' | 'log'>('sessions')
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<AuditLogEntry | null>(null)

  const canAccess = user?.role === 'admin' || checkPermission('canViewAuditLog')
  const canExport = checkPermission('canExportData')

  const userDisplayName = user?.profile?.name || (user?.user_metadata?.full_name as string) || (user?.user_metadata?.name as string) || user?.email?.split('@')[0] || 'Operador'

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([fetchAuditLog(), fetchZClosureHistory()])
    } finally {
      setLoading(false)
    }
  }, [fetchAuditLog, fetchZClosureHistory])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setVisibleCount(PAGE_SIZE)
  }, [search, typeFilter, discrepancyFilter, period, activeTab])

  // Sesiones de caja (Abierta + Cerradas)
  const reg = getCurrentRegister
  const allSessions: ZClosureRecord[] = useMemo(() => {
    const closed = [...zClosureHistory].sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
    if (reg.isOpen) return [openSessionToRecord(reg, userDisplayName), ...closed]
    return closed
  }, [zClosureHistory, reg, userDisplayName])

  const hasFilters = search || typeFilter !== 'all' || discrepancyFilter !== 'all' || period !== 'all'

  const filteredSessions = useMemo(() => {
    const q = search.trim().toLowerCase()
    const now = new Date()
    let cutoff: Date | null = null
    if (period === 'today') { cutoff = new Date(now); cutoff.setHours(0, 0, 0, 0) }
    else if (period === 'week') { cutoff = new Date(now); cutoff.setDate(now.getDate() - 7) }
    else if (period === 'month') { cutoff = new Date(now); cutoff.setMonth(now.getMonth() - 1) }
    else if (period === 'year') { cutoff = new Date(now); cutoff.setFullYear(now.getFullYear() - 1) }

    return allSessions.filter(s => {
      // Filtro de período
      if (cutoff && new Date(s.openedAt) < cutoff) return false
      
      // Filtro de tipo de movimiento dentro de la sesión
      if (typeFilter !== 'all' && !s.movements.some(m => m.type === typeFilter)) return false
      
      // Filtro de estado de arqueo
      if (discrepancyFilter === 'perfect' && (s.id === 'current' || Math.abs(s.discrepancy) >= 1)) return false
      if (discrepancyFilter === 'discrepancy' && (s.id === 'current' || Math.abs(s.discrepancy) < 1)) return false
      if (discrepancyFilter === 'open' && s.id !== 'current') return false

      // Búsqueda por texto
      if (!q) return true
      return `${s.registerId} ${s.openedBy ?? ''} ${s.closedBy}`.toLowerCase().includes(q)
    })
  }, [allSessions, search, typeFilter, discrepancyFilter, period])

  // Bitácora atómica de eventos filtrada
  const filteredLog = useMemo(() => {
    const q = search.trim().toLowerCase()
    const now = new Date()
    let cutoff: Date | null = null
    if (period === 'today') { cutoff = new Date(now); cutoff.setHours(0, 0, 0, 0) }
    else if (period === 'week') { cutoff = new Date(now); cutoff.setDate(now.getDate() - 7) }
    else if (period === 'month') { cutoff = new Date(now); cutoff.setMonth(now.getMonth() - 1) }
    else if (period === 'year') { cutoff = new Date(now); cutoff.setFullYear(now.getFullYear() - 1) }

    return auditLog
      .filter(e => {
        // Filtro de período
        if (cutoff && new Date(e.timestamp) < cutoff) return false

        // Filtro de tipo de acción
        if (typeFilter !== 'all') {
          const act = (e.action || '').toLowerCase()
          const tf = typeFilter.toLowerCase()
          if (tf === 'opening' && !act.includes('open') && !act.includes('apertur')) return false
          if (tf === 'closing' && !act.includes('clos') && !act.includes('cierre') && !act.includes('z_closure')) return false
          if (tf === 'sale' && !act.includes('sale') && !act.includes('venta')) return false
          if (tf === 'cash_in' && !act.includes('cash_in') && !act.includes('ingreso') && !act.includes('entrad')) return false
          if (tf === 'cash_out' && !act.includes('cash_out') && !act.includes('egreso') && !act.includes('salid') && !act.includes('retiro')) return false
        }

        if (!q) return true
        return `${e.action} ${e.details} ${e.userName || ''}`.toLowerCase().includes(q)
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [auditLog, search, typeFilter, period])

  // Métricas KPI de Bitácora
  const logStats = useMemo(() => {
    let salesCount = 0
    let salesTotal = 0
    let cashInCount = 0
    let cashInTotal = 0
    let cashOutCount = 0
    let cashOutTotal = 0

    filteredLog.forEach(entry => {
      const act = (entry.action || '').toLowerCase()
      const amt = Number(entry.amount) || 0
      if (act.includes('sale') || act.includes('venta')) {
        salesCount++
        salesTotal += amt
      } else if (act.includes('cash_in') || act.includes('ingreso') || act.includes('entrada')) {
        cashInCount++
        cashInTotal += amt
      } else if (act.includes('cash_out') || act.includes('egreso') || act.includes('salida') || act.includes('retiro')) {
        cashOutCount++
        cashOutTotal += amt
      }
    })

    return {
      total: filteredLog.length,
      salesCount,
      salesTotal,
      cashInCount,
      cashInTotal,
      cashOutCount,
      cashOutTotal
    }
  }, [filteredLog])

  // Métricas KPI
  const kpis = useMemo(() => {
    const total = zClosureHistory.length
    const open = reg.isOpen ? 1 : 0
    const perfect = zClosureHistory.filter(s => Math.abs(s.discrepancy) < 1).length
    const sales = zClosureHistory.reduce((s, c) => s + c.totalSales, 0)
    return { total, open, perfect, withDiff: total - perfect, sales }
  }, [zClosureHistory, reg.isOpen])

  // Exportar CSV profesional
  const exportCsv = () => {
    if (!canExport) return

    if (activeTab === 'sessions') {
      downloadCsvReport({
        filename: `auditoria_sesiones_caja_${new Date().toISOString().slice(0, 10)}`,
        title: 'Reporte Pericial de Auditoría - Sesiones y Arqueos de Caja',
        subtitle: `Período: ${period === 'all' ? 'Historial Completo' : period === 'week' ? 'Últimos 7 días' : period === 'month' ? 'Último mes' : 'Último año'}`,
        generatedBy: userDisplayName,
        summaryStats: [
          { label: 'Total Sesiones Evaluadas:', value: filteredSessions.length },
          { label: 'Sesiones Exactas (Sin Descuadre):', value: kpis.perfect },
          { label: 'Sesiones con Descuadre Registrado:', value: kpis.withDiff },
          { label: 'Total Ventas en el Período:', value: formatCurrency(kpis.sales) }
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
          'Egresos / Retiros (Gs.)',
          'Saldo Esperado (Gs.)',
          'Saldo Real Contado (Gs.)',
          'Diferencia (Gs.)',
          'Estado del Arqueo',
          'Total Movimientos',
          'Observaciones'
        ],
        rows: filteredSessions.map(s => {
          const op = fmt(s.openedAt)
          const cl = s.id === 'current' ? null : fmt(s.closedAt)
          const dur = s.id === 'current' ? 'En curso' : duration(s.openedAt, s.closedAt)
          const statusLabel = s.id === 'current'
            ? 'Turno en Curso'
            : Math.abs(s.discrepancy) < 1
              ? 'Exacta (Sin diferencia)'
              : s.discrepancy > 0
                ? `Sobrante (+${formatCurrency(s.discrepancy)})`
                : `Faltante (${formatCurrency(s.discrepancy)})`

          return [
            op.date,
            op.time,
            cl ? cl.date : 'En curso',
            cl ? cl.time : 'En curso',
            dur,
            formatRegisterName(s.registerId, registers),
            formatUserLabel(s.openedBy, null, null, userDisplayName),
            formatUserLabel(s.closedBy, null, null, userDisplayName),
            s.openingBalance,
            s.totalSales,
            s.totalCashIn,
            s.totalCashOut,
            s.expectedBalance,
            s.closingBalance,
            s.discrepancy,
            statusLabel,
            s.movementsCount,
            s.notes || ''
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
          filteredSessions.reduce((sum, s) => sum + (s.openingBalance || 0), 0),
          filteredSessions.reduce((sum, s) => sum + (s.totalSales || 0), 0),
          filteredSessions.reduce((sum, s) => sum + (s.totalCashIn || 0), 0),
          filteredSessions.reduce((sum, s) => sum + (s.totalCashOut || 0), 0),
          filteredSessions.reduce((sum, s) => sum + (s.expectedBalance || 0), 0),
          filteredSessions.reduce((sum, s) => sum + (s.closingBalance || 0), 0),
          filteredSessions.reduce((sum, s) => sum + (s.discrepancy || 0), 0),
          '',
          filteredSessions.reduce((sum, s) => sum + (s.movementsCount || 0), 0),
          ''
        ]
      })
    } else {
      downloadCsvReport({
        filename: `bitacora_eventos_caja_${new Date().toISOString().slice(0, 10)}`,
        title: 'Bitácora Inmutable de Eventos y Movimientos de Caja',
        subtitle: `Tipo de Evento: ${typeFilter === 'all' ? 'Todos los eventos' : typeFilter}`,
        generatedBy: userDisplayName,
        summaryStats: [
          { label: 'Total Eventos Registrados:', value: logStats.total },
          { label: 'Total Ventas Registradas:', value: `${logStats.salesCount} ops. (${formatCurrency(logStats.salesTotal)})` },
          { label: 'Total Ingresos Manuales:', value: `${logStats.cashInCount} ops. (${formatCurrency(logStats.cashInTotal)})` },
          { label: 'Total Egresos / Gastos:', value: `${logStats.cashOutCount} ops. (-${formatCurrency(logStats.cashOutTotal)})` }
        ],
        headers: [
          'Fecha',
          'Hora',
          'Tipo de Evento',
          'Usuario / Responsable',
          'Caja / Terminal',
          'Monto Involucrado (Gs.)',
          'Forma de Pago',
          'Concepto y Justificación',
          'Referencia / Glosa Original',
          'ID de Auditoría / Transacción'
        ],
        rows: filteredLog.map(e => {
          const t = fmt(e.timestamp)
          const concept = formatEventConcept({
            action: e.action,
            details: e.details,
            paymentMethod: e.paymentMethod,
            amount: e.amount,
            formatCurrencyFn: formatCurrency
          })
          const meta = getEventMeta(e.action)

          return [
            t.date,
            t.time,
            meta.label,
            formatUserLabel(e.userName, e.userEmail, e.userId, userDisplayName),
            formatRegisterName(e.registerId, registers),
            e.amount || 0,
            e.paymentMethod ? e.paymentMethod.toUpperCase() : 'EFECTIVO / ESTÁNDAR',
            concept,
            e.details || '',
            e.id
          ]
        }),
        footerTotals: [
          'TOTAL EN EL PERÍODO',
          '',
          '',
          '',
          '',
          filteredLog.reduce((sum, e) => sum + (e.amount || 0), 0),
          '',
          '',
          '',
          ''
        ]
      })
    }
  }

  // Exportar PDF profesional
  const exportPdf = async () => {
    if (!canExport) return

    if (activeTab === 'sessions') {
      const openSessions = filteredSessions.filter(s => s.id === 'current')
      const closedSessions = filteredSessions.filter(s => s.id !== 'current')

      const sections: any[] = []

      // 1. SECCIÓN DE CAJAS ABIERTAS (SI EXISTEN)
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
        rows: closedSessions.map(s => {
          const op = fmt(s.openedAt)
          const cl = fmt(s.closedAt)
          const salesCash = s.salesByCash || s.movements?.filter(m => m.type === 'sale' && (!m.payment_method || m.payment_method === 'cash' || m.payment_method === 'efectivo')).reduce((sum, m) => sum + m.amount, 0) || 0
          const salesDigital = (s.totalSales || 0) - salesCash
          const statusLabel = Math.abs(s.discrepancy) < 1
            ? 'Caja Exacta'
            : s.discrepancy > 0
              ? `Sobrante (+${formatCurrency(s.discrepancy)})`
              : `Faltante (${formatCurrency(s.discrepancy)})`

          return [
            formatRegisterName(s.registerId, registers),
            `${op.date}\n${op.time}`,
            formatUserLabel(s.openedBy, null, null, userDisplayName),
            formatCurrency(s.openingBalance),
            formatCurrency(salesCash),
            formatCurrency(salesDigital),
            formatCurrency(s.totalSales),
            formatCurrency(s.totalCashIn),
            formatCurrency(s.totalCashOut),
            `${cl.date}\n${cl.time}`,
            formatUserLabel(s.closedBy, null, null, userDisplayName),
            formatCurrency(s.closingBalance),
            s.discrepancy > 0 ? `+${formatCurrency(s.discrepancy)}` : formatCurrency(s.discrepancy),
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
        filename: `auditoria_sesiones_caja_${new Date().toISOString().slice(0, 10)}`,
        title: 'Reporte Pericial de Auditoría - Sesiones y Arqueos de Caja',
        subtitle: `Período: ${period === 'all' ? 'Historial Completo' : period === 'week' ? 'Últimos 7 días' : period === 'month' ? 'Último mes' : 'Último año'}`,
        generatedBy: userDisplayName,
        orientation: 'landscape',
        summaryStats: [
          { label: 'Sesiones Evaluadas', value: filteredSessions.length },
          { label: 'Cajas Exactas', value: kpis.perfect },
          { label: 'Con Descuadre', value: kpis.withDiff },
          { label: 'Total Ventas Auditadas', value: formatCurrency(kpis.sales) }
        ],
        sections
      })
    } else {
      await downloadPdfReport({
        filename: `bitacora_eventos_caja_${new Date().toISOString().slice(0, 10)}`,
        title: 'Bitácora Inmutable de Eventos y Movimientos',
        subtitle: `Filtro: ${typeFilter === 'all' ? 'Todos los eventos' : typeFilter}`,
        generatedBy: userDisplayName,
        orientation: 'landscape',
        summaryStats: [
          { label: 'Eventos Totales', value: logStats.total },
          { label: 'Ventas Registradas', value: `${logStats.salesCount} ops. (${formatCurrency(logStats.salesTotal)})` },
          { label: 'Ingresos Manuales', value: `${logStats.cashInCount} ops. (${formatCurrency(logStats.cashInTotal)})` },
          { label: 'Egresos / Gastos', value: `${logStats.cashOutCount} ops. (-${formatCurrency(logStats.cashOutTotal)})` }
        ],
        headers: [
          'Fecha / Hora',
          'Tipo de Evento',
          'Responsable',
          'Caja / Terminal',
          'Monto Registrado',
          'Método de Pago',
          'Concepto / Justificación de Auditoría'
        ],
        rows: filteredLog.map(e => {
          const t = fmt(e.timestamp)
          const concept = formatEventConcept({
            action: e.action,
            details: e.details,
            paymentMethod: e.paymentMethod,
            amount: e.amount,
            formatCurrencyFn: formatCurrency
          })
          
          let eventTypeLabel = e.action
          if (e.action === 'opening') eventTypeLabel = '🟢 APERTURA'
          else if (e.action === 'closing') eventTypeLabel = '🔴 CIERRE Z'
          else if (e.action === 'sale') eventTypeLabel = '🟣 VENTA'
          else if (e.action === 'cash_in') eventTypeLabel = '🔵 INGRESO'
          else if (e.action === 'cash_out') eventTypeLabel = '🟠 EGRESO'

          return [
            `${t.date} ${t.time}`,
            eventTypeLabel,
            formatUserLabel(e.userName, e.userEmail, e.userId, userDisplayName),
            formatRegisterName(e.registerId, registers),
            formatCurrency(e.amount || 0),
            e.paymentMethod ? e.paymentMethod.toUpperCase() : 'EFECTIVO',
            concept
          ]
        }),
        columnStyles: {
          0: { cellWidth: 75, halign: 'center' },
          1: { cellWidth: 70, halign: 'center' },
          2: { cellWidth: 85 },
          3: { cellWidth: 70 },
          4: { cellWidth: 70, halign: 'right' },
          5: { cellWidth: 65, halign: 'center' }
        }
      })
    }
  }

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-3xl bg-rose-100 dark:bg-rose-950/30 flex items-center justify-center">
            <Shield className="h-8 w-8 text-rose-600 dark:text-rose-400" />
          </div>
          <h1 className="text-lg font-bold">Acceso Restringido</h1>
          <p className="text-sm text-muted-foreground">No tienes permisos de administrador para consultar la auditoría de caja.</p>
          <Link href="/dashboard/pos/caja">
            <Button variant="outline" className="gap-2 rounded-xl">
              <ArrowLeft className="h-4 w-4" />
              Volver a Caja
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* ── 1. HEADER CON HERO AUDITORÍA ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/dashboard/pos/caja"
              className="p-1 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-xl sm:2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Auditoría y Trazabilidad de Caja
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground pl-6 sm:pl-7">
            Control pericial, bitácora de eventos y análisis de discrepancias por turno.
          </p>
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

          <Button
            variant="outline"
            size="sm"
            onClick={exportPdf}
            disabled={loading || (activeTab === 'sessions' ? filteredSessions.length === 0 : filteredLog.length === 0)}
            className="h-9 gap-1.5 rounded-xl text-xs font-bold text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border-red-200 dark:border-red-800/80 shadow-2xs"
          >
            <FileText className="h-4 w-4 text-red-600 dark:text-red-400" />
            <span>Descargar PDF</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={loading || (activeTab === 'sessions' ? filteredSessions.length === 0 : filteredLog.length === 0)}
            className="h-9 gap-1.5 rounded-xl text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exportar CSV</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="h-9 gap-1.5 rounded-xl text-xs font-semibold"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span>Actualizar</span>
          </Button>
        </div>
      </div>

      {/* ── 2. CARDS DE RESUMEN KPI (HERO AUDIT) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="rounded-2xl border border-border/70 shadow-sm bg-card">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sesiones Registradas</p>
              <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{kpis.total}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {kpis.open > 0 ? '🟢 1 turno abierto' : 'Todos cerrados'}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <History className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/70 shadow-sm bg-card">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sesiones Exactas</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                {kpis.perfect}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {kpis.total > 0 ? `${Math.round((kpis.perfect / kpis.total) * 100)}% de efectividad` : '0%'}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/70 shadow-sm bg-card">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Con Descuadre</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                {kpis.withDiff}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {kpis.withDiff === 0 ? 'Sin incidentes' : 'Requiere revisión'}
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border border-border/70 shadow-sm bg-card">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ventas Auditadas</p>
              <p className="text-lg sm:text-xl font-bold text-foreground mt-1 tabular-nums">
                {formatCurrency(kpis.sales)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Volumen histórico
              </p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center text-violet-600 dark:bg-violet-400 shrink-0">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 3. SELECTOR DE VISTA DUAL + FILTROS ── */}
      <div className="space-y-3">
        {/* Selector de Pestaña Dual (Sesiones vs Bitácora) */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border/60 pb-3">
          <div className="flex items-center gap-2 p-1 bg-muted/40 rounded-xl border border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab('sessions')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                activeTab === 'sessions'
                  ? "bg-card text-foreground shadow-sm border border-border/70"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Sesiones y Arqueos ({filteredSessions.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('log')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                activeTab === 'log'
                  ? "bg-card text-foreground shadow-sm border border-border/70"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Bitácora de Eventos ({filteredLog.length})</span>
            </button>
          </div>

          <span className="text-xs text-muted-foreground hidden sm:block">
            {activeTab === 'sessions' ? 'Arqueos y discrepancias por turno' : 'Trazabilidad atómica de movimientos y acciones'}
          </span>
        </div>

        {/* Barra de Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Búsqueda */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por usuario, caja, detalle..."
              className="pl-8 text-xs rounded-xl h-9 bg-card"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Filtro de período */}
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="h-9 text-xs rounded-xl bg-card">
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

          {/* Filtro de tipo de movimiento */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-9 text-xs rounded-xl bg-card">
              <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
              <SelectValue placeholder="Tipo de movimiento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="opening">Aperturas</SelectItem>
              <SelectItem value="sale">Ventas</SelectItem>
              <SelectItem value="cash_in">Ingresos</SelectItem>
              <SelectItem value="cash_out">Egresos / Gastos</SelectItem>
              <SelectItem value="closing">Cierres Z</SelectItem>
            </SelectContent>
          </Select>

          {/* Filtro específico de discrepancia (solo en sesiones) */}
          {activeTab === 'sessions' ? (
            <Select value={discrepancyFilter} onValueChange={(v: any) => setDiscrepancyFilter(v)}>
              <SelectTrigger className="h-9 text-xs rounded-xl bg-card">
                <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
                <SelectValue placeholder="Cuadre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las sesiones</SelectItem>
                <SelectItem value="perfect">Solo exactas (sin diferencia)</SelectItem>
                <SelectItem value="discrepancy">Solo con descuadre</SelectItem>
                <SelectItem value="open">Solo turno en curso</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center justify-end">
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearch('')
                    setTypeFilter('all')
                    setDiscrepancyFilter('all')
                    setPeriod('all')
                  }}
                  className="text-xs h-9 text-muted-foreground hover:text-foreground rounded-xl w-full"
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Limpiar filtros
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── 4. CONTENIDO PRINCIPAL: VISTA DUAL ── */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : activeTab === 'sessions' ? (
        /* VISTA 1: SESIONES Y ARQUEOS */
        filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl border border-dashed border-border/70 bg-card text-center">
            <div className="p-4 bg-muted/40 rounded-full text-muted-foreground">
              <ShieldAlert className="h-8 w-8 opacity-40" />
            </div>
            <p className="font-semibold text-sm">
              {hasFilters ? 'No hay sesiones para los filtros aplicados' : 'No hay sesiones registradas aún'}
            </p>
            {hasFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('')
                  setTypeFilter('all')
                  setDiscrepancyFilter('all')
                  setPeriod('all')
                }}
                className="rounded-xl text-xs font-bold"
              >
                Limpiar filtros
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSessions.slice(0, visibleCount).map(s => (
              <SessionCard key={s.id} session={s} typeFilter={typeFilter} isOpen={s.id === 'current'} registers={registers} currentUserDisplayName={userDisplayName} />
            ))}

            {visibleCount < filteredSessions.length ? (
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                  Mostrando <strong className="text-foreground">{Math.min(visibleCount, filteredSessions.length)}</strong> de <strong className="text-foreground">{filteredSessions.length}</strong> sesiones
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                  className="rounded-xl font-bold text-xs"
                >
                  Cargar {Math.min(PAGE_SIZE, filteredSessions.length - visibleCount)} más
                </Button>
              </div>
            ) : filteredSessions.length > PAGE_SIZE && (
              <p className="text-xs text-center text-muted-foreground pt-2">
                Todas las {filteredSessions.length} sesiones cargadas
              </p>
            )}
          </div>
        )
      ) : (
        /* VISTA 2: BITÁCORA DE EVENTOS (ENRIQUECIDA CON KPI RIBBON Y ACCIONES) */
        <div className="space-y-4">
          {/* Mini Ribbon de Totales de Bitácora */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-card border border-border/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Eventos</span>
                <span className="text-base font-extrabold text-foreground">{logStats.total}</span>
              </div>
              <Activity className="h-4 w-4 text-primary/70" />
            </div>

            <div className="p-3 rounded-xl bg-card border border-border/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-violet-600 dark:text-violet-400 block">Ventas ({logStats.salesCount})</span>
                <span className="text-sm font-bold text-foreground font-mono">{formatCurrency(logStats.salesTotal)}</span>
              </div>
              <ShoppingCart className="h-4 w-4 text-violet-500" />
            </div>

            <div className="p-3 rounded-xl bg-card border border-border/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-600 dark:text-blue-400 block">Ingresos ({logStats.cashInCount})</span>
                <span className="text-sm font-bold text-foreground font-mono">{formatCurrency(logStats.cashInTotal)}</span>
              </div>
              <ArrowUpCircle className="h-4 w-4 text-blue-500" />
            </div>

            <div className="p-3 rounded-xl bg-card border border-border/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block">Egresos ({logStats.cashOutCount})</span>
                <span className="text-sm font-bold text-foreground font-mono">-{formatCurrency(logStats.cashOutTotal)}</span>
              </div>
              <ArrowDownCircle className="h-4 w-4 text-amber-500" />
            </div>
          </div>

          {filteredLog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 rounded-2xl border border-dashed border-border/70 bg-card text-center">
              <div className="p-4 bg-muted/40 rounded-full text-muted-foreground">
                <ShieldAlert className="h-8 w-8 opacity-40" />
              </div>
              <p className="font-semibold text-sm">
                No hay eventos en la bitácora para los criterios de búsqueda
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm">
              <div className="hidden lg:grid grid-cols-[1.3fr_1.3fr_1.2fr_1fr_1.2fr_2fr_auto] gap-3 border-b border-border/50 bg-muted/30 px-4 py-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <span>Momento</span>
                <span>Evento</span>
                <span>Usuario</span>
                <span>Caja</span>
                <span>Monto</span>
                <span>Concepto y Detalle</span>
                <span className="text-right">Inspeccionar</span>
              </div>
              
              <div className="divide-y divide-border/40">
                {filteredLog.slice(0, visibleCount).map((entry, idx) => {
                  const t = fmt(entry.timestamp)
                  const userDisplayNameFormatted = formatUserLabel(entry.userName, entry.userEmail, entry.userId, userDisplayName)
                  const registerDisplayName = formatRegisterName(entry.registerId, registers)
                  const meta = getEventMeta(entry.action)
                  const concept = formatEventConcept({
                    action: entry.action,
                    details: entry.details,
                    paymentMethod: entry.paymentMethod,
                    amount: entry.amount,
                    formatCurrencyFn: formatCurrency
                  })

                  return (
                    <div
                      key={idx}
                      onClick={() => setSelectedEvent(entry)}
                      className="p-4 lg:px-4 lg:py-3.5 grid grid-cols-1 lg:grid-cols-[1.3fr_1.3fr_1.2fr_1fr_1.2fr_2fr_auto] gap-2 lg:items-center hover:bg-muted/20 transition-colors text-xs cursor-pointer group"
                    >
                      {/* Fecha y Hora */}
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="font-mono text-[11px]">{t.date} · {t.time}</span>
                      </div>

                      {/* Evento con Badge Temático */}
                      <div>
                        <Badge variant="outline" className={cn("text-[11px] font-bold gap-1 py-0.5 px-2", meta.bg, meta.color)}>
                          {meta.icon}
                          {meta.label}
                        </Badge>
                      </div>

                      {/* Usuario */}
                      <div className="flex items-center gap-1.5 text-foreground font-semibold truncate">
                        <User className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="truncate">{userDisplayNameFormatted}</span>
                      </div>

                      {/* Caja */}
                      <div className="text-muted-foreground truncate flex items-center gap-1">
                        <Shield className="h-3 w-3 text-muted-foreground/70 shrink-0" />
                        <span className="truncate">{registerDisplayName}</span>
                      </div>

                      {/* Monto Económico */}
                      <div className="font-mono font-bold">
                        {entry.amount !== undefined && entry.amount > 0 ? (
                          <span className={meta.color}>
                            {meta.sign}{formatCurrency(entry.amount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </div>

                      {/* Detalles / Concepto Enriquecido */}
                      <div className="text-foreground/90 font-medium">
                        <EventDetailCell entry={entry} concept={concept} />
                      </div>

                      {/* Botón Inspeccionar */}
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedEvent(entry)
                          }}
                          className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-foreground group-hover:bg-muted/50"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {visibleCount < filteredLog.length ? (
                <div className="p-4 border-t border-border/50 flex items-center justify-between bg-muted/10">
                  <span className="text-xs text-muted-foreground">
                    Mostrando <strong className="text-foreground">{Math.min(visibleCount, filteredLog.length)}</strong> de <strong className="text-foreground">{filteredLog.length}</strong> eventos
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                    className="rounded-xl font-bold text-xs"
                  >
                    Cargar {Math.min(PAGE_SIZE, filteredLog.length - visibleCount)} más
                  </Button>
                </div>
              ) : filteredLog.length > PAGE_SIZE && (
                <div className="p-3 border-t border-border/50 text-center bg-muted/10 text-xs text-muted-foreground">
                  Todos los {filteredLog.length} eventos cargados
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 5. NOTA DE SEGURIDAD AL PIE ── */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-3.5 rounded-2xl bg-muted/20 border border-border/40">
        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
        <span>
          <strong>Garantía de Auditoría:</strong> Esta bitácora es inmutable y está restringida a administradores. Todos los registros se conservan cronológicamente para respaldar revisiones contables y peritajes.
        </span>
      </div>

      {/* ── 6. DIÁLOGO DE CÓMO FUNCIONA CON EJEMPLOS ── */}
      <AuditHowItWorksDialog
        open={showHowItWorks}
        onOpenChange={setShowHowItWorks}
      />

      {/* ── 7. DIÁLOGO DE INSPECCIÓN FORENSE DE EVENTO ── */}
      <EventInspectDialog
        event={selectedEvent}
        open={!!selectedEvent}
        onOpenChange={open => !open && setSelectedEvent(null)}
        registers={registers}
        currentUserDisplayName={userDisplayName}
      />
    </div>
  )
}
