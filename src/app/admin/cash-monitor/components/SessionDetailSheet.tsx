'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  XCircle,
  PauseCircle,
  Lock,
  Unlock,
  PlayCircle,
  RotateCcw,
  DollarSign,
  ArrowUpCircle,
  ArrowDownCircle,
  ShoppingCart,
  Clock,
  User,
  CreditCard,
  QrCode,
  Search,
  Printer,
  ShieldAlert,
  Wrench
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { formatRegisterName, formatUserLabel } from '@/app/dashboard/pos/lib/formatters'
import type { CashSession, CashMovementAdmin, AdminAction, SessionStatus } from '../types'

interface SessionDetailSheetProps {
  session: CashSession | null
  open: boolean
  onClose: () => void
  onAction: (action: AdminAction, session: CashSession) => void
  fetchMovements: (sessionId: string) => Promise<CashMovementAdmin[]>
}

const statusColors: Record<SessionStatus, string> = {
  open: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  closed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  suspended: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  blocked: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
}

const movementTypeConfig: Record<string, { label: string; icon: typeof DollarSign; color: string }> = {
  opening: { label: 'Apertura', icon: DollarSign, color: 'text-blue-500' },
  sale: { label: 'Venta', icon: ShoppingCart, color: 'text-emerald-500' },
  cash_in: { label: 'Ingreso', icon: ArrowUpCircle, color: 'text-green-500' },
  cash_out: { label: 'Egreso', icon: ArrowDownCircle, color: 'text-rose-500' },
  closing: { label: 'Cierre Z', icon: XCircle, color: 'text-slate-500' }
}

export function SessionDetailSheet({ session, open, onClose, onAction, fetchMovements }: SessionDetailSheetProps) {
  const [movements, setMovements] = useState<CashMovementAdmin[]>([])
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [movementFilter, setMovementFilter] = useState<'all' | 'sale' | 'cash_in' | 'cash_out'>('all')
  const [movementSearch, setMovementSearch] = useState('')

  useEffect(() => {
    if (session && open) {
      setLoadingMovements(true)
      fetchMovements(session.id).then(data => {
        setMovements(data)
        setLoadingMovements(false)
      })
    }
  }, [session, open, fetchMovements])

  const filteredMovements = useMemo(() => {
    const q = movementSearch.trim().toLowerCase()
    return movements.filter(m => {
      if (movementFilter !== 'all' && m.type !== movementFilter) return false
      if (!q) return true
      return `${m.reason ?? ''} ${m.created_by_name ?? ''} ${m.payment_method ?? ''} ${m.amount}`.toLowerCase().includes(q)
    })
  }, [movements, movementFilter, movementSearch])

  if (!session) return null

  const calculatedBalance = session.current_balance !== undefined
    ? session.current_balance
    : movements.reduce((sum, m) => {
        if (m.type === 'opening' || m.type === 'sale' || m.type === 'cash_in') return sum + m.amount
        if (m.type === 'cash_out') return sum - m.amount
        return sum
      }, 0)

  const salesTotal = session.total_sales || movements.filter(m => m.type === 'sale').reduce((s, m) => s + m.amount, 0)
  const salesCash = session.sales_by_cash || movements.filter(m => m.type === 'sale' && (m.payment_method === 'cash' || !m.payment_method)).reduce((s, m) => s + m.amount, 0)
  const salesCard = session.sales_by_card || movements.filter(m => m.type === 'sale' && m.payment_method === 'card').reduce((s, m) => s + m.amount, 0)
  const salesTransfer = session.sales_by_transfer || movements.filter(m => m.type === 'sale' && (m.payment_method === 'transfer' || m.payment_method === 'qr')).reduce((s, m) => s + m.amount, 0)
  const salesMixed = session.sales_by_mixed || movements.filter(m => m.type === 'sale' && m.payment_method === 'mixed').reduce((s, m) => s + m.amount, 0)

  const cashInTotal = session.income_total || movements.filter(m => m.type === 'cash_in').reduce((s, m) => s + m.amount, 0)
  const cashOutTotal = session.expense_total || movements.filter(m => m.type === 'cash_out').reduce((s, m) => s + m.amount, 0)

  const diff = session.discrepancy || 0
  const isClosed = session.status === 'closed'
  const openerLabel = formatUserLabel(session.opened_by_name || session.opened_by)
  const closerLabel = formatUserLabel(session.closed_by_name || session.closed_by)
  const regName = formatRegisterName(session.register_id)

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <SheetContent className="w-full sm:max-w-xl overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="p-6 pb-4 border-b bg-muted/20">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle className="text-lg font-bold flex items-center gap-2">
                <span>{regName}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${statusColors[session.status]}`}>
                  {session.status === 'open' ? '🟢 Abierta' : session.status === 'closed' ? '⚪ Cerrada' : session.status === 'suspended' ? '🟡 Suspendida' : '🔴 Bloqueada'}
                </span>
              </SheetTitle>
            </div>
            <SheetDescription className="text-xs text-muted-foreground mt-1">
              Sucursal: <span className="font-semibold text-foreground">{session.branch_id || 'Principal'}</span> • Apertura: {new Date(session.created_at).toLocaleString('es-PY')}
            </SheetDescription>
          </SheetHeader>
        </div>

        <ScrollArea className="flex-1 px-6">
          <div className="space-y-5 py-4">
            {/* Responsables y Tiempos */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border/60 text-xs">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Cajero Apertura</p>
                <div className="flex items-center gap-1.5 mt-1 font-semibold text-foreground">
                  <User className="h-3.5 w-3.5 text-primary" />
                  <span className="truncate">{openerLabel}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Cajero Cierre</p>
                <div className="flex items-center gap-1.5 mt-1 font-semibold text-foreground">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{isClosed ? closerLabel : 'En curso'}</span>
                </div>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase">Duración</p>
                <div className="flex items-center gap-1.5 mt-1 font-semibold text-foreground">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{session.duration_hours ? `${Math.floor(session.duration_hours)}h ${Math.round((session.duration_hours % 1) * 60)}min` : '—'}</span>
                </div>
              </div>
            </div>

            {/* Resumen Financiero */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Resumen Financiero</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50">
                  <p className="text-[10px] uppercase font-bold text-blue-600">Fondo Inicial</p>
                  <p className="text-base font-bold text-blue-700 dark:text-blue-400 font-mono tabular-nums mt-0.5">
                    {formatCurrency(session.opening_balance)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50">
                  <p className="text-[10px] uppercase font-bold text-emerald-600">Ventas Totales</p>
                  <p className="text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums mt-0.5">
                    {formatCurrency(salesTotal)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/50">
                  <p className="text-[10px] uppercase font-bold text-green-600">Ingresos Man.</p>
                  <p className="text-base font-bold text-green-700 dark:text-green-400 font-mono tabular-nums mt-0.5">
                    {formatCurrency(cashInTotal)}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50">
                  <p className="text-[10px] uppercase font-bold text-rose-600">Egresos / Gastos</p>
                  <p className="text-base font-bold text-rose-700 dark:text-rose-400 font-mono tabular-nums mt-0.5">
                    {formatCurrency(cashOutTotal)}
                  </p>
                </div>
              </div>

              {/* Barra de Medios de Pago */}
              <div className="p-3 rounded-xl bg-card border border-border/70 space-y-2">
                <p className="text-[11px] font-bold text-muted-foreground uppercase">Desglose de Ventas por Método:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-medium">
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Efec: <strong className="font-mono">{formatCurrency(salesCash)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                    <span>Tarj: <strong className="font-mono">{formatCurrency(salesCard)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <QrCode className="h-3.5 w-3.5 text-violet-600" />
                    <span>QR/Trans: <strong className="font-mono">{formatCurrency(salesTransfer)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <span>Mixto: <strong className="font-mono">{formatCurrency(salesMixed)}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Diagnóstico de Arqueo / Cierre Z */}
            {isClosed ? (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Diagnóstico de Arqueo Z</h4>
                {Math.abs(diff) < 1 ? (
                  <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      ✓
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Cierre Exacto (Sin Diferencia)</p>
                      <p className="text-xs text-muted-foreground">El dinero físico contado en gaveta coincidió exactamente con el saldo teórico esperado ({formatCurrency(session.expected_balance)}).</p>
                    </div>
                  </div>
                ) : diff > 0.5 ? (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30">
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <span>▲ Sobrante en Caja</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Saldo Real: {formatCurrency(session.closing_balance || 0)} vs Teórico: {formatCurrency(session.expected_balance)}</p>
                    </div>
                    <span className="text-base font-black text-amber-700 dark:text-amber-400 font-mono">
                      +{formatCurrency(diff)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30">
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                        <span>▼ Faltante en Caja</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Saldo Real: {formatCurrency(session.closing_balance || 0)} vs Teórico: {formatCurrency(session.expected_balance)}</p>
                    </div>
                    <span className="text-base font-black text-rose-700 dark:text-rose-400 font-mono">
                      -{formatCurrency(Math.abs(diff))}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-300">Turno Activo en Tiempo Real</p>
                  <p className="text-[11px] text-muted-foreground">Saldo estimado en gaveta en este instante:</p>
                </div>
                <span className="text-lg font-black text-blue-700 dark:text-blue-400 font-mono">
                  {formatCurrency(calculatedBalance)}
                </span>
              </div>
            )}

            {/* Control Remoto Administrativo */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Acciones Administrativas</h4>
              <div className="grid grid-cols-2 gap-2">
                {session.status === 'open' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 rounded-xl font-semibold"
                      onClick={() => onAction('remote_close', session)}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1.5" />
                      Cerrar Remotamente
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 rounded-xl font-semibold"
                      onClick={() => onAction('suspend', session)}
                    >
                      <PauseCircle className="h-3.5 w-3.5 mr-1.5" />
                      Suspender Turno
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 col-span-2 rounded-xl font-bold"
                      onClick={() => onAction('block', session)}
                    >
                      <Lock className="h-3.5 w-3.5 mr-1.5" />
                      Bloquear Terminal
                    </Button>
                  </>
                )}
                {session.status === 'suspended' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 col-span-2 rounded-xl font-bold"
                    onClick={() => onAction('unsuspend', session)}
                  >
                    <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                    Reactivar Turno
                  </Button>
                )}
                {session.status === 'blocked' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs border-blue-300 text-blue-700 hover:bg-blue-50 col-span-2 rounded-xl font-bold"
                    onClick={() => onAction('unblock', session)}
                  >
                    <Unlock className="h-3.5 w-3.5 mr-1.5" />
                    Desbloquear Terminal
                  </Button>
                )}
                {session.status === 'closed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs border-violet-300 text-violet-700 hover:bg-violet-50 col-span-2 rounded-xl font-bold"
                    onClick={() => onAction('reopen', session)}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Reabrir Turno (Auditoría)
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            {/* Lista de Movimientos y Transacciones */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Transacciones ({movements.length})
                </h4>
                <div className="flex gap-1">
                  {[
                    { key: 'all', label: 'Todos' },
                    { key: 'sale', label: 'Ventas' },
                    { key: 'cash_in', label: 'Ingresos' },
                    { key: 'cash_out', label: 'Egresos' }
                  ].map(tab => (
                    <Button
                      key={tab.key}
                      size="sm"
                      variant={movementFilter === tab.key ? 'default' : 'outline'}
                      onClick={() => setMovementFilter(tab.key as any)}
                      className="h-6 px-2 text-[10px] rounded-lg"
                    >
                      {tab.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={movementSearch}
                  onChange={(e) => setMovementSearch(e.target.value)}
                  placeholder="Filtrar por concepto o cajero…"
                  className="pl-8 h-8 text-xs rounded-xl"
                />
              </div>

              {loadingMovements ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-xl" />
                  ))}
                </div>
              ) : filteredMovements.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">Sin movimientos registrados</p>
              ) : (
                <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-1">
                  {filteredMovements.map((movement) => {
                    const config = movementTypeConfig[movement.type] || {
                      label: movement.type,
                      icon: DollarSign,
                      color: 'text-slate-500'
                    }
                    const Icon = config.icon
                    const isIncome = ['opening', 'sale', 'cash_in'].includes(movement.type)

                    return (
                      <div
                        key={movement.id}
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className={`p-1.5 rounded-lg bg-muted ${config.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">{config.label}</span>
                            {movement.payment_method && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 rounded">
                                {movement.payment_method}
                              </Badge>
                            )}
                          </div>
                          {movement.reason && (
                            <p className="text-[11px] text-muted-foreground truncate">{movement.reason}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(movement.created_at).toLocaleTimeString('es-PY', {
                              hour: '2-digit', minute: '2-digit'
                            })}
                            {movement.created_by_name && ` • ${movement.created_by_name}`}
                          </p>
                        </div>
                        <span className={`text-xs font-bold font-mono tabular-nums ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {isIncome ? '+' : '-'}{formatCurrency(movement.amount)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
