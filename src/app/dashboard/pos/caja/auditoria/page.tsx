'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { useCashRegisterContext, AuditLogEntry } from '../../contexts/CashRegisterContext'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { AlertTriangle, ArrowLeft, Download, RefreshCw, Search, Shield } from 'lucide-react'
import { formatCurrency } from '@/lib/currency'

function getUserDisplay(entry: AuditLogEntry) {
  const name = (entry.userName || '').trim()
  const email = (entry.userEmail || '').trim()
  if (name && email && name !== email) return `${name} (${email})`
  return name || email || 'Usuario no identificado'
}

function getActionLabel(action: string) {
  const labels: Record<string, string> = {
    OPENING: 'Apertura',
    REGISTER_OPEN: 'Apertura',
    CLOSING: 'Cierre',
    REGISTER_CLOSE: 'Cierre',
    SALE: 'Venta',
    CASH_SALE: 'Venta',
    CASH_IN: 'Ingreso',
    CASH_OUT: 'Egreso',
    Z_CLOSURE: 'Cierre Z',
    CASH_COUNT: 'Arqueo',
    ERROR: 'Error'
  }
  return labels[action] || action
}

export default function CashRegisterAuditPage() {
  const { user } = useAuth()
  const { auditLog, fetchAuditLog, registers, checkPermission } = useCashRegisterContext()
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedAction, setSelectedAction] = useState('all')
  const [selectedRegister, setSelectedRegister] = useState('all')
  const [selectedUser, setSelectedUser] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const canAccessAudit = user?.role === 'admin' || checkPermission('canViewAuditLog')
  const canExportData = checkPermission('canExportData')

  const loadAudit = async () => {
    setLoading(true)
    try {
      await fetchAuditLog(
        selectedRegister !== 'all' ? selectedRegister : undefined,
        dateFrom || undefined,
        dateTo || undefined
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canAccessAudit) {
      loadAudit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAccessAudit])

  const users = useMemo(() => {
    const map = new Map<string, string>()
    for (const entry of auditLog) {
      map.set(entry.userId || 'system', getUserDisplay(entry))
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label))
  }, [auditLog])

  const actions = useMemo(() => {
    return Array.from(new Set(auditLog.map((entry) => entry.action))).sort()
  }, [auditLog])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null

    return auditLog
      .filter((entry) => {
        if (selectedAction !== 'all' && entry.action !== selectedAction) return false
        if (selectedRegister !== 'all' && entry.registerId !== selectedRegister) return false
        if (selectedUser !== 'all' && entry.userId !== selectedUser) return false

        const ts = new Date(entry.timestamp).getTime()
        if (fromTime && ts < fromTime) return false
        if (toTime && ts > toTime) return false

        if (!q) return true
        const text = `${getActionLabel(entry.action)} ${entry.details || ''} ${getUserDisplay(entry)} ${entry.userId || ''}`.toLowerCase()
        return text.includes(q)
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [auditLog, search, selectedAction, selectedRegister, selectedUser, dateFrom, dateTo])

  const exportCsv = () => {
    if (!canExportData) return
    const headers = ['Fecha/Hora', 'Usuario', 'ID Usuario', 'Accion', 'Detalle', 'Caja', 'Monto', 'Saldo Anterior', 'Saldo Nuevo']
    const rows = filtered.map((entry) => [
      new Date(entry.timestamp).toLocaleString('es-PY'),
      getUserDisplay(entry),
      entry.userId || '',
      getActionLabel(entry.action),
      entry.details || '',
      entry.registerId || '',
      entry.amount !== undefined ? formatCurrency(entry.amount) : '',
      entry.previousBalance !== undefined ? formatCurrency(entry.previousBalance) : '',
      entry.newBalance !== undefined ? formatCurrency(entry.newBalance) : ''
    ])
    const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `auditoria_caja_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!canAccessAudit) {
    return (
      <div className="p-6">
        <div className="max-w-md mx-auto border rounded-xl p-6 text-center">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto mb-3" />
          <h1 className="text-lg font-semibold mb-2">Acceso denegado</h1>
          <p className="text-sm text-muted-foreground mb-4">No tienes permisos para acceder a la auditoria.</p>
          <Link href="/dashboard/pos/caja">
            <Button variant="outline">Volver a Caja</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="rounded-xl border bg-card p-4 md:p-5 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link href="/dashboard/pos/caja">
              <Button variant="outline" size="icon" aria-label="Volver a Caja">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Auditoria de Caja
            </h1>
            <Badge variant="outline">{filtered.length} registros</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadAudit} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            {canExportData && (
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
          <div className="relative xl:col-span-2">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar accion, detalle, usuario, id" className="pl-9" />
          </div>
          <Select value={selectedAction} onValueChange={setSelectedAction}>
            <SelectTrigger><SelectValue placeholder="Todas las acciones" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las acciones</SelectItem>
              {actions.map((action) => (
                <SelectItem key={action} value={action}>{getActionLabel(action)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedRegister} onValueChange={setSelectedRegister}>
            <SelectTrigger><SelectValue placeholder="Todas las cajas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las cajas</SelectItem>
              {registers.map((register) => (
                <SelectItem key={register.id} value={register.id}>{register.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger><SelectValue placeholder="Todos los usuarios" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los usuarios</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="border rounded-xl bg-card shadow-sm overflow-hidden">
        <div className="hidden lg:grid grid-cols-[170px_240px_130px_1fr_130px_130px_130px] gap-3 px-4 py-3 border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div>Fecha/Hora</div>
          <div>Usuario</div>
          <div>Accion</div>
          <div>Detalle</div>
          <div className="text-right">Monto</div>
          <div className="text-right">Saldo ant.</div>
          <div className="text-right">Saldo nuevo</div>
        </div>

        <ScrollArea className="h-[calc(100vh-320px)] min-h-[420px]">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              No hay registros para los filtros seleccionados.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {filtered.map((entry) => (
                <div key={entry.id} className="px-4 py-3 hover:bg-muted/40">
                  <div className="grid lg:grid-cols-[170px_240px_130px_1fr_130px_130px_130px] gap-3 items-start text-sm">
                    <div>
                      <p className="font-medium">{new Date(entry.timestamp).toLocaleDateString('es-PY')}</p>
                      <p className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString('es-PY')}</p>
                    </div>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="truncate cursor-help" title={getUserDisplay(entry)}>
                            {getUserDisplay(entry)}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{entry.userId ? `ID: ${entry.userId}` : 'Sin ID de usuario'}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <Badge variant="outline" className="w-fit">{getActionLabel(entry.action)}</Badge>

                    <div className="break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                      {entry.details || 'Sin detalle'}
                    </div>

                    <div className="text-right font-mono">{entry.amount !== undefined ? formatCurrency(entry.amount) : '-'}</div>
                    <div className="text-right font-mono">{entry.previousBalance !== undefined ? formatCurrency(entry.previousBalance) : '-'}</div>
                    <div className="text-right font-mono">{entry.newBalance !== undefined ? formatCurrency(entry.newBalance) : '-'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  )
}

