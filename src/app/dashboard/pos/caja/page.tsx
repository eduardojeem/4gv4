'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  ArrowUpCircle, ArrowDownCircle, DollarSign, History,
  FileText, TrendingUp, CreditCard, Banknote, RefreshCcw,
  Download, Save, ArrowLeft, Calculator, Shield, Settings,
  CheckCircle, AlertTriangle, BarChart3
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCashRegister } from '@/hooks/useCashRegister'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { useCashRegisterContext } from '../contexts/CashRegisterContext'
import { ZClosureHistoryModal } from '../components/ZClosureHistoryModal'
import { AuditLogModal } from '../components/AuditLogModal'
import { ConnectionStatus } from '../components/ConnectionStatus'
import { CashCountModal } from '../components/CashCountModal'
import { PermissionsModal } from '../components/PermissionsModal'
import { CashRegisterAnalytics } from '../components/CashRegisterAnalytics'

export default function CashRegisterPage() {
  const {
    currentSession,
    registers,
    loadRegisters,
    checkOpenSession,
    openRegister,
    closeRegister,
    addCashIn,
    addCashOut,
    getSessionReport
  } = useCashRegister()
  
  const {
    userPermissions,
    setUserPermissions,
    connectionStatus,
    syncPendingOperations,
    auditLog,
    performCashCount,
    calculateDiscrepancy,
    zClosureHistory
  } = useCashRegisterContext()
  
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>('')

  const [reportStart, setReportStart] = useState('')
  const [reportEnd, setReportEnd] = useState('')
  const [isOpenRegisterDialogOpen, setIsOpenRegisterDialogOpen] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('0')
  const [openingNote, setOpeningNote] = useState('')
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)

  // Movement Dialog State
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false)
  const [movementType, setMovementType] = useState<'in' | 'out'>('in')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementNote, setMovementNote] = useState('')

  // New modal states
  const [isCashCountModalOpen, setIsCashCountModalOpen] = useState(false)
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false)
  const [isAuditLogModalOpen, setIsAuditLogModalOpen] = useState(false)
  const [isZClosureHistoryModalOpen, setIsZClosureHistoryModalOpen] = useState(false)

  useEffect(() => {
    loadRegisters()
  }, [loadRegisters])

  useEffect(() => {
    if (!selectedRegisterId && registers && registers.length > 0) {
      const first = registers[0].id
      setSelectedRegisterId(first)
      checkOpenSession(first)
    }
  }, [registers, selectedRegisterId, checkOpenSession])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('pos_selected_register_id')
        if (saved) {
          setSelectedRegisterId(saved)
          checkOpenSession(saved)
        }
      }
    } catch {}
  }, [checkOpenSession])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && selectedRegisterId) {
        localStorage.setItem('pos_selected_register_id', selectedRegisterId)
      }
    } catch {}
  }, [selectedRegisterId])

  const registerName = registers.find(r => r.id === selectedRegisterId)?.name || 'Caja'
  const isRegisterOpen = !!currentSession
  const movements = currentSession ? [...currentSession.movements].reverse() : []

  // Generate initial report
  const sessionReport = getSessionReport() || null
  const discrepancy = calculateDiscrepancy()

  const methodTotals = useMemo(() => {
    const sales = movements.filter((m: any) => m.type === 'sale')
    const detect = (m: any) => {
      if (m.payment_method) return m.payment_method
      const note = String((m.reason || m.note || '')).toLowerCase()
      if (note.includes('card') || note.includes('tarjeta')) return 'card'
      if (note.includes('transfer')) return 'transfer'
      if (note.includes('mixed') || note.includes('mixta')) return 'mixed'
      return 'cash'
    }
    const totals = { cash: 0, card: 0, transfer: 0, mixed: 0 }
    for (const s of sales) {
      const m = detect(s)
      totals[m as 'cash'|'card'|'transfer'|'mixed'] += Number(s.amount || 0)
    }
    return totals
  }, [movements])

  return (
    <div className="flex flex-col h-full p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/pos">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Detalles de Caja - {registerName}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={isRegisterOpen ? "default" : "secondary"}>
                {isRegisterOpen ? 'Abierta' : 'Cerrada'}
              </Badge>
              <span>•</span>
              <span>{new Date().toLocaleDateString('es-PY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Caja:</span>
              <Select value={selectedRegisterId} onValueChange={(val) => { setSelectedRegisterId(val); checkOpenSession(val) }}>
                <SelectTrigger className="h-8 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {registers.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <ConnectionStatus 
            status={connectionStatus}
            onSync={syncPendingOperations}
          />
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPermissionsModalOpen(true)}
          >
            <Shield className="mr-2 h-4 w-4" />
            Permisos
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAuditLogModalOpen(true)}
          >
            <FileText className="mr-2 h-4 w-4" />
            Auditoría
          </Button>
          
          {isRegisterOpen && (
            <>
              <Button 
                variant="outline" 
                className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700" 
                onClick={() => setIsCashCountModalOpen(true)}
              >
                <Calculator className="mr-2 h-4 w-4" />
                Arqueo
              </Button>
              
              {userPermissions.canAddCashIn && (
                <Button 
                  variant="outline" 
                  className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700" 
                  onClick={() => {
                    setMovementType('in')
                    setMovementAmount('')
                    setMovementNote('')
                    setIsMovementDialogOpen(true)
                  }}
                >
                  <ArrowUpCircle className="mr-2 h-4 w-4" />
                  Ingreso
                </Button>
              )}
              
              {userPermissions.canAddCashOut && (
                <Button 
                  variant="outline" 
                  className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" 
                  onClick={() => {
                    setMovementType('out')
                    setMovementAmount('')
                    setMovementNote('')
                    setIsMovementDialogOpen(true)
                  }}
                >
                  <ArrowDownCircle className="mr-2 h-4 w-4" />
                  Egreso
                </Button>
              )}
              
              {userPermissions.canCloseRegister && (
                <Button 
                  variant="destructive"
                  onClick={() => setIsCloseDialogOpen(true)}
                >
                  Cerrar Caja
                </Button>
              )}
            </>
          )}
          {!isRegisterOpen && userPermissions.canOpenRegister && (
            <Button onClick={() => setIsOpenRegisterDialogOpen(true)}>
              Abrir Caja
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex-1 flex flex-col">
        <TabsList className="grid w-full max-w-md grid-cols-4 mb-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="report">Reporte</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
          <TabsTrigger value="audit">Auditoría</TabsTrigger>
        </TabsList>

  <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo Actual</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(sessionReport?.currentBalance || 0)}</div>
                <p className="text-xs text-muted-foreground">En caja ahora mismo</p>
                {Math.abs(discrepancy) > 0 && (
                  <p className="text-xs text-yellow-600 mt-1">
                    Diferencia: {discrepancy >= 0 ? '+' : ''}{formatCurrency(discrepancy)}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos (Turno)</CardTitle>
                <ArrowUpCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(sessionReport ? (sessionReport.totalSales + sessionReport.totalCashIn) : 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Egresos (Turno)</CardTitle>
                <ArrowDownCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(sessionReport ? sessionReport.totalCashOut : 0)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Movimientos</CardTitle>
                <History className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{movements.length}</div>
                <p className="text-xs text-muted-foreground">Transacciones registradas</p>
              </CardContent>
            </Card>
          </div>

          <Card className="flex-1">
            <CardHeader>
              <CardTitle>Últimos Movimientos</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[360px] w-full pr-4">
                <div className="space-y-4">
                  {movements.map((movement, i) => (
                    <div key={movement.id || i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-full ${
                          movement.type === 'sale' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                          movement.type === 'in' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                          movement.type === 'out' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {movement.type === 'sale' && <DollarSign className="h-4 w-4" />}
                          {movement.type === 'in' && <ArrowUpCircle className="h-4 w-4" />}
                          {movement.type === 'out' && <ArrowDownCircle className="h-4 w-4" />}
                          {(movement.type === 'opening' || movement.type === 'closing') && <History className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium capitalize">
                            {movement.type === 'sale' ? 'Venta' :
                             movement.type === 'in' ? 'Ingreso de Caja' :
                             movement.type === 'out' ? 'Retiro de Caja' :
                             movement.type === 'opening' ? 'Apertura de Caja' :
                             'Cierre de Caja'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date((movement as any).timestamp || (movement as any).created_at).toLocaleString()}
                            {((movement as any).note || (movement as any).reason) && ` • ${((movement as any).note || (movement as any).reason)}`}
                          </p>
                        </div>
                      </div>
                      <div className={`font-bold ${
                        movement.type === 'out' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {movement.type === 'out' ? '-' : '+'}{formatCurrency(movement.amount)}
                      </div>
                    </div>
                  ))}
                  {movements.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No hay movimientos registrados en este turno
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="report" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filtros de Reporte</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium">Desde</label>
                  <Input 
                    type="datetime-local" 
                    value={reportStart}
                    onChange={e => setReportStart(e.target.value)} 
                    className="h-9"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium">Hasta</label>
                  <Input 
                    type="datetime-local" 
                    value={reportEnd}
                    onChange={e => setReportEnd(e.target.value)} 
                    className="h-9"
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => { /* Reporte basado en sesión actual */ }}
                  >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Actualizar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    if (!sessionReport) return
                    const headers = ['periodStart','periodEnd','openingBalance','incomes','expenses','closingBalance']
                    const values = [
                      new Date(currentSession?.opened_at || Date.now()).toISOString(),
                      new Date().toISOString(),
                      sessionReport.openingBalance,
                      sessionReport.totalSales + sessionReport.totalCashIn,
                      sessionReport.totalCashOut,
                      sessionReport.currentBalance
                    ]
                    const row = values.map(v => JSON.stringify(v ?? '')).join(',')
                    const csv = headers.join(',') + '\n' + row
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `cash_report_${new Date().toISOString().slice(0,10)}.csv`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}>
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {sessionReport ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex justify-between">
                    <span>Resumen Financiero</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {new Date(currentSession?.opened_at || Date.now()).toLocaleDateString()} - {new Date().toLocaleDateString()}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Saldo Inicial</span>
                      <div className="text-lg font-bold">{formatCurrency(sessionReport.openingBalance)}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Ingresos Totales</span>
                      <div className="text-lg font-bold text-green-600">{formatCurrency(sessionReport.totalSales + sessionReport.totalCashIn)}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Egresos Totales</span>
                      <div className="text-lg font-bold text-red-600">{formatCurrency(sessionReport.totalCashOut)}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Saldo Final Calc.</span>
                      <div className="text-lg font-bold text-primary">{formatCurrency(sessionReport.currentBalance)}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Ventas por Método</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-green-500" />
                      <span>Efectivo</span>
                    </div>
                    <span className="font-bold">{formatCurrency(methodTotals.cash)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-blue-500" />
                      <span>Tarjeta</span>
                    </div>
                    <span className="font-bold">{formatCurrency(methodTotals.card)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-500" />
                      <span>Transferencia</span>
                    </div>
                    <span className="font-bold">{formatCurrency(methodTotals.transfer)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCcw className="h-4 w-4 text-orange-500" />
                      <span>Mixto</span>
                    </div>
                    <span className="font-bold">{formatCurrency(methodTotals.mixed)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Acciones de Cierre</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      El Cierre Z finalizará el turno actual y registrará los totales en el historial. Esta acción no se puede deshacer.
                    </p>
                    <Button className="w-full" onClick={() => {
                      if (!currentSession) return
                      const closingBalance = currentSession.movements.reduce((sum, m) => {
                        if (m.type === 'opening' || m.type === 'sale' || m.type === 'cash_in') return sum + m.amount
                        if (m.type === 'cash_out') return sum - m.amount
                        return sum
                      }, 0)
                      closeRegister(closingBalance)
                    }}>
                      <Save className="h-4 w-4 mr-2" />
                      Realizar Cierre Z
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-muted-foreground">
              Cargando datos del reporte...
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Historial de Cierres Z</span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsZClosureHistoryModalOpen(true)}
                  >
                    <History className="h-4 w-4 mr-2" />
                    Ver Historial Completo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAuditLogModalOpen(true)}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Registro de Auditoría
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {zClosureHistory.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground mb-4">
                    Mostrando los últimos 5 cierres. Haga clic en "Ver Historial Completo" para ver todos los registros con filtros avanzados.
                  </div>
                  <div className="rounded-md border">
                    <div className="grid grid-cols-6 border-b bg-muted/50 p-4 font-medium text-sm">
                      <div>Fecha</div>
                      <div>Saldo Inicial</div>
                      <div>Saldo Final</div>
                      <div>Ventas</div>
                      <div>Diferencia</div>
                      <div>Estado</div>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto">
                      {zClosureHistory.slice(0, 5).map((closure, i) => (
                        <div key={closure.id} className="grid grid-cols-6 p-4 border-b last:border-0 text-sm hover:bg-muted/20">
                          <div>{new Date(closure.date).toLocaleString()}</div>
                          <div>{formatCurrency(closure.openingBalance)}</div>
                          <div className="font-bold">{formatCurrency(closure.closingBalance)}</div>
                          <div className="text-green-600">{formatCurrency(closure.totalSales)}</div>
                          <div className={`font-bold ${Math.abs(closure.discrepancy) < 1 ? 'text-green-600' : 'text-red-600'}`}>
                            {closure.discrepancy >= 0 ? '+' : ''}{formatCurrency(closure.discrepancy)}
                          </div>
                          <div>
                            {Math.abs(closure.discrepancy) < 1 ? (
                              <Badge variant="default" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Sin diferencias
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Con diferencias
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                  <History className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="mb-4">No hay historial de cierres disponible</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsZClosureHistoryModalOpen(true)}
                  >
                    <History className="h-4 w-4 mr-2" />
                    Ver Historial Completo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Registro de Auditoría</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAuditLogModalOpen(true)}
                >
                  Ver Completo
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full pr-4">
                <div className="space-y-2">
                  {auditLog.slice(0, 10).map((entry, i) => (
                    <div key={i} className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="text-xs">
                          {entry.action.replace('_', ' ')}
                        </Badge>
                        <span className="text-sm">{entry.user || 'Sistema'}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {auditLog.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No hay entradas de auditoría
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isOpenRegisterDialogOpen} onOpenChange={setIsOpenRegisterDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir Caja</DialogTitle>
            <DialogDescription>
              Ingrese el monto inicial en caja para comenzar el turno.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="amount">Monto Inicial</Label>
              <Input
                id="amount"
                type="number"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="note">Nota (Opcional)</Label>
              <Input
                id="note"
                value={openingNote}
                onChange={(e) => setOpeningNote(e.target.value)}
                placeholder="Ej. Turno mañana"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpenRegisterDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => {
              const amount = parseFloat(openingAmount) || 0
              const id = selectedRegisterId || (registers[0]?.id) || 'principal'
              setSelectedRegisterId(id)
              openRegister(id, amount)
              setIsOpenRegisterDialogOpen(false)
              setOpeningAmount('0')
              setOpeningNote('')
            }}>Abrir Caja</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Register Confirm */}
      <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar Caja</DialogTitle>
            <DialogDescription>
              Confirmar cierre del turno actual. El saldo permanecerá registrado y podrás ver el detalle en reportes.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloseDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => { 
              if (!currentSession) { setIsCloseDialogOpen(false); return }
              const closingBalance = currentSession.movements.reduce((sum, m) => {
                if (m.type === 'opening' || m.type === 'sale' || m.type === 'cash_in') return sum + m.amount
                if (m.type === 'cash_out') return sum - m.amount
                return sum
              }, 0)
              closeRegister(closingBalance)
              setIsCloseDialogOpen(false) 
            }}>Cerrar Caja</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{movementType === 'in' ? 'Registrar Ingreso' : 'Registrar Egreso'}</DialogTitle>
            <DialogDescription>
              {movementType === 'in' 
                ? 'Ingrese el monto a agregar a la caja.' 
                : 'Ingrese el monto a retirar de la caja.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="mov-amount">Monto</Label>
              <Input
                id="mov-amount"
                type="number"
                value={movementAmount}
                onChange={(e) => setMovementAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="mov-note">Motivo / Nota</Label>
              <Input
                id="mov-note"
                value={movementNote}
                onChange={(e) => setMovementNote(e.target.value)}
                placeholder={movementType === 'in' ? "Ej. Cambio inicial" : "Ej. Pago a proveedor"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMovementDialogOpen(false)}>Cancelar</Button>
            <Button 
              variant={movementType === 'out' ? "destructive" : "default"}
              onClick={() => {
                const amount = parseFloat(movementAmount)
                if (!amount || amount <= 0) {
                  return
                }
                if (movementType === 'in') {
                  addCashIn(amount, movementNote || 'Ingreso')
                } else {
                  addCashOut(amount, movementNote || 'Egreso')
                }
                setIsMovementDialogOpen(false)
              }}
            >
              {movementType === 'in' ? 'Registrar Ingreso' : 'Registrar Egreso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash Count Modal */}
      <CashCountModal
        isOpen={isCashCountModalOpen}
        onClose={() => setIsCashCountModalOpen(false)}
        onConfirm={(count) => performCashCount(count)}
        systemBalance={sessionReport?.currentBalance || 0}
      />

      {/* Permissions Modal */}
      <PermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
        currentPermissions={userPermissions}
        onSave={setUserPermissions}
      />

      {/* Audit Log Modal */}
      <AuditLogModal
        isOpen={isAuditLogModalOpen}
        onClose={() => setIsAuditLogModalOpen(false)}
        auditLog={auditLog}
      />

      {/* Z Closure History Modal */}
      <ZClosureHistoryModal
        isOpen={isZClosureHistoryModalOpen}
        onClose={() => setIsZClosureHistoryModalOpen(false)}
        closures={zClosureHistory}
        onExportData={(filteredClosures) => {
          // Custom export logic if needed
          console.log('Exporting closures:', filteredClosures)
        }}
      />
    </div>
  )
}
