'use client'

import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCashRegisterContext } from '../../contexts/CashRegisterContext'
import {
  ShieldAlert,
  User,
  Clock,
  ArrowRight,
  Activity,
  DoorOpen,
  DoorClosed,
  PlusCircle,
  MinusCircle,
  ShoppingCart,
  Search,
  Filter
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

interface CashRegisterAuditProps {
  onOpenFullAudit: () => void
}

function getActionMeta(action: string) {
  const normalized = action.toLowerCase()

  if (normalized.includes('open') || normalized.includes('apertura')) {
    return {
      icon: <DoorOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400',
      type: 'session_open'
    }
  }

  if (normalized.includes('clos') || normalized.includes('cierre')) {
    return {
      icon: <DoorClosed className="h-4 w-4 text-rose-600 dark:text-rose-400" />,
      color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-400',
      type: 'session_close'
    }
  }

  if (normalized.includes('in') || normalized.includes('ingreso')) {
    return {
      icon: <PlusCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
      color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-blue-400',
      type: 'cash_in'
    }
  }

  if (normalized.includes('out') || normalized.includes('egreso') || normalized.includes('retiro')) {
    return {
      icon: <MinusCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
      color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-400',
      type: 'cash_out'
    }
  }

  if (normalized.includes('sale') || normalized.includes('venta')) {
    return {
      icon: <ShoppingCart className="h-4 w-4 text-violet-600 dark:text-violet-400" />,
      color: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:border-violet-900/50 dark:text-violet-400',
      type: 'sale'
    }
  }

  return {
    icon: <Activity className="h-4 w-4 text-slate-500 dark:text-slate-400" />,
    color: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/30 dark:border-slate-800 dark:text-slate-400',
    type: 'other'
  }
}

export function CashRegisterAudit({ onOpenFullAudit }: CashRegisterAuditProps) {
  const { auditLog } = useCashRegisterContext()
  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState<'all' | 'session_open' | 'session_close' | 'cash_in' | 'cash_out' | 'sale' | 'other'>('all')

  const entries = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return auditLog
      .filter((entry) => {
        const meta = getActionMeta(entry.action)
        const byType = actionFilter === 'all' || meta.type === actionFilter
        if (!byType) return false

        if (!normalizedSearch) return true

        return (
          entry.action.toLowerCase().includes(normalizedSearch) ||
          entry.details.toLowerCase().includes(normalizedSearch) ||
          (entry.userName || '').toLowerCase().includes(normalizedSearch)
        )
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [auditLog, searchTerm, actionFilter])

  const getUserDisplay = (name?: string, email?: string, id?: string) => {
    const n = (name || '').trim()
    const e = (email || '').trim()
    if (n && e && n !== e) return `${n} (${e})`
    return n || e || id || 'Sistema'
  }

  const summary = useMemo(() => {
    return entries.reduce(
      (acc, entry) => {
        const meta = getActionMeta(entry.action)
        acc.total += 1
        acc[meta.type as keyof typeof acc] += 1
        return acc
      },
      {
        total: 0,
        session_open: 0,
        session_close: 0,
        cash_in: 0,
        cash_out: 0,
        sale: 0,
        other: 0
      }
    )
  }, [entries])

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
        <div>
          <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-slate-500" />
            Auditoría operativa
          </h3>
          <p className="text-sm text-muted-foreground">Eventos recientes de caja con filtros rápidos</p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenFullAudit}
          className="shadow-sm hover:shadow-md transition-all bg-white dark:bg-gray-950"
        >
          Ver auditoría completa
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      <Card className="shadow-sm border-border/60 overflow-hidden bg-card">
        <CardHeader className="pb-4 border-b border-border/40 bg-muted/20 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <CardTitle className="text-sm font-semibold">Actividad reciente</CardTitle>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border bg-muted/50 text-muted-foreground border-border/50">
              {summary.total} evento(s)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-3">
            <div className="relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por acción, detalle o usuario..."
                className="pl-9 h-9 bg-background shadow-sm"
              />
            </div>

            <div className="flex items-center gap-2 relative">
              <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as typeof actionFilter)}>
                <SelectTrigger className="h-9 bg-background shadow-sm">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="Tipo" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="session_open">Aperturas</SelectItem>
                  <SelectItem value="session_close">Cierres</SelectItem>
                  <SelectItem value="cash_in">Entradas</SelectItem>
                  <SelectItem value="cash_out">Salidas</SelectItem>
                  <SelectItem value="sale">Ventas</SelectItem>
                  <SelectItem value="other">Otros</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 pt-2">
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-2 text-center dark:border-emerald-900/30 dark:bg-emerald-950/20">
              <p className="text-[10px] uppercase font-semibold text-emerald-800 dark:text-emerald-400 mb-0.5">Aperturas</p>
              <p className="font-bold tabular-nums text-emerald-900 dark:text-emerald-300">{summary.session_open}</p>
            </div>
            <div className="rounded-lg border border-rose-100 bg-rose-50/50 p-2 text-center dark:border-rose-900/30 dark:bg-rose-950/20">
              <p className="text-[10px] uppercase font-semibold text-rose-800 dark:text-rose-400 mb-0.5">Cierres</p>
              <p className="font-bold tabular-nums text-rose-900 dark:text-rose-300">{summary.session_close}</p>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-2 text-center dark:border-blue-900/30 dark:bg-blue-950/20">
              <p className="text-[10px] uppercase font-semibold text-blue-800 dark:text-blue-400 mb-0.5">Entradas</p>
              <p className="font-bold tabular-nums text-blue-900 dark:text-blue-300">{summary.cash_in}</p>
            </div>
            <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-2 text-center dark:border-amber-900/30 dark:bg-amber-950/20">
              <p className="text-[10px] uppercase font-semibold text-amber-800 dark:text-amber-400 mb-0.5">Salidas</p>
              <p className="font-bold tabular-nums text-amber-900 dark:text-amber-300">{summary.cash_out}</p>
            </div>
            <div className="rounded-lg border border-violet-100 bg-violet-50/50 p-2 text-center dark:border-violet-900/30 dark:bg-violet-950/20">
              <p className="text-[10px] uppercase font-semibold text-violet-800 dark:text-violet-400 mb-0.5">Ventas</p>
              <p className="font-bold tabular-nums text-violet-900 dark:text-violet-300">{summary.sale}</p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-2 text-center dark:border-slate-800/30 dark:bg-slate-900/20">
              <p className="text-[10px] uppercase font-semibold text-slate-800 dark:text-slate-400 mb-0.5">Otros</p>
              <p className="font-bold tabular-nums text-slate-900 dark:text-slate-300">{summary.other}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-[520px] w-full">
            {entries.length > 0 ? (
              <div className="divide-y divide-border/40">
                {entries.slice(0, 80).map((entry) => {
                  const meta = getActionMeta(entry.action)
                  return (
                    <div key={entry.id} className="p-4 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`mt-0.5 p-2 rounded-lg border ${meta.color} bg-opacity-50`}>
                          {meta.icon}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${meta.color}`}>
                              {entry.action.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>

                          <p className="text-sm font-semibold text-foreground truncate" title={entry.details || 'Sin detalles'}>
                            {entry.details || 'Sin detalles'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-6 min-w-[200px] mt-2 sm:mt-0 pl-12 sm:pl-0">
                        {entry.amount !== undefined ? (
                          <div className="text-right">
                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">Monto</span>
                            <span className="font-bold tabular-nums text-foreground">
                              {formatCurrency(entry.amount)}
                            </span>
                          </div>
                        ) : null}

                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1.5 rounded-md border border-border/40 max-w-[160px]">
                          <User className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate font-medium" title={getUserDisplay(entry.userName, entry.userEmail, entry.userId)}>
                            {getUserDisplay(entry.userName, entry.userEmail, entry.userId)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-card">
                <div className="p-4 bg-muted/50 rounded-full mb-3">
                  <Activity className="h-8 w-8 opacity-40" />
                </div>
                <p className="font-medium text-sm">No hay registros para los filtros seleccionados</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
