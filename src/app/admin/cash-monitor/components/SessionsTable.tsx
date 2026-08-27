'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  MoreHorizontal,
  Eye,
  XCircle,
  PauseCircle,
  PlayCircle,
  Lock,
  Unlock,
  RotateCcw,
  Clock,
  User,
  Activity
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import type { CashSession, AdminAction, SessionStatus } from '../types'

import { formatRegisterName, formatUserLabel } from '@/app/dashboard/pos/lib/formatters'

interface SessionsTableProps {
  sessions: CashSession[]
  loading: boolean
  onSelectSession: (session: CashSession) => void
  onAction: (action: AdminAction, session: CashSession) => void
  liveMode?: boolean
}

const statusConfig: Record<SessionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; color: string }> = {
  open: { label: 'Abierta', variant: 'default', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  closed: { label: 'Cerrada', variant: 'secondary', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
  suspended: { label: 'Suspendida', variant: 'outline', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  blocked: { label: 'Bloqueada', variant: 'destructive', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' }
}

function formatDuration(hours?: number): string {
  if (!hours) return '-'
  if (hours < 1) return `${Math.round(hours * 60)}min`
  if (hours < 24) return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}min`
  return `${Math.floor(hours / 24)}d ${Math.floor(hours % 24)}h`
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function SessionsTable({ sessions, loading, onSelectSession, onAction, liveMode }: SessionsTableProps) {
  if (loading) {
    return (
      <Card className="rounded-2xl border border-border/70 shadow-xs">
        <CardContent className="p-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (sessions.length === 0) {
    return (
      <Card className="rounded-2xl border border-dashed border-border/70 shadow-xs">
        <CardContent className="p-12 text-center">
          <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-40" />
          <h3 className="text-base font-semibold text-foreground">Sin sesiones registradas</h3>
          <p className="text-xs text-muted-foreground mt-1">
            No se encontraron sesiones para los filtros de fecha o estado seleccionados.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border border-border/70 shadow-xs rounded-2xl overflow-hidden">
      <CardHeader className="py-3 px-4 border-b bg-muted/20">
        <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
          {liveMode && (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          )}
          {liveMode ? 'Cajas Activas en Vivo' : 'Historial y Monitoreo de Sesiones'}
          <Badge variant="outline" className="ml-auto text-[11px] font-medium rounded-lg">
            {sessions.length} turnos
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/30 text-muted-foreground font-semibold">
                <th className="text-left py-3 px-3.5">Caja / Terminal</th>
                <th className="text-left py-3 px-2">Estado</th>
                <th className="text-left py-3 px-3 hidden md:table-cell">Cajero</th>
                <th className="text-right py-3 px-3">Fondo Inicial</th>
                <th className="text-right py-3 px-3 hidden sm:table-cell">Ventas</th>
                <th className="text-right py-3 px-3">Balance / Gaveta</th>
                <th className="text-right py-3 px-3 hidden md:table-cell">Diferencia (Arqueo)</th>
                <th className="text-center py-3 px-2 hidden lg:table-cell">Movs.</th>
                <th className="text-left py-3 px-3 hidden xl:table-cell">Duración</th>
                <th className="text-right py-3 px-3.5">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessions.map((session) => {
                const status = statusConfig[session.status]
                const diff = session.discrepancy || 0
                const isClosed = session.status === 'closed'
                const isOpen = session.status === 'open'
                const openerLabel = formatUserLabel(session.opened_by_name || session.opened_by)
                const regName = formatRegisterName(session.register_id)

                return (
                  <tr
                    key={session.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => onSelectSession(session)}
                  >
                    <td className="py-3 px-3.5">
                      <div className="font-semibold text-foreground">{regName}</div>
                      <div className="text-[10px] text-muted-foreground">{session.branch_id || 'Principal'}</div>
                    </td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="py-3 px-3 hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-xs truncate max-w-[130px] font-medium" title={openerLabel}>
                          {openerLabel}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums text-muted-foreground">
                      {formatCurrency(session.opening_balance)}
                    </td>
                    <td className="py-3 px-3 text-right hidden sm:table-cell">
                      <div className="font-mono font-semibold text-foreground tabular-nums">
                        {formatCurrency(session.total_sales || 0)}
                      </div>
                      <div className="text-[9px] text-muted-foreground">
                        Ef: {formatCurrency(session.sales_by_cash || 0)}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      {isOpen ? (
                        <div>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(session.current_balance || session.opening_balance)}
                          </span>
                          <span className="block text-[9px] text-emerald-700 dark:text-emerald-500 font-sans">
                            ● en vivo
                          </span>
                        </div>
                      ) : (
                        <span className="font-semibold text-foreground">
                          {session.closing_balance != null
                            ? formatCurrency(session.closing_balance)
                            : formatCurrency(session.current_balance || 0)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right hidden md:table-cell">
                      {isClosed ? (
                        Math.abs(diff) < 1 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
                            ✓ Exacto
                          </span>
                        ) : diff > 0.5 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/50 px-2 py-0.5 rounded-md font-mono">
                            ▲ +{formatCurrency(diff)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-100/70 dark:bg-rose-950/50 px-2 py-0.5 rounded-md font-mono">
                            ▼ -{formatCurrency(Math.abs(diff))}
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-100/60 dark:bg-blue-950/40 px-2 py-0.5 rounded-md">
                          En curso
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-center hidden lg:table-cell">
                      <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 rounded">
                        {session.movements_count || 0}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 hidden xl:table-cell">
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDuration(session.duration_hours)}
                      </div>
                    </td>
                    <td className="py-3 px-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 text-xs rounded-xl shadow-lg">
                          <DropdownMenuItem onClick={() => onSelectSession(session)} className="gap-2">
                            <Eye className="h-3.5 w-3.5 text-blue-600" />
                            Ver detalle completo
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {session.status === 'open' && (
                            <>
                              <DropdownMenuItem onClick={() => onAction('remote_close', session)} className="gap-2 text-rose-600 focus:text-rose-600">
                                <XCircle className="h-3.5 w-3.5" />
                                Cerrar remotamente
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onAction('suspend', session)} className="gap-2 text-amber-600 focus:text-amber-600">
                                <PauseCircle className="h-3.5 w-3.5" />
                                Suspender
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onAction('block', session)} className="gap-2 text-red-600 focus:text-red-600">
                                <Lock className="h-3.5 w-3.5" />
                                Bloquear
                              </DropdownMenuItem>
                            </>
                          )}
                          {session.status === 'suspended' && (
                            <DropdownMenuItem onClick={() => onAction('unsuspend', session)} className="gap-2 text-emerald-600 focus:text-emerald-600">
                              <PlayCircle className="h-3.5 w-3.5" />
                              Reactivar
                            </DropdownMenuItem>
                          )}
                          {session.status === 'blocked' && (
                            <DropdownMenuItem onClick={() => onAction('unblock', session)} className="gap-2 text-blue-600 focus:text-blue-600">
                              <Unlock className="h-3.5 w-3.5" />
                              Desbloquear
                            </DropdownMenuItem>
                          )}
                          {session.status === 'closed' && (
                            <DropdownMenuItem onClick={() => onAction('reopen', session)} className="gap-2 text-violet-600 focus:text-violet-600">
                              <RotateCcw className="h-3.5 w-3.5" />
                              Reabrir turno
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
