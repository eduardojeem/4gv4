'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Shield,
  Search,
  Download,
  Filter,
  User,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Lock,
  ArrowUpCircle,
  ArrowDownCircle,
  Activity,
  RefreshCw,
  ArrowUpDown,
  ListFilter
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCashRegisterContext, AuditLogEntry } from '../contexts/CashRegisterContext'

interface AuditLogModalProps {
  isOpen: boolean
  onClose: () => void
}

const ACTION_TYPES: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  REGISTER_OPEN: { label: 'Apertura de caja', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle },
  OPENING: { label: 'Apertura de caja', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle },
  REGISTER_CLOSE: { label: 'Cierre de caja', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: XCircle },
  CLOSING: { label: 'Cierre de caja', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: XCircle },
  Z_CLOSURE: { label: 'Cierre Z', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: Shield },
  CASH_IN: { label: 'Ingreso de efectivo', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: ArrowUpCircle },
  CASH_OUT: { label: 'Egreso de efectivo', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: ArrowDownCircle },
  CASH_SALE: { label: 'Venta registrada', color: 'bg-green-50 text-green-700 border-green-200', icon: DollarSign },
  SALE: { label: 'Venta registrada', color: 'bg-green-50 text-green-700 border-green-200', icon: DollarSign },
  CASH_COUNT: { label: 'Arqueo de caja', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: Eye },
  PERMISSION_CHANGE: { label: 'Cambio de permisos', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Lock },
  ERROR: { label: 'Error del sistema', color: 'bg-red-50 text-red-700 border-red-200', icon: AlertTriangle }
}

const FALLBACK_ACTION = {
  label: 'Evento',
  color: 'bg-gray-100 text-gray-700 border-gray-200',
  icon: Activity
}

function getActionMeta(action: string) {
  return ACTION_TYPES[action] || FALLBACK_ACTION
}

function getUserDisplay(entry: AuditLogEntry) {
  const name = (entry.userName || '').trim()
  const email = (entry.userEmail || '').trim()
  if (name && email && name !== email) return `${name} (${email})`
  return name || email || 'Usuario no identificado'
}

export function AuditLogModal({ isOpen, onClose }: AuditLogModalProps) {
  const { auditLog, fetchAuditLog, checkPermission, registers } = useCashRegisterContext()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAction, setSelectedAction] = useState<string>('all')
  const [selectedRegister, setSelectedRegister] = useState<string>('all')
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [loading, setLoading] = useState(false)

  const canViewAuditLog = checkPermission('canViewAuditLog')
  const canExportData = checkPermission('canExportData')

  const loadAuditLog = async () => {
    setLoading(true)
    try {
      await fetchAuditLog(
        selectedRegister !== 'all' ? selectedRegister : undefined,
        dateFrom || undefined,
        dateTo || undefined
      )
    } catch (error) {
      console.error('Error loading audit log:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && canViewAuditLog) {
      loadAuditLog()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, canViewAuditLog])

  const uniqueUsers = useMemo(() => {
    const users = new Map<string, string>()
    for (const entry of auditLog) {
      users.set(entry.userId || 'system', getUserDisplay(entry))
    }
    return Array.from(users.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [auditLog])

  const uniqueActions = useMemo(() => {
    const actions = new Set(auditLog.map((entry) => entry.action))
    return Array.from(actions).sort()
  }, [auditLog])

  const filteredLog = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null

    return auditLog
      .filter((entry) => {
        const byAction = selectedAction === 'all' || entry.action === selectedAction
        if (!byAction) return false

        const byRegister = selectedRegister === 'all' || entry.registerId === selectedRegister
        if (!byRegister) return false

        const byUser = selectedUser === 'all' || entry.userId === selectedUser
        if (!byUser) return false

        const ts = new Date(entry.timestamp).getTime()
        if (fromTime && ts < fromTime) return false
        if (toTime && ts > toTime) return false

        if (!query) return true
        const actionLabel = getActionMeta(entry.action).label.toLowerCase()
        const details = (entry.details || '').toLowerCase()
        const userText = getUserDisplay(entry).toLowerCase()
        const userId = (entry.userId || '').toLowerCase()
        return actionLabel.includes(query) || details.includes(query) || userText.includes(query) || userId.includes(query)
      })
      .sort((a, b) => {
        const diff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        return sortOrder === 'desc' ? diff : -diff
      })
  }, [auditLog, searchTerm, selectedAction, selectedRegister, selectedUser, dateFrom, dateTo, sortOrder])

  const summary = useMemo(() => {
    let cashIn = 0
    let cashOut = 0
    let openings = 0
    let closings = 0
    let sales = 0

    for (const entry of filteredLog) {
      if (entry.action === 'CASH_IN') cashIn += entry.amount || 0
      if (entry.action === 'CASH_OUT') cashOut += entry.amount || 0
      if (entry.action === 'OPENING' || entry.action === 'REGISTER_OPEN') openings += 1
      if (entry.action === 'CLOSING' || entry.action === 'REGISTER_CLOSE') closings += 1
      if (entry.action === 'SALE' || entry.action === 'CASH_SALE') sales += 1
    }

    return {
      total: filteredLog.length,
      openings,
      closings,
      sales,
      cashIn,
      cashOut,
      netFlow: cashIn - cashOut
    }
  }, [filteredLog])

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedAction('all')
    setSelectedRegister('all')
    setSelectedUser('all')
    setDateFrom('')
    setDateTo('')
    setSortOrder('desc')
  }

  const exportAuditLog = () => {
    if (!canExportData) return

    const headers = [
      'Fecha/Hora',
      'Usuario',
      'Accion',
      'Detalles',
      'Caja',
      'Monto',
      'Saldo Anterior',
      'Saldo Nuevo'
    ]

    const rows = filteredLog.map((entry) => [
      new Date(entry.timestamp).toLocaleString('es-PY'),
      getUserDisplay(entry),
      getActionMeta(entry.action).label,
      entry.details || '',
      entry.registerId || '',
      entry.amount !== undefined ? formatCurrency(entry.amount) : '',
      entry.previousBalance !== undefined ? formatCurrency(entry.previousBalance) : '',
      entry.newBalance !== undefined ? formatCurrency(entry.newBalance) : ''
    ])

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const bom = '\uFEFF'
    const blob = new Blob([bom, csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_log_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!canViewAuditLog) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Shield className="h-5 w-5 text-red-500" />
              Acceso denegado
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-muted-foreground">
              No tienes permisos para ver el registro de auditoria.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-7xl w-[95vw] max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-5 border-b bg-white dark:bg-gray-950">
          <DialogTitle className="flex flex-wrap items-center gap-2 text-xl">
            <Shield className="h-5 w-5 text-primary" />
            Registro de auditoria
            <Badge variant="outline">{summary.total} eventos</Badge>
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Historial completo de operaciones de caja con filtros y exportacion.
          </p>
        </DialogHeader>

        <div className="px-6 py-4 border-b bg-gray-50/60 dark:bg-gray-900/30 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Aperturas</p>
              <p className="text-sm font-semibold">{summary.openings}</p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Cierres</p>
              <p className="text-sm font-semibold">{summary.closings}</p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Ventas</p>
              <p className="text-sm font-semibold">{summary.sales}</p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Entradas</p>
              <p className="text-sm font-semibold text-blue-700">{formatCurrency(summary.cashIn)}</p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Salidas</p>
              <p className="text-sm font-semibold text-amber-700">{formatCurrency(summary.cashOut)}</p>
            </div>
            <div className="rounded-lg border bg-background px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Flujo neto</p>
              <p className={`text-sm font-semibold ${summary.netFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {formatCurrency(summary.netFlow)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
            <div className="relative xl:col-span-2">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por accion, detalle, usuario o id"
                className="pl-9"
              />
            </div>

            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las acciones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {getActionMeta(action).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedRegister} onValueChange={setSelectedRegister}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las cajas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las cajas</SelectItem>
                {registers.map((register) => (
                  <SelectItem key={register.id} value={register.id}>
                    {register.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Todos los usuarios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los usuarios</SelectItem>
                {uniqueUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <Filter className="h-4 w-4 mr-2" />
                Limpiar filtros
              </Button>
              <Button variant="outline" size="sm" onClick={loadAuditLog} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Actualizando' : 'Actualizar'}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSortOrder((prev) => prev === 'desc' ? 'asc' : 'desc')}>
                <ArrowUpDown className="h-4 w-4 mr-2" />
                {sortOrder === 'desc' ? 'Mas recientes' : 'Mas antiguos'}
              </Button>
              {canExportData && (
                <Button variant="outline" size="sm" onClick={exportAuditLog}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar CSV
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-b text-xs text-muted-foreground flex items-center gap-2 bg-white dark:bg-gray-950">
          <ListFilter className="h-3.5 w-3.5" />
          Mostrando {filteredLog.length} de {auditLog.length} eventos
        </div>

        <div className="px-6 pb-6 pt-2 flex-1 overflow-hidden">
          <div className="border rounded-xl overflow-hidden bg-white dark:bg-gray-950 shadow-sm h-full flex flex-col">
            <div className="hidden md:grid grid-cols-[170px_220px_220px_1fr_160px] gap-3 px-5 py-3 border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <div>Fecha y hora</div>
              <div>Usuario</div>
              <div>Accion</div>
              <div>Detalle</div>
              <div className="text-right">Monto</div>
            </div>

            <ScrollArea className="flex-1">
              {filteredLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <div className="h-14 w-14 rounded-full bg-muted/60 flex items-center justify-center mb-3">
                    <Shield className="h-7 w-7 opacity-35" />
                  </div>
                  <p className="font-medium">No se encontraron registros</p>
                  <p className="text-sm mt-1">Ajusta filtros o fechas para ver actividad.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredLog.map((entry) => {
                    const actionType = getActionMeta(entry.action)
                    const IconComponent = actionType.icon

                    return (
                      <div
                        key={entry.id}
                        className="px-4 md:px-5 py-4 hover:bg-gray-50/60 dark:hover:bg-gray-900/50 transition-colors"
                      >
                        <div className="flex flex-col md:grid md:grid-cols-[170px_220px_220px_1fr_160px] md:items-center gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {new Date(entry.timestamp).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="h-3 w-3" />
                              {new Date(entry.timestamp).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-3 cursor-help min-w-0">
                                  <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 font-semibold text-xs shrink-0">
                                    {(getUserDisplay(entry).charAt(0) || 'U').toUpperCase()}
                                  </div>
                                  <p className="text-sm font-medium truncate">
                                    {getUserDisplay(entry)}
                                  </p>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" sideOffset={8}>
                                {entry.userId ? `ID: ${entry.userId}` : 'Sin ID de usuario'}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <div>
                            <Badge variant="outline" className={`${actionType.color} py-1 pl-1 pr-3 gap-2 font-normal border`}>
                              <span className="p-1 rounded-full bg-white/50">
                                <IconComponent className="h-3 w-3" />
                              </span>
                              {actionType.label}
                            </Badge>
                          </div>

                          <div className="min-w-0">
                            <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                              {entry.details || 'Sin detalle'}
                            </p>
                            {entry.registerId && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground mt-1 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                <Shield className="h-2.5 w-2.5" />
                                {entry.registerId}
                              </span>
                            )}
                          </div>

                          <div className="md:text-right">
                            {entry.amount !== undefined ? (
                              <div>
                                <p className={`font-mono font-semibold text-sm ${entry.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                  {entry.amount > 0 ? '+' : ''}{formatCurrency(entry.amount)}
                                </p>
                                {entry.newBalance !== undefined && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    Saldo: {formatCurrency(entry.newBalance)}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">-</p>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
