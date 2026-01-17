'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Shield, Search, Download, Filter, Calendar,
  User, DollarSign, AlertTriangle, CheckCircle,
  XCircle, Clock, Eye, Lock, ArrowUpCircle, ArrowDownCircle,
  Activity
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCashRegisterContext, AuditLogEntry } from '../contexts/CashRegisterContext'

interface AuditLogModalProps {
  isOpen: boolean
  onClose: () => void
}

// Enhanced Action Types Mapping with better icons and colors
const ACTION_TYPES = {
  // Session Management
  REGISTER_OPEN: { label: 'Apertura de Caja', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle },
  REGISTER_CLOSE: { label: 'Cierre de Caja', color: 'bg-rose-100 text-rose-800 border-rose-200', icon: XCircle },
  Z_CLOSURE: { label: 'Cierre Z', color: 'bg-purple-100 text-purple-800 border-purple-200', icon: Shield },
  
  // Money Flow
  CASH_IN: { label: 'Ingreso de Efectivo', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: ArrowUpCircle },
  CASH_OUT: { label: 'Egreso de Efectivo', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: ArrowDownCircle },
  CASH_SALE: { label: 'Venta Registrada', color: 'bg-green-50 text-green-700 border-green-200', icon: DollarSign },
  
  // Admin & Security
  CASH_COUNT: { label: 'Arqueo de Caja', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: Eye },
  PERMISSION_CHANGE: { label: 'Cambio de Permisos', color: 'bg-gray-100 text-gray-800 border-gray-200', icon: Lock },
  ERROR: { label: 'Error del Sistema', color: 'bg-red-50 text-red-600 border-red-200', icon: AlertTriangle }
}

export function AuditLogModal({ isOpen, onClose }: AuditLogModalProps) {
  const { auditLog, fetchAuditLog, checkPermission, registers } = useCashRegisterContext()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAction, setSelectedAction] = useState<string>('all')
  const [selectedRegister, setSelectedRegister] = useState<string>('all')
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(false)

  // Check permissions
  const canViewAuditLog = checkPermission('canViewAuditLog')
  const canExportData = checkPermission('canExportData')

  useEffect(() => {
    if (isOpen && canViewAuditLog) {
      loadAuditLog()
    }
  }, [isOpen, canViewAuditLog])

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

  const filteredLog = useMemo(() => {
    let filtered = auditLog

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(entry => 
        entry.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.userName.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by action type
    if (selectedAction !== 'all') {
      filtered = filtered.filter(entry => entry.action === selectedAction)
    }

    // Filter by register
    if (selectedRegister !== 'all') {
      filtered = filtered.filter(entry => entry.registerId === selectedRegister)
    }

    // Filter by user
    if (selectedUser !== 'all') {
      filtered = filtered.filter(entry => entry.userId === selectedUser)
    }

    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [auditLog, searchTerm, selectedAction, selectedRegister, selectedUser])

  const uniqueUsers = useMemo(() => {
    const users = new Set(auditLog.map(entry => entry.userName))
    return Array.from(users).sort()
  }, [auditLog])

  const uniqueActions = useMemo(() => {
    const actions = new Set(auditLog.map(entry => entry.action))
    return Array.from(actions).sort()
  }, [auditLog])

  const exportAuditLog = () => {
    if (!canExportData) return

    const headers = [
      'Fecha/Hora', 'Usuario', 'Acción', 'Detalles', 'Caja', 
      'Monto', 'Saldo Anterior', 'Saldo Nuevo'
    ]

    const rows = filteredLog.map(entry => [
      new Date(entry.timestamp).toLocaleString('es-PY'),
      entry.userName,
      ACTION_TYPES[entry.action as keyof typeof ACTION_TYPES]?.label || entry.action,
      entry.details,
      entry.registerId,
      entry.amount ? formatCurrency(entry.amount) : '',
      entry.previousBalance ? formatCurrency(entry.previousBalance) : '',
      entry.newBalance ? formatCurrency(entry.newBalance) : ''
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit_log_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedAction('all')
    setSelectedRegister('all')
    setSelectedUser('all')
    setDateFrom('')
    setDateTo('')
  }

  if (!canViewAuditLog) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Shield className="h-5 w-5 text-red-500" />
              Acceso Denegado
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <p className="text-muted-foreground">
              No tienes permisos para ver el registro de auditoría.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-5 w-5 text-primary" />
            Registro de Auditoría
            <Badge variant="outline" className="ml-2">
              {filteredLog.length} entradas
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filters */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger>
                <SelectValue placeholder="Todas las acciones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                {uniqueActions.map(action => (
                  <SelectItem key={action} value={action}>
                    {ACTION_TYPES[action as keyof typeof ACTION_TYPES]?.label || action}
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
                {registers.map(register => (
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
                {uniqueUsers.map(user => (
                  <SelectItem key={user} value={user}>
                    {user}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              placeholder="Desde"
            />

            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              placeholder="Hasta"
            />
          </div>

          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <Filter className="h-4 w-4 mr-2" />
                Limpiar Filtros
              </Button>
              <Button variant="outline" size="sm" onClick={loadAuditLog} disabled={loading}>
                <Clock className="h-4 w-4 mr-2" />
                {loading ? 'Actualizando...' : 'Actualizar'}
              </Button>
            </div>
            
            {canExportData && (
              <Button variant="outline" size="sm" onClick={exportAuditLog}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            )}
          </div>

          {/* Audit Log Table */}
          <div className="border rounded-xl overflow-hidden bg-white dark:bg-gray-950 shadow-sm">
            <div className="bg-gray-50/80 dark:bg-gray-900/50 px-6 py-3 border-b flex items-center text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <div className="w-[180px]">Fecha / Hora</div>
              <div className="w-[200px]">Usuario</div>
              <div className="w-[220px]">Acción</div>
              <div className="flex-1">Detalles</div>
              <div className="w-[150px] text-right">Monto</div>
            </div>
            
            <ScrollArea className="h-[500px]">
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredLog.map((entry) => {
                  const actionType = ACTION_TYPES[entry.action as keyof typeof ACTION_TYPES]
                  const IconComponent = actionType?.icon || Activity

                  return (
                    <div key={entry.id} className="px-6 py-4 hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors flex items-center gap-4 group">
                      {/* Date & Time */}
                      <div className="w-[180px] shrink-0">
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                          {new Date(entry.timestamp).toLocaleDateString('es-PY', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Clock className="h-3 w-3" />
                          {new Date(entry.timestamp).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      
                      {/* User */}
                      <div className="w-[200px] shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 font-bold text-xs">
                            {entry.userName.charAt(0).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <p className="text-sm font-medium truncate" title={entry.userName}>{entry.userName}</p>
                            <p className="text-[10px] text-muted-foreground truncate">ID: {entry.userId.slice(0,8)}...</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Action Badge */}
                      <div className="w-[220px] shrink-0">
                        <Badge variant="outline" className={`${actionType?.color || 'bg-gray-100 text-gray-700'} py-1 pl-1 pr-3 gap-2 font-normal border`}>
                          <div className="p-1 bg-white/50 rounded-full">
                            <IconComponent className="h-3 w-3" />
                          </div>
                          {actionType?.label || entry.action}
                        </Badge>
                      </div>
                      
                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 dark:text-gray-300 truncate" title={entry.details}>
                          {entry.details}
                        </p>
                        {entry.registerId && (
                           <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground mt-1 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                             <Shield className="h-2.5 w-2.5" /> {entry.registerId}
                           </span>
                        )}
                      </div>
                      
                      {/* Amount */}
                      <div className="w-[150px] shrink-0 text-right">
                        {entry.amount ? (
                          <div>
                            <span className={`text-sm font-bold font-mono ${entry.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {entry.amount > 0 ? '+' : ''}{formatCurrency(entry.amount)}
                            </span>
                            {entry.newBalance !== undefined && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Saldo: {formatCurrency(entry.newBalance)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </div>
                  )
                })}
                
                {filteredLog.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                    <div className="h-16 w-16 bg-gray-50 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4">
                      <Shield className="h-8 w-8 opacity-20" />
                    </div>
                    <p className="text-lg font-medium">No se encontraron registros</p>
                    <p className="text-sm max-w-xs mx-auto mt-1">
                      No hay actividad que coincida con los filtros seleccionados.
                    </p>
                    {(searchTerm || selectedAction !== 'all' || selectedRegister !== 'all') && (
                      <Button variant="link" onClick={clearFilters} className="mt-4">
                        Limpiar todos los filtros
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-4 text-sm">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="font-medium">Aperturas</span>
              </div>
              <p className="text-lg font-bold">
                {filteredLog.filter(e => e.action === 'REGISTER_OPEN').length}
              </p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="font-medium">Cierres</span>
              </div>
              <p className="text-lg font-bold">
                {filteredLog.filter(e => e.action === 'REGISTER_CLOSE').length}
              </p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Movimientos</span>
              </div>
              <p className="text-lg font-bold">
                {filteredLog.filter(e => ['CASH_IN', 'CASH_OUT', 'CASH_SALE'].includes(e.action)).length}
              </p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-purple-500" />
                <span className="font-medium">Cierres Z</span>
              </div>
              <p className="text-lg font-bold">
                {filteredLog.filter(e => e.action === 'Z_CLOSURE').length}
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}