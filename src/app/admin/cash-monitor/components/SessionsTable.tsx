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
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-semibold text-muted-foreground">Sin sesiones</h3>
          <p className="text-sm text-muted-foreground mt-1">
            No hay sesiones que coincidan con los filtros actuales
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {liveMode && <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>}
          {liveMode ? 'Cajas en Tiempo Real' : 'Todas las Sesiones'}
          <Badge variant="outline" className="ml-auto text-xs font-normal">
            {sessions.length} resultados
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left p-3 font-medium text-muted-foreground">Caja</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Estado</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden md:table-cell">Cajero</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Monto Inicial</th>
                <th className="text-right p-3 font-medium text-muted-foreground hidden lg:table-cell">Balance Cierre</th>
                <th className="text-right p-3 font-medium text-muted-foreground hidden md:table-cell">Diferencia</th>
                <th className="text-center p-3 font-medium text-muted-foreground hidden lg:table-cell">Movimientos</th>
                <th className="text-left p-3 font-medium text-muted-foreground hidden xl:table-cell">Duración</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessions.map((session) => {
                const status = statusConfig[session.status]
                return (
                  <tr
                    key={session.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => onSelectSession(session)}
                  >
                    <td className="p-3">
                      <div className="font-medium">{session.register_id}</div>
                      <div className="text-xs text-muted-foreground">{session.branch_id}</div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs truncate max-w-[140px]" title={session.opened_by_name || session.opened_by || 'No identificado'}>
                          {session.opened_by_name || (session.opened_by ? session.opened_by.slice(0, 8) + '...' : '')}
                        </span>
                        {!session.opened_by_name && !session.opened_by && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 italic">sin registro</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right font-mono text-xs">
                      {formatCurrency(session.opening_balance)}
                    </td>
                    <td className="p-3 text-right font-mono text-xs hidden lg:table-cell">
                      {session.closing_balance != null
                        ? formatCurrency(session.closing_balance)
                        : <span className="text-muted-foreground">-</span>
                      }
                    </td>
                    <td className="p-3 text-right hidden md:table-cell">
                      {session.status === 'closed' ? (
                        (() => {
                          const diff = session.discrepancy || 0
                          const hasExpectedBalance = session.expected_balance > 0

                          // If no expected_balance stored, we can't determine discrepancy reliably
                          if (!hasExpectedBalance && diff === 0) {
                            return (
                              <span className="text-[10px] text-muted-foreground italic">sin arqueo</span>
                            )
                          }

                          if (diff === 0) {
                            return (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Exacto
                              </span>
                            )
                          }
                          if (diff > 0) {
                            return (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                +{formatCurrency(diff)} sobrante
                              </span>
                            )
                          }
                          return (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                              {formatCurrency(Math.abs(diff))} faltante
                            </span>
                          )
                        })()
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="p-3 text-center hidden lg:table-cell">
                      <Badge variant="outline" className="text-xs font-mono">
                        {session.movements_count || 0}
                      </Badge>
                    </td>
                    <td className="p-3 hidden xl:table-cell">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDuration(session.duration_hours)}
                      </div>
                    </td>
                    <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => onSelectSession(session)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalle
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {session.status === 'open' && (
                            <>
                              <DropdownMenuItem onClick={() => onAction('remote_close', session)}>
                                <XCircle className="h-4 w-4 mr-2 text-red-500" />
                                Cerrar remotamente
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onAction('suspend', session)}>
                                <PauseCircle className="h-4 w-4 mr-2 text-amber-500" />
                                Suspender
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onAction('block', session)}>
                                <Lock className="h-4 w-4 mr-2 text-red-500" />
                                Bloquear
                              </DropdownMenuItem>
                            </>
                          )}
                          {session.status === 'suspended' && (
                            <DropdownMenuItem onClick={() => onAction('unsuspend', session)}>
                              <PlayCircle className="h-4 w-4 mr-2 text-emerald-500" />
                              Reactivar
                            </DropdownMenuItem>
                          )}
                          {session.status === 'blocked' && (
                            <DropdownMenuItem onClick={() => onAction('unblock', session)}>
                              <Unlock className="h-4 w-4 mr-2 text-blue-500" />
                              Desbloquear
                            </DropdownMenuItem>
                          )}
                          {session.status === 'closed' && (
                            <DropdownMenuItem onClick={() => onAction('reopen', session)}>
                              <RotateCcw className="h-4 w-4 mr-2 text-violet-500" />
                              Reabrir
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
