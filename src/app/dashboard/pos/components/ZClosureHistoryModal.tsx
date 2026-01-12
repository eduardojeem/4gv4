'use client'

import React, { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  History, Search, Download, Eye, Calendar,
  TrendingUp, TrendingDown, AlertTriangle, BarChart3
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
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <History className="h-5 w-5 text-primary" />
            Historial de Cierres Z
            <Badge variant="outline" className="ml-2">
              {filteredHistory.length} registros
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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

            <div className="flex gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por fecha, usuario o notas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-64"
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

          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">Ventas Totales</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(totalSales)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Cierres</span>
              </div>
              <p className="text-2xl font-bold">{filteredHistory.length}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Promedio por Cierre</span>
              </div>
              <p className="text-2xl font-bold">{formatCurrency(averageTicket)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium">Discrepancias</span>
              </div>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalDiscrepancies)}</p>
            </div>
          </div>

          {/* Trend Chart */}
          {chartData.length > 0 && (
            <Card>
              <CardHeader className="py-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Tendencia de Ventas (Últimos {chartData.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="py-2">
                <div className="h-[150px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                      <Tooltip
                        cursor={{ fill: 'transparent' }}
                        formatter={(value: number) => formatCurrency(value)}
                        labelStyle={{ color: 'black' }}
                      />
                      <Bar dataKey="sales" fill="#22c55e" radius={[4, 4, 0, 0]} name="Ventas" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* History List - Premium Cards */}
          <div className="flex-1 overflow-hidden border rounded-xl bg-gray-50/50">
            <ScrollArea className="h-[450px] p-4">
              <div className="space-y-3">
                {filteredHistory.map((closure) => (
                  <div
                    key={closure.id}
                    className="group bg-white rounded-xl border p-4 hover:shadow-md transition-all duration-200 hover:border-primary/20 cursor-pointer relative overflow-hidden"
                    onClick={() => onViewDetails(closure)}
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
                        <div className="text-right sm:text-left block sm:hidden">
                          <Button variant="ghost" size="sm">Ver detalles</Button>
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
        </div>
      </DialogContent>
    </Dialog>
  )
}