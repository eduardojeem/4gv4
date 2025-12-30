'use client'

import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  BarChart3, Calendar, Download, Printer, Save, 
  ArrowUpCircle, ArrowDownCircle, DollarSign, History,
  FileText, TrendingUp, CreditCard, Banknote, RefreshCcw
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { CashRegisterState, CashMovement } from '../types'

interface CashReportData {
  periodStart: string
  periodEnd: string
  openingBalance: number
  closingBalance: number
  incomes: number
  expenses: number
  cashSales: number
  cardSales: number
  transferSales: number
  mixedSales: number
  movementsCount: number
}

interface CashRegisterDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  register: CashRegisterState
  registerName: string
  cashReport: CashReportData | null
  onGenerateReport: (start?: string, end?: string) => Promise<void>
  onExportCSV: () => void
  onZClosure: () => void
}

export function CashRegisterDetailsModal({
  isOpen,
  onClose,
  register,
  registerName,
  cashReport,
  onGenerateReport,
  onExportCSV,
  onZClosure
}: CashRegisterDetailsModalProps) {
  const [reportStart, setReportStart] = useState('')
  const [reportEnd, setReportEnd] = useState('')

  // Initial load of report when tab changes or modal opens
  useEffect(() => {
    if (isOpen && !cashReport) {
      onGenerateReport()
    }
  }, [isOpen])

  const movements = [...register.movements].reverse()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col dark:bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-primary" />
            Detalles de Caja - {registerName}
            <Badge variant={register.isOpen ? "default" : "secondary"} className="ml-2">
              {register.isOpen ? 'Abierta' : 'Cerrada'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="overview">Resumen y Movimientos</TabsTrigger>
            <TabsTrigger value="report">Reporte Detallado</TabsTrigger>
            <TabsTrigger value="history">Historial de Cierres</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex-1 overflow-y-auto pr-1">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Saldo Actual</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(register.balance)}</div>
                  <p className="text-xs text-muted-foreground">
                    En caja ahora mismo
                  </p>
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
                  <p className="text-xs text-muted-foreground">
                    Transacciones registradas
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card className="col-span-4">
              <CardHeader>
                <CardTitle>Últimos Movimientos</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px] w-full pr-4">
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
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="report" className="flex-1 overflow-y-auto">
            <div className="space-y-4">
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
                        onClick={() => onGenerateReport(
                          reportStart ? new Date(reportStart).toISOString() : undefined,
                          reportEnd ? new Date(reportEnd).toISOString() : undefined
                        )}
                      >
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Actualizar
                      </Button>
                      <Button size="sm" variant="outline" onClick={onExportCSV}>
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
                        <Button className="w-full" onClick={onZClosure}>
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
            </div>
          </TabsContent>

          <TabsContent value="history">
            <div className="flex items-center justify-center h-64 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
              <div className="text-center">
                <History className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Historial de cierres anteriores disponible próximamente</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
