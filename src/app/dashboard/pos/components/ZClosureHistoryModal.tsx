'use client'

import React, { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  History, Search, Download, Eye, Calendar,
  TrendingUp, TrendingDown, AlertTriangle
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { useCashRegisterContext, ZClosureRecord } from '../contexts/CashRegisterContext'

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
    a.download = `historial_cierres_z_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getDiscrepancyBadge = (discrepancy: number) => {
    if (discrepancy === 0) {
      return <Badge variant="default" className="bg-green-100 text-green-800">Sin diferencia</Badge>
    } else if (Math.abs(discrepancy) <= 10000) { // <= 10k Gs
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Diferencia menor</Badge>
    } else {
      return <Badge variant="destructive" className="bg-red-100 text-red-800">Diferencia significativa</Badge>
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

          {/* History Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b">
              <div className="grid grid-cols-12 gap-4 text-sm font-medium">
                <div className="col-span-2">Fecha</div>
                <div className="col-span-1">Caja</div>
                <div className="col-span-2">Ventas</div>
                <div className="col-span-2">Saldo Final</div>
                <div className="col-span-2">Discrepancia</div>
                <div className="col-span-2">Usuario</div>
                <div className="col-span-1">Acciones</div>
              </div>
            </div>
            
            <ScrollArea className="h-[400px]">
              <div className="divide-y">
                {filteredHistory.map((closure) => (
                  <div key={closure.id} className="px-4 py-3 hover:bg-muted/20">
                    <div className="grid grid-cols-12 gap-4 items-center text-sm">
                      <div className="col-span-2">
                        <div className="font-medium">
                          {new Date(closure.date).toLocaleDateString('es-PY')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(closure.closedAt).toLocaleTimeString('es-PY')}
                        </div>
                      </div>
                      
                      <div className="col-span-1">
                        <Badge variant="outline" className="text-xs">
                          {closure.registerId}
                        </Badge>
                      </div>
                      
                      <div className="col-span-2">
                        <div className="font-medium text-green-600">
                          {formatCurrency(closure.totalSales)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {closure.movementsCount} movimientos
                        </div>
                      </div>
                      
                      <div className="col-span-2">
                        <div className="font-medium">
                          {formatCurrency(closure.closingBalance)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Esperado: {formatCurrency(closure.expectedBalance)}
                        </div>
                      </div>
                      
                      <div className="col-span-2">
                        {getDiscrepancyBadge(closure.discrepancy)}
                        {closure.discrepancy !== 0 && (
                          <div className="text-xs mt-1 font-medium">
                            {closure.discrepancy > 0 ? '+' : ''}{formatCurrency(closure.discrepancy)}
                          </div>
                        )}
                      </div>
                      
                      <div className="col-span-2">
                        <div className="font-medium">{closure.closedBy}</div>
                        {closure.notes && (
                          <div className="text-xs text-muted-foreground truncate">
                            {closure.notes}
                          </div>
                        )}
                      </div>
                      
                      <div className="col-span-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewDetails(closure)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredHistory.length === 0 && (
                  <div className="px-4 py-8 text-center text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No se encontraron cierres Z</p>
                    {searchTerm && (
                      <p className="text-sm mt-2">
                        Intenta con otros términos de búsqueda
                      </p>
                    )}
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