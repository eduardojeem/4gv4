'use client'

import React, { useState, useEffect } from 'react'
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
  Download, Save, ArrowLeft
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCashRegisterContext } from '../contexts/CashRegisterContext'

export default function CashRegisterPage() {
  const { 
    getCurrentRegister, 
    registers, 
    activeRegisterId,
    cashReport,
    generateCashReportForRange,
    exportCashReportCSV,
    registerZClosure,
    cashHistory,
    fetchHistory,
    openRegister,
    addMovement
  } = useCashRegisterContext()

  const [reportStart, setReportStart] = useState('')
  const [reportEnd, setReportEnd] = useState('')
  const [isOpenRegisterDialogOpen, setIsOpenRegisterDialogOpen] = useState(false)
  const [openingAmount, setOpeningAmount] = useState('0')
  const [openingNote, setOpeningNote] = useState('')

  // Movement Dialog State
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false)
  const [movementType, setMovementType] = useState<'in' | 'out'>('in')
  const [movementAmount, setMovementAmount] = useState('')
  const [movementNote, setMovementNote] = useState('')

  useEffect(() => {
    fetchHistory()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const registerName = registers.find(r => r.id === activeRegisterId)?.name || 'Caja'
  const register = getCurrentRegister
  const movements = [...register.movements].reverse()

  // Generate initial report
  useEffect(() => {
    if (!cashReport) {
      generateCashReportForRange()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
              <Badge variant={register.isOpen ? "default" : "secondary"}>
                {register.isOpen ? 'Abierta' : 'Cerrada'}
              </Badge>
              <span>•</span>
              <span>{new Date().toLocaleDateString('es-PY', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {register.isOpen && (
            <>
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
            </>
          )}
          {!register.isOpen && (
            <Button onClick={() => setIsOpenRegisterDialogOpen(true)}>
              Abrir Caja
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex-1 flex flex-col">
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-4">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="report">Reporte</TabsTrigger>
          <TabsTrigger value="history">Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo Actual</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(register.balance)}</div>
                <p className="text-xs text-muted-foreground">En caja ahora mismo</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos (Turno)</CardTitle>
                <ArrowUpCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(movements.filter(m => m.type === 'in' || m.type === 'sale').reduce((acc, m) => acc + m.amount, 0))}
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
                  {formatCurrency(movements.filter(m => m.type === 'out').reduce((acc, m) => acc + m.amount, 0))}
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
              <ScrollArea className="h-[400px] w-full pr-4">
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
                            {new Date(movement.timestamp).toLocaleString()}
                            {movement.note && ` • ${movement.note}`}
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
                    onClick={() => generateCashReportForRange(
                      reportStart ? new Date(reportStart).toISOString() : undefined,
                      reportEnd ? new Date(reportEnd).toISOString() : undefined
                    )}
                  >
                    <RefreshCcw className="h-4 w-4 mr-2" />
                    Actualizar
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportCashReportCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {cashReport ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex justify-between">
                    <span>Resumen Financiero</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {new Date(cashReport.periodStart).toLocaleDateString()} - {new Date(cashReport.periodEnd).toLocaleDateString()}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Saldo Inicial</span>
                      <div className="text-lg font-bold">{formatCurrency(cashReport.openingBalance)}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Ingresos Totales</span>
                      <div className="text-lg font-bold text-green-600">{formatCurrency(cashReport.incomes)}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Egresos Totales</span>
                      <div className="text-lg font-bold text-red-600">{formatCurrency(cashReport.expenses)}</div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Saldo Final Calc.</span>
                      <div className="text-lg font-bold text-primary">{formatCurrency(cashReport.closingBalance)}</div>
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
                    <span className="font-bold">{formatCurrency(cashReport.cashSales)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-blue-500" />
                      <span>Tarjeta</span>
                    </div>
                    <span className="font-bold">{formatCurrency(cashReport.cardSales)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-purple-500" />
                      <span>Transferencia</span>
                    </div>
                    <span className="font-bold">{formatCurrency(cashReport.transferSales)}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCcw className="h-4 w-4 text-orange-500" />
                      <span>Mixto</span>
                    </div>
                    <span className="font-bold">{formatCurrency(cashReport.mixedSales)}</span>
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
                    <Button className="w-full" onClick={registerZClosure}>
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
              <CardTitle>Historial de Cierres Z</CardTitle>
            </CardHeader>
            <CardContent>
              {cashHistory.length > 0 ? (
                <div className="rounded-md border">
                  <div className="grid grid-cols-5 border-b bg-muted/50 p-4 font-medium text-sm">
                    <div>Fecha</div>
                    <div>Saldo Inicial</div>
                    <div>Saldo Final</div>
                    <div>Ventas</div>
                    <div>Notas</div>
                  </div>
                  <div className="max-h-[500px] overflow-y-auto">
                    {cashHistory.map((item, i) => {
                      const totalSales = (item.sales_total_cash || 0) + (item.sales_total_card || 0) + (item.sales_total_transfer || 0) + (item.sales_total_mixed || 0)
                      // Fallback calculation if detailed fields are missing but totals exist
                      const salesDisplay = totalSales > 0 ? totalSales : ((item.closing_balance || 0) - (item.opening_balance || 0) + (item.expense_total || 0))
                      
                      return (
                        <div key={i} className="grid grid-cols-5 p-4 border-b last:border-0 text-sm hover:bg-muted/20">
                          <div>{new Date(item.date || item.periodEnd).toLocaleString()}</div>
                          <div>{formatCurrency(item.opening_balance || item.openingBalance || 0)}</div>
                          <div className="font-bold">{formatCurrency(item.closing_balance || item.closingBalance || 0)}</div>
                          <div className="text-green-600">{formatCurrency(salesDisplay)}</div>
                          <div className="truncate text-muted-foreground">{item.notes || '-'}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-40 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                  <div className="text-center">
                    <History className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No hay historial de cierres disponible</p>
                  </div>
                </div>
              )}
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
              openRegister(amount, openingNote)
              setIsOpenRegisterDialogOpen(false)
              setOpeningAmount('0')
              setOpeningNote('')
            }}>Abrir Caja</Button>
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
                addMovement(movementType, amount, movementNote)
                setIsMovementDialogOpen(false)
              }}
            >
              {movementType === 'in' ? 'Registrar Ingreso' : 'Registrar Egreso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
