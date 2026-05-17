'use client'

import { useEffect, useState } from 'react'
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
  User
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
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
  cash_out: { label: 'Egreso', icon: ArrowDownCircle, color: 'text-red-500' },
  closing: { label: 'Cierre', icon: XCircle, color: 'text-slate-500' }
}

export function SessionDetailSheet({ session, open, onClose, onAction, fetchMovements }: SessionDetailSheetProps) {
  const [movements, setMovements] = useState<CashMovementAdmin[]>([])
  const [loadingMovements, setLoadingMovements] = useState(false)

  useEffect(() => {
    if (session && open) {
      setLoadingMovements(true)
      fetchMovements(session.id).then(data => {
        setMovements(data)
        setLoadingMovements(false)
      })
    }
  }, [session, open, fetchMovements])

  if (!session) return null

  // Calculate balance from movements
  const calculatedBalance = movements.reduce((sum, m) => {
    if (m.type === 'opening' || m.type === 'sale' || m.type === 'cash_in') return sum + m.amount
    if (m.type === 'cash_out') return sum - m.amount
    return sum
  }, 0)

  const salesTotal = movements.filter(m => m.type === 'sale').reduce((s, m) => s + m.amount, 0)
  const cashInTotal = movements.filter(m => m.type === 'cash_in').reduce((s, m) => s + m.amount, 0)
  const cashOutTotal = movements.filter(m => m.type === 'cash_out').reduce((s, m) => s + m.amount, 0)

  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader className="flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            Caja: {session.register_id}
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusColors[session.status]}`}>
              {session.status === 'open' ? 'Abierta' : session.status === 'closed' ? 'Cerrada' : session.status === 'suspended' ? 'Suspendida' : 'Bloqueada'}
            </span>
          </SheetTitle>
          <SheetDescription>
            Sucursal: {session.branch_id} • Abierta: {new Date(session.created_at).toLocaleString('es-PY')}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Session Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase">Cajero</p>
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">{session.opened_by_name || (session.opened_by ? session.opened_by.slice(0, 8) + '...' : 'No registrado')}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase">Duración</p>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {session.duration_hours ? `${Math.floor(session.duration_hours)}h ${Math.round((session.duration_hours % 1) * 60)}min` : '-'}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Financial Summary */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Resumen Financiero</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50">
                  <p className="text-[10px] uppercase font-semibold text-blue-600">Monto Inicial</p>
                  <p className="text-lg font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                    {formatCurrency(session.opening_balance)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/50">
                  <p className="text-[10px] uppercase font-semibold text-emerald-600">Balance Actual</p>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatCurrency(calculatedBalance)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-green-50/50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/50">
                  <p className="text-[10px] uppercase font-semibold text-green-600">Ventas</p>
                  <p className="text-base font-bold text-green-700 dark:text-green-400 tabular-nums">
                    {formatCurrency(salesTotal)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-violet-50/50 dark:bg-violet-950/20 border border-violet-100 dark:border-violet-900/50">
                  <p className="text-[10px] uppercase font-semibold text-violet-600">Ingresos</p>
                  <p className="text-base font-bold text-violet-700 dark:text-violet-400 tabular-nums">
                    {formatCurrency(cashInTotal)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50">
                  <p className="text-[10px] uppercase font-semibold text-rose-600">Egresos</p>
                  <p className="text-base font-bold text-rose-700 dark:text-rose-400 tabular-nums">
                    {formatCurrency(cashOutTotal)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-slate-50/50 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-900/50">
                  <p className="text-[10px] uppercase font-semibold text-slate-600">Movimientos</p>
                  <p className="text-base font-bold text-slate-700 dark:text-slate-400 tabular-nums">
                    {movements.length}
                  </p>
                </div>
              </div>

              {/* Discrepancy Banner */}
              {session.status === 'closed' && (
                (() => {
                  const diff = session.discrepancy || 0
                  const hasExpectedBalance = session.expected_balance > 0

                  // No expected_balance means the session was closed without proper cash count
                  if (!hasExpectedBalance && diff === 0) {
                    return (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800">
                        <span className="h-2 w-2 rounded-full bg-slate-400" />
                        <span className="text-sm text-muted-foreground">
                          Cerrada sin arqueo — no se registró conteo físico
                        </span>
                      </div>
                    )
                  }

                  if (diff === 0) {
                    return (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                          Cierre exacto — el conteo coincide con lo esperado
                        </span>
                      </div>
                    )
                  }
                  if (diff > 0) {
                    return (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          <div>
                            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                              Sobrante en caja
                            </span>
                            <p className="text-[11px] text-amber-600/80 dark:text-amber-400/60">
                              Se contó más dinero del esperado por el sistema
                            </p>
                          </div>
                        </div>
                        <span className="text-sm font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                          +{formatCurrency(diff)}
                        </span>
                      </div>
                    )
                  }
                  return (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                        <div>
                          <span className="text-sm font-bold text-red-700 dark:text-red-400">
                            Faltante en caja
                          </span>
                          <p className="text-[11px] text-red-600/80 dark:text-red-400/60">
                            Se contó menos dinero del esperado por el sistema
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-red-700 dark:text-red-400 tabular-nums">
                        -{formatCurrency(Math.abs(diff))}
                      </span>
                    </div>
                  )
                })()
              )}
            </div>

            <Separator />

            {/* Admin Actions */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">Control Remoto</h4>
              <div className="grid grid-cols-2 gap-2">
                {session.status === 'open' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
                      onClick={() => onAction('remote_close', session)}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1.5" />
                      Cerrar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-400 dark:hover:bg-amber-950/30"
                      onClick={() => onAction('suspend', session)}
                    >
                      <PauseCircle className="h-3.5 w-3.5 mr-1.5" />
                      Suspender
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30 col-span-2"
                      onClick={() => onAction('block', session)}
                    >
                      <Lock className="h-3.5 w-3.5 mr-1.5" />
                      Bloquear Caja
                    </Button>
                  </>
                )}
                {session.status === 'suspended' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 col-span-2"
                    onClick={() => onAction('unsuspend', session)}
                  >
                    <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
                    Reactivar Caja
                  </Button>
                )}
                {session.status === 'blocked' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 col-span-2"
                    onClick={() => onAction('unblock', session)}
                  >
                    <Unlock className="h-3.5 w-3.5 mr-1.5" />
                    Desbloquear Caja
                  </Button>
                )}
                {session.status === 'closed' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs border-violet-200 text-violet-700 hover:bg-violet-50 col-span-2"
                    onClick={() => onAction('reopen', session)}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Reabrir Caja
                  </Button>
                )}
              </div>
            </div>

            <Separator />

            {/* Movements List */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase text-muted-foreground">
                Historial de Movimientos ({movements.length})
              </h4>
              {loadingMovements ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full rounded-lg" />
                  ))}
                </div>
              ) : movements.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sin movimientos</p>
              ) : (
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {movements.map((movement) => {
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
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors"
                      >
                        <div className={`${config.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">{config.label}</span>
                            {movement.payment_method && (
                              <Badge variant="outline" className="text-[9px] h-4">
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
                        <span className={`text-sm font-bold tabular-nums ${isIncome ? 'text-emerald-600' : 'text-red-600'}`}>
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
