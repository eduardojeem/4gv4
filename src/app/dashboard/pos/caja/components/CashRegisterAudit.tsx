'use client'

import React, { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
      icon: <DoorOpen className="h-4 w-4 text-emerald-600" />,
      color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      type: 'session_open'
    }
  }

  if (normalized.includes('clos') || normalized.includes('cierre')) {
    return {
      icon: <DoorClosed className="h-4 w-4 text-rose-600" />,
      color: 'bg-rose-100 text-rose-700 border-rose-200',
      type: 'session_close'
    }
  }

  if (normalized.includes('in') || normalized.includes('ingreso')) {
    return {
      icon: <PlusCircle className="h-4 w-4 text-blue-600" />,
      color: 'bg-blue-100 text-blue-700 border-blue-200',
      type: 'cash_in'
    }
  }

  if (normalized.includes('out') || normalized.includes('egreso') || normalized.includes('retiro')) {
    return {
      icon: <MinusCircle className="h-4 w-4 text-amber-600" />,
      color: 'bg-amber-100 text-amber-700 border-amber-200',
      type: 'cash_out'
    }
  }

  if (normalized.includes('sale') || normalized.includes('venta')) {
    return {
      icon: <ShoppingCart className="h-4 w-4 text-violet-600" />,
      color: 'bg-violet-100 text-violet-700 border-violet-200',
      type: 'sale'
    }
  }

  return {
    icon: <Activity className="h-4 w-4 text-gray-500" />,
    color: 'bg-gray-100 text-gray-700 border-gray-200',
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
        acc[meta.type] += 1
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
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-gray-500" />
            Auditoria operativa
          </h3>
          <p className="text-sm text-muted-foreground">Eventos recientes de caja con filtros rapidos</p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenFullAudit}
          className="shadow-sm hover:shadow-md transition-all"
        >
          Ver auditoria completa
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      <Card className="shadow-sm border-none bg-white dark:bg-gray-950">
        <CardHeader className="pb-3 border-b space-y-3">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <CardTitle className="text-base">Actividad reciente</CardTitle>
            <Badge variant="outline">{summary.total} evento(s)</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por accion, detalle o usuario"
                className="pl-9"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as typeof actionFilter)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tipo de evento" />
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

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
            <div className="rounded-md border p-2 text-center">Aperturas: <span className="font-semibold">{summary.session_open}</span></div>
            <div className="rounded-md border p-2 text-center">Cierres: <span className="font-semibold">{summary.session_close}</span></div>
            <div className="rounded-md border p-2 text-center">Entradas: <span className="font-semibold">{summary.cash_in}</span></div>
            <div className="rounded-md border p-2 text-center">Salidas: <span className="font-semibold">{summary.cash_out}</span></div>
            <div className="rounded-md border p-2 text-center">Ventas: <span className="font-semibold">{summary.sale}</span></div>
            <div className="rounded-md border p-2 text-center">Otros: <span className="font-semibold">{summary.other}</span></div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="h-[520px] w-full">
            {entries.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {entries.slice(0, 80).map((entry) => {
                  const meta = getActionMeta(entry.action)
                  return (
                    <div key={entry.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800">
                          {meta.icon}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] font-medium uppercase tracking-wide border ${meta.color}`}>
                              {entry.action.replace(/_/g, ' ')}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {new Date(entry.timestamp).toLocaleString()}
                            </span>
                          </div>

                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate" title={entry.details || 'Sin detalles'}>
                            {entry.details || 'Sin detalles'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-6 min-w-[200px] mt-2 sm:mt-0 pl-12 sm:pl-0">
                        {entry.amount !== undefined ? (
                          <div className="text-right">
                            <span className="block text-xs text-muted-foreground">Monto</span>
                            <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
                              {formatCurrency(entry.amount)}
                            </span>
                          </div>
                        ) : null}

                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-full max-w-[160px]">
                          <User className="h-3 w-3 shrink-0" />
                          <span className="truncate" title={getUserDisplay(entry.userName, entry.userEmail, entry.userId)}>
                            {getUserDisplay(entry.userName, entry.userEmail, entry.userId)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Activity className="h-12 w-12 opacity-20 mb-3" />
                <p>No hay registros para los filtros seleccionados</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}

