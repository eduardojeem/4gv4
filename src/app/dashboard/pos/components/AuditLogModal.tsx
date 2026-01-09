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
  XCircle, Clock, Eye
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCashRegisterContext, AuditLogEntry } from '../contexts/CashRegisterContext'

interface AuditLogModalProps {
  isOpen: boolean
  onClose: () => void
}

const ACTION_TYPES = {
  REGISTER_OPEN: { label: 'Apertura de Caja', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  REGISTER_CLOSE: { label: 'Cierre de Caja', color: 'bg-red-100 text-red-800', icon: XCircle },
  CASH_IN: { label: 'Ingreso de Efectivo', color: 'bg-blue-100 text-blue-800', icon: DollarSign },
  CASH_OUT: { label: 'Egreso de Efectivo', color: 'bg-orange-100 text-orange-800', icon: DollarSign },
  CASH_SALE: { label: 'Venta', color: 'bg-purple-100 text-purple-800', icon: DollarSign },
  Z_CLOSURE: { label: 'Cierre Z', color: 'bg-gray-100 text-gray-800', icon: Shield },
  CASH_COUNT: { label: 'Arqueo de Caja', color: 'bg-yellow-100 text-yellow-800', icon: Eye },
  PERMISSION_CHANGE: { label: 'Cambio de Permisos', color: 'bg-indigo-100 text-indigo-800', icon: Shield },
  ERROR: { label: 'Error', color: 'bg-red-100 text-red-800', icon: AlertTriangle }
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
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b">
              <div className="grid grid-cols-12 gap-4 text-sm font-medium">
                <div className="col-span-2">Fecha/Hora</div>
                <div className="col-span-2">Usuario</div>
                <div className="col-span-2">Acción</div>
                <div className="col-span-3">Detalles</div>
                <div className="col-span-1">Caja</div>
                <div className="col-span-2">Monto/Saldo</div>
              </div>
            </div>
            
            <ScrollArea className="h-[500px]">
              <div className="divide-y">
                {filteredLog.map((entry) => {
                  const actionType = ACTION_TYPES[entry.action as keyof typeof ACTION_TYPES]
                  const IconComponent = actionType?.icon || AlertTriangle

                  return (
                    <div key={entry.id} className="px-4 py-3 hover:bg-muted/20">
                      <div className="grid grid-cols-12 gap-4 items-center text-sm">
                        <div className="col-span-2">
                          <div className="font-medium">
                            {new Date(entry.timestamp).toLocaleDateString('es-PY')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleTimeString('es-PY')}
                          </div>
                        </div>
                        
                        <div className="col-span-2">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{entry.userName}</span>
                          </div>
                        </div>
                        
                        <div className="col-span-2">
                          <Badge className={actionType?.color || 'bg-gray-100 text-gray-800'}>
                            <IconComponent className="h-3 w-3 mr-1" />
                            {actionType?.label || entry.action}
                          </Badge>
                        </div>
                        
                        <div className="col-span-3">
                          <p className="text-sm">{entry.details}</p>
                        </div>
                        
                        <div className="col-span-1">
                          <Badge variant="outline" className="text-xs">
                            {entry.registerId}
                          </Badge>
                        </div>
                        
                        <div className="col-span-2">
                          {entry.amount && (
                            <div className={`font-medium ${entry.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {entry.amount > 0 ? '+' : ''}{formatCurrency(entry.amount)}
                            </div>
                          )}
                          {entry.newBalance !== undefined && (
                            <div className="text-xs text-muted-foreground">
                              Saldo: {formatCurrency(entry.newBalance)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
                
                {filteredLog.length === 0 && (
                  <div className="px-4 py-8 text-center text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No se encontraron entradas de auditoría</p>
                    {(searchTerm || selectedAction !== 'all' || selectedRegister !== 'all') && (
                      <p className="text-sm mt-2">
                        Intenta ajustar los filtros de búsqueda
                      </p>
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