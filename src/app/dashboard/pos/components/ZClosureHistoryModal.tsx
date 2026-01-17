'use client'

import React, { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  History, Search, Download, Eye, Calendar,
  TrendingUp, TrendingDown, AlertTriangle, BarChart3,
  ArrowLeft, Receipt, CreditCard, Wallet, Banknote, User
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCashRegisterContext, ZClosureRecord } from '../contexts/CashRegisterContext'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface ZClosureHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  onViewDetails: (closure: ZClosureRecord) => void
}

export function ZClosureHistoryModal({ isOpen, onClose, onViewDetails }: ZClosureHistoryModalProps) {
  const { zClosureHistory, checkPermission } = useCashRegisterContext()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'week' | 'month'>('all')
  const [selectedClosure, setSelectedClosure] = useState<ZClosureRecord | null>(null)

  const filteredHistory = useMemo(() => {
    let filtered = zClosureHistory

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(closure =>
        closure.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        closure.closedBy.toLowerCase().includes(searchTerm.toLowerCase()) ||
        new Date(closure.date).toLocaleDateString().includes(searchTerm)
      )
    }

    // Filter by period
    if (selectedPeriod !== 'all') {
      const now = new Date()
      const cutoffDate = new Date()

      if (selectedPeriod === 'week') {
        cutoffDate.setDate(now.getDate() - 7)
      } else if (selectedPeriod === 'month') {
        cutoffDate.setMonth(now.getMonth() - 1)
      }

      filtered = filtered.filter(closure =>
        new Date(closure.date) >= cutoffDate
      )
    }

    return filtered.sort((a, b) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime())
  }, [zClosureHistory, searchTerm, selectedPeriod])
  
  // Reset selection when modal closes
  React.useEffect(() => {
      if (!isOpen) setSelectedClosure(null)
  }, [isOpen])
  
  // Also, if onViewDetails prop is called from parent (legacy), select that closure
  // This is a bit of a hack to support both internal and external selection
  // But for the new "Client Detail" style, we might want to default to list if no selection
  // or allow passing an initial selection.
  
  // IMPORTANT: If we want to mimic Client Detail exactly, we might want to start with a closure selected if provided?
  // But usually it starts as a list.

  const handleClosureSelect = (closure: ZClosureRecord) => {
      setSelectedClosure(closure)
  }

  // Prepare chart data (last 7 closures from filtered list)
  const chartData = useMemo(() => {
    return filteredHistory.slice(0, 7).reverse().map(closure => ({
      date: new Date(closure.date).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' }),
      sales: closure.totalSales,
      discrepancy: Math.abs(closure.discrepancy)
    }))
  }, [filteredHistory])

  const exportHistoryCSV = () => {
    if (!checkPermission('canExportData')) {
      return
    }

    const headers = [
      'Fecha', 'Caja', 'Saldo Inicial', 'Saldo Final', 'Saldo Esperado',
      'Discrepancia', 'Ventas Totales', 'Ingresos', 'Egresos',
      'Ventas Efectivo', 'Ventas Tarjeta', 'Ventas Transferencia', 'Ventas Mixto',
      'Movimientos', 'Cerrado Por', 'Notas'
    ]

    const rows = filteredHistory.map(closure => [
      new Date(closure.date).toLocaleDateString(),
      closure.registerId,
      closure.openingBalance,
      closure.closingBalance,
      closure.expectedBalance,
      closure.discrepancy,
      closure.totalSales,
      closure.totalCashIn,
      closure.totalCashOut,
      closure.salesByCash,
      closure.salesByCard,
      closure.salesByTransfer,
      closure.salesByMixed,
      closure.movementsCount,
      closure.closedBy,
      closure.notes || ''
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `historial_cierres_z_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getDiscrepancyBadge = (discrepancy: number) => {
    if (discrepancy === 0) {
      return <Badge variant="default" className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200">Sin diferencia</Badge>
    } else if (Math.abs(discrepancy) <= 10000) { // <= 10k Gs
      return <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200">Diferencia menor</Badge>
    } else {
      return <Badge variant="destructive" className="bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200">Diferencia significativa</Badge>
    }
  }

  const totalSales = filteredHistory.reduce((sum, closure) => sum + closure.totalSales, 0)
  const totalDiscrepancies = filteredHistory.reduce((sum, closure) => sum + Math.abs(closure.discrepancy), 0)
  const averageTicket = filteredHistory.length > 0 ? totalSales / filteredHistory.length : 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 bg-gray-50 dark:bg-gray-950">
        
        {selectedClosure ? (
           // --- DETAIL VIEW ---
           <div className="flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-300">
              {/* Header */}
              <div className="border-b bg-white dark:bg-gray-900 p-4 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                      <Button variant="ghost" size="icon" onClick={() => setSelectedClosure(null)} className="h-8 w-8">
                          <ArrowLeft className="h-5 w-5" />
                      </Button>
                      <div>
                          <DialogTitle className="flex items-center gap-2 text-lg">
                              Cierre del {new Date(selectedClosure.date).toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </DialogTitle>
                          <p className="text-xs text-muted-foreground flex items-center gap-2">
                              <span className="font-mono">{selectedClosure.id.slice(0, 8)}</span>
                              <span>•</span>
                              <span>{new Date(selectedClosure.closedAt).toLocaleTimeString('es-PY')}</span>
                          </p>
                      </div>
                  </div>
                  <div className="flex items-center gap-2">
                      {getDiscrepancyBadge(selectedClosure.discrepancy)}
                  </div>
              </div>

              {/* Scrollable Content */}
              <ScrollArea className="flex-1">
                  <div className="p-6 space-y-6">
                      
                      {/* Top KPI Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <Card className="shadow-sm border-l-4 border-l-emerald-500">
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                  <CardTitle className="text-sm font-medium text-muted-foreground">Ventas Totales</CardTitle>
                                  <Receipt className="h-4 w-4 text-emerald-600" />
                              </CardHeader>
                              <CardContent>
                                  <div className="text-2xl font-bold text-emerald-700">{formatCurrency(selectedClosure.totalSales)}</div>
                                  <p className="text-xs text-muted-foreground mt-1">{selectedClosure.movementsCount} movimientos registrados</p>
                              </CardContent>
                          </Card>
                          
                          <Card className="shadow-sm border-l-4 border-l-blue-500">
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                  <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Final en Caja</CardTitle>
                                  <Wallet className="h-4 w-4 text-blue-600" />
                              </CardHeader>
                              <CardContent>
                                  <div className="text-2xl font-bold text-blue-700">{formatCurrency(selectedClosure.closingBalance)}</div>
                                  <p className="text-xs text-muted-foreground mt-1">Saldo físico declarado</p>
                              </CardContent>
                          </Card>

                          <Card className={`shadow-sm border-l-4 ${selectedClosure.discrepancy === 0 ? 'border-l-gray-400' : selectedClosure.discrepancy > 0 ? 'border-l-green-500' : 'border-l-red-500'}`}>
                              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                  <CardTitle className="text-sm font-medium text-muted-foreground">Diferencia (Arqueo)</CardTitle>
                                  <AlertTriangle className={`h-4 w-4 ${selectedClosure.discrepancy === 0 ? 'text-gray-400' : selectedClosure.discrepancy > 0 ? 'text-green-600' : 'text-red-600'}`} />
                              </CardHeader>
                              <CardContent>
                                  <div className={`text-2xl font-bold ${selectedClosure.discrepancy === 0 ? 'text-gray-700' : selectedClosure.discrepancy > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {selectedClosure.discrepancy > 0 ? '+' : ''}{formatCurrency(selectedClosure.discrepancy)}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1">
                                      {selectedClosure.discrepancy === 0 ? 'Cierre perfecto' : selectedClosure.discrepancy > 0 ? 'Sobrante en caja' : 'Faltante en caja'}
                                  </p>
                              </CardContent>
                          </Card>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Payment Methods Breakdown */}
                          <Card className="h-full">
                              <CardHeader>
                                  <CardTitle className="text-base flex items-center gap-2">
                                      <CreditCard className="h-4 w-4 text-primary" />
                                      Desglose por Método de Pago
                                  </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                  <div className="space-y-3">
                                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                                          <div className="flex items-center gap-3">
                                              <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                                  <Banknote className="h-4 w-4 text-emerald-600" />
                                              </div>
                                              <span className="font-medium">Efectivo</span>
                                          </div>
                                          <span className="font-bold">{formatCurrency(selectedClosure.salesByCash)}</span>
                                      </div>
                                      
                                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                                          <div className="flex items-center gap-3">
                                              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                                  <CreditCard className="h-4 w-4 text-blue-600" />
                                              </div>
                                              <span className="font-medium">Tarjeta / POS</span>
                                          </div>
                                          <span className="font-bold">{formatCurrency(selectedClosure.salesByCard)}</span>
                                      </div>

                                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                                          <div className="flex items-center gap-3">
                                              <div className="h-8 w-8 rounded-full bg-violet-100 flex items-center justify-center">
                                                  <TrendingUp className="h-4 w-4 text-violet-600" />
                                              </div>
                                              <span className="font-medium">Transferencia</span>
                                          </div>
                                          <span className="font-bold">{formatCurrency(selectedClosure.salesByTransfer)}</span>
                                      </div>
                                      
                                      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                                          <div className="flex items-center gap-3">
                                              <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                                                  <Receipt className="h-4 w-4 text-amber-600" />
                                              </div>
                                              <span className="font-medium">Mixto / Otros</span>
                                          </div>
                                          <span className="font-bold">{formatCurrency(selectedClosure.salesByMixed)}</span>
                                      </div>
                                  </div>
                              </CardContent>
                          </Card>

                          {/* Cash Flow Summary */}
                          <Card className="h-full">
                              <CardHeader>
                                  <CardTitle className="text-base flex items-center gap-2">
                                      <TrendingUp className="h-4 w-4 text-primary" />
                                      Flujo de Efectivo
                                  </CardTitle>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                  <div className="flex justify-between items-center py-2 border-b">
                                      <span className="text-muted-foreground">Saldo Inicial (Apertura)</span>
                                      <span className="font-mono font-medium">{formatCurrency(selectedClosure.openingBalance)}</span>
                                  </div>
                                  <div className="flex justify-between items-center py-2 border-b">
                                      <span className="text-muted-foreground flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                          Entradas de Efectivo
                                      </span>
                                      <span className="font-mono font-medium text-green-600">+{formatCurrency(selectedClosure.totalCashIn)}</span>
                                  </div>
                                  <div className="flex justify-between items-center py-2 border-b">
                                      <span className="text-muted-foreground flex items-center gap-2">
                                          <div className="w-2 h-2 rounded-full bg-red-500"></div>
                                          Salidas / Retiros
                                      </span>
                                      <span className="font-mono font-medium text-red-600">-{formatCurrency(selectedClosure.totalCashOut)}</span>
                                  </div>
                                  <div className="flex justify-between items-center py-3 bg-gray-50 dark:bg-gray-900 px-3 rounded-lg mt-2">
                                      <span className="font-semibold">Saldo Esperado (Teórico)</span>
                                      <span className="font-mono font-bold">{formatCurrency(selectedClosure.expectedBalance)}</span>
                                  </div>
                              </CardContent>
                          </Card>
                      </div>

                      {/* Audit Info */}
                      <Card>
                          <CardHeader>
                              <CardTitle className="text-base flex items-center gap-2">
                                  <User className="h-4 w-4 text-primary" />
                                  Información de Auditoría
                              </CardTitle>
                          </CardHeader>
                          <CardContent className="grid md:grid-cols-2 gap-6">
                              <div className="space-y-1">
                                  <p className="text-sm text-muted-foreground">Responsable del Cierre</p>
                                  <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded border">
                                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                          {selectedClosure.closedBy.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="font-medium">{selectedClosure.closedBy}</span>
                                  </div>
                              </div>
                              <div className="space-y-1">
                                  <p className="text-sm text-muted-foreground">Notas Adjuntas</p>
                                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded border min-h-[50px] text-sm italic text-gray-600">
                                      {selectedClosure.notes || "Sin notas adicionales"}
                                  </div>
                              </div>
                          </CardContent>
                      </Card>
                  </div>
              </ScrollArea>
           </div>
        ) : (
           // --- LIST VIEW (Original) ---
           <>
            <DialogHeader className="p-6 pb-2 bg-white dark:bg-gray-900 shrink-0">
              <DialogTitle className="flex items-center gap-2 text-xl">
                <History className="h-5 w-5 text-primary" />
                Historial de Cierres Z
                <Badge variant="outline" className="ml-2">
                  {filteredHistory.length} registros
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 p-6 bg-white dark:bg-gray-900 shrink-0">
              {/* Filters and Search */}
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex gap-2">
                  <Button
                    variant={selectedPeriod === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPeriod('all')}
                  >
                    Todos
                  </Button>
                  <Button
                    variant={selectedPeriod === 'week' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPeriod('week')}
                  >
                    Última semana
                  </Button>
                  <Button
                    variant={selectedPeriod === 'month' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedPeriod('month')}
                  >
                    Último mes
                  </Button>
                </div>

                <div className="flex gap-2 items-center w-full sm:w-auto">
                  <div className="relative flex-1 sm:flex-none">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por fecha, usuario..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full sm:w-64"
                    />
                  </div>
                  {checkPermission('canExportData') && (
                    <Button variant="outline" size="sm" onClick={exportHistoryCSV}>
                      <Download className="h-4 w-4 mr-2" />
                      Exportar
                    </Button>
                  )}
                </div>
              </div>

              {/* Summary Cards Row - Collapsible on mobile? No, keeping it */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span className="text-xs font-medium">Ventas Totales</span>
                  </div>
                  <p className="text-lg font-bold">{formatCurrency(totalSales)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-3 w-3 text-blue-500" />
                    <span className="text-xs font-medium">Cierres</span>
                  </div>
                  <p className="text-lg font-bold">{filteredHistory.length}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-3 w-3 text-purple-500" />
                    <span className="text-xs font-medium">Ticket Prom.</span>
                  </div>
                  <p className="text-lg font-bold">{formatCurrency(averageTicket)}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-3 w-3 text-orange-500" />
                    <span className="text-xs font-medium">Discrepancias</span>
                  </div>
                  <p className="text-lg font-bold text-orange-600">{formatCurrency(totalDiscrepancies)}</p>
                </div>
              </div>
            </div>

            {/* History List - Premium Cards */}
            <div className="flex-1 overflow-hidden bg-gray-50/50 p-6 pt-0">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-3 pb-6">
                    {filteredHistory.map((closure) => (
                      <div
                          key={closure.id}
                          className="group bg-white rounded-xl border p-4 hover:shadow-md transition-all duration-200 hover:border-primary/20 cursor-pointer relative overflow-hidden"
                          onClick={() => handleClosureSelect(closure)}
                        >
                          <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary">
                              <Eye className="h-5 w-5" />
                            </Button>
                          </div>

                        <div className="grid grid-cols-12 gap-4 items-center">
                          {/* Date & Time */}
                          <div className="col-span-12 sm:col-span-3 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs shrink-0">
                              {new Date(closure.date).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit' })}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {new Date(closure.date).toLocaleDateString('es-PY', { weekday: 'long', year: 'numeric' })}
                              </p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {new Date(closure.closedAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })} • {closure.registerId}
                              </p>
                            </div>
                          </div>

                          {/* Sales KPI */}
                          <div className="col-span-6 sm:col-span-3">
                            <p className="text-xs text-muted-foreground mb-1">Ventas Totales</p>
                            <p className="text-lg font-bold text-gray-900 tracking-tight">
                              {formatCurrency(closure.totalSales)}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {closure.movementsCount} mov.
                            </p>
                          </div>

                          {/* Balance Info */}
                          <div className="col-span-6 sm:col-span-3">
                            <p className="text-xs text-muted-foreground mb-1">Cierre vs Esperado</p>
                            <div className="flex flex-col">
                              <span className="font-medium text-gray-900">{formatCurrency(closure.closingBalance)}</span>
                              <span className="text-[10px] text-muted-foreground">Exp: {formatCurrency(closure.expectedBalance)}</span>
                            </div>
                          </div>

                          {/* Status / Discrepancy */}
                          <div className="col-span-12 sm:col-span-3 flex items-center justify-between sm:justify-end gap-3">
                            <div className="flex flex-col items-end gap-1">
                              {getDiscrepancyBadge(closure.discrepancy)}
                              {closure.discrepancy !== 0 && (
                                <span className={`text-xs font-medium ${closure.discrepancy > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                  {closure.discrepancy > 0 ? '+' : ''}{formatCurrency(closure.discrepancy)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Notes footer if exists */}
                        {closure.notes && (
                          <div className="mt-3 pt-3 border-t text-xs text-muted-foreground flex items-center gap-2">
                            <span className="font-medium">Nota:</span> {closure.notes}
                          </div>
                        )}
                      </div>
                    ))}

                    {filteredHistory.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                        <div className="h-16 w-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                          <History className="h-8 w-8 opacity-20" />
                        </div>
                        <p className="text-lg font-medium">No se encontraron cierres Z</p>
                        <p className="text-sm">Prueba ajustando los filtros de búsqueda</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
            </div>
           </>
        )}
      </DialogContent>
    </Dialog>
  )
}