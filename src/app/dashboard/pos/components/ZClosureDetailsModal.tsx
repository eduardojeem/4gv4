'use client'

import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  FileText, Download, Printer, Calendar, User,
  DollarSign, TrendingUp, TrendingDown, AlertTriangle,
  Banknote, CreditCard, Smartphone, RefreshCcw
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { ZClosureRecord, useCashRegisterContext } from '../contexts/CashRegisterContext'

interface ZClosureDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  closure: ZClosureRecord | null
}

export function ZClosureDetailsModal({ isOpen, onClose, closure }: ZClosureDetailsModalProps) {
  const { checkPermission } = useCashRegisterContext()

  if (!closure) return null

  const discrepancyPercentage = closure.expectedBalance > 0 
    ? (Math.abs(closure.discrepancy) / closure.expectedBalance) * 100 
    : 0

  const exportClosureReport = () => {
    if (!checkPermission('canExportData')) return

    const reportData = {
      'Información General': {
        'ID de Cierre': closure.id,
        'Fecha': new Date(closure.date).toLocaleDateString('es-PY'),
        'Hora de Cierre': new Date(closure.closedAt).toLocaleTimeString('es-PY'),
        'Caja': closure.registerId,
        'Cerrado por': closure.closedBy,
        'Notas': closure.notes || 'Sin notas'
      },
      'Resumen Financiero': {
        'Saldo Inicial': formatCurrency(closure.openingBalance),
        'Saldo Final': formatCurrency(closure.closingBalance),
        'Saldo Esperado': formatCurrency(closure.expectedBalance),
        'Discrepancia': formatCurrency(closure.discrepancy),
        'Porcentaje de Discrepancia': `${discrepancyPercentage.toFixed(2)}%`
      },
      'Movimientos': {
        'Ventas Totales': formatCurrency(closure.totalSales),
        'Ingresos de Caja': formatCurrency(closure.totalCashIn),
        'Egresos de Caja': formatCurrency(closure.totalCashOut),
        'Total de Movimientos': closure.movementsCount
      },
      'Ventas por Método': {
        'Efectivo': formatCurrency(closure.salesByCash),
        'Tarjeta': formatCurrency(closure.salesByCard),
        'Transferencia': formatCurrency(closure.salesByTransfer),
        'Mixto': formatCurrency(closure.salesByMixed)
      }
    }

    // Convert to CSV format
    const csvLines = []
    csvLines.push('Reporte de Cierre Z')
    csvLines.push(`Generado el: ${new Date().toLocaleString('es-PY')}`)
    csvLines.push('')

    Object.entries(reportData).forEach(([section, data]) => {
      csvLines.push(section)
      Object.entries(data).forEach(([key, value]) => {
        csvLines.push(`${key},${value}`)
      })
      csvLines.push('')
    })

    const csv = csvLines.join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cierre_z_${closure.id}_${closure.date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const printReport = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cierre Z - ${closure.date}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .section { margin-bottom: 20px; }
            .section h3 { background: #f5f5f5; padding: 8px; margin: 0; }
            .row { display: flex; justify-content: space-between; padding: 4px 8px; border-bottom: 1px solid #eee; }
            .total { font-weight: bold; background: #f0f0f0; }
            .discrepancy { color: ${closure.discrepancy === 0 ? 'green' : 'red'}; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>CIERRE Z</h1>
            <p>Fecha: ${new Date(closure.date).toLocaleDateString('es-PY')} - Hora: ${new Date(closure.closedAt).toLocaleTimeString('es-PY')}</p>
            <p>Caja: ${closure.registerId} | Operador: ${closure.closedBy}</p>
          </div>
          
          <div class="section">
            <h3>RESUMEN FINANCIERO</h3>
            <div class="row"><span>Saldo Inicial:</span><span>${formatCurrency(closure.openingBalance)}</span></div>
            <div class="row"><span>Saldo Final:</span><span>${formatCurrency(closure.closingBalance)}</span></div>
            <div class="row"><span>Saldo Esperado:</span><span>${formatCurrency(closure.expectedBalance)}</span></div>
            <div class="row discrepancy"><span>Discrepancia:</span><span>${formatCurrency(closure.discrepancy)}</span></div>
          </div>
          
          <div class="section">
            <h3>MOVIMIENTOS</h3>
            <div class="row"><span>Ventas Totales:</span><span>${formatCurrency(closure.totalSales)}</span></div>
            <div class="row"><span>Ingresos de Caja:</span><span>${formatCurrency(closure.totalCashIn)}</span></div>
            <div class="row"><span>Egresos de Caja:</span><span>${formatCurrency(closure.totalCashOut)}</span></div>
            <div class="row total"><span>Total Movimientos:</span><span>${closure.movementsCount}</span></div>
          </div>
          
          <div class="section">
            <h3>VENTAS POR MÉTODO DE PAGO</h3>
            <div class="row"><span>Efectivo:</span><span>${formatCurrency(closure.salesByCash)}</span></div>
            <div class="row"><span>Tarjeta:</span><span>${formatCurrency(closure.salesByCard)}</span></div>
            <div class="row"><span>Transferencia:</span><span>${formatCurrency(closure.salesByTransfer)}</span></div>
            <div class="row"><span>Mixto:</span><span>${formatCurrency(closure.salesByMixed)}</span></div>
          </div>
          
          ${closure.notes ? `
          <div class="section">
            <h3>NOTAS</h3>
            <p>${closure.notes}</p>
          </div>
          ` : ''}
          
          <div style="margin-top: 40px; text-align: center; font-size: 12px; color: #666;">
            Reporte generado automáticamente el ${new Date().toLocaleString('es-PY')}
          </div>
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
    printWindow.print()
  }

  const getDiscrepancyStatus = () => {
    if (closure.discrepancy === 0) {
      return { color: 'text-green-600', bg: 'bg-green-100', label: 'Sin discrepancia', icon: '✓' }
    } else if (Math.abs(closure.discrepancy) <= 10000) {
      return { color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Discrepancia menor', icon: '⚠' }
    } else {
      return { color: 'text-red-600', bg: 'bg-red-100', label: 'Discrepancia significativa', icon: '⚠' }
    }
  }

  const discrepancyStatus = getDiscrepancyStatus()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FileText className="h-5 w-5 text-primary" />
            Detalles del Cierre Z
            <Badge variant="outline" className="ml-2">
              {closure.registerId}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Header Info */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Fecha y Hora</span>
                </div>
                <p className="text-lg font-bold">
                  {new Date(closure.date).toLocaleDateString('es-PY')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(closure.closedAt).toLocaleTimeString('es-PY')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Operador</span>
                </div>
                <p className="text-lg font-bold">{closure.closedBy}</p>
                <p className="text-sm text-muted-foreground">
                  {closure.movementsCount} movimientos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Estado</span>
                </div>
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${discrepancyStatus.bg} ${discrepancyStatus.color}`}>
                  <span>{discrepancyStatus.icon}</span>
                  {discrepancyStatus.label}
                </div>
                {discrepancyPercentage > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {discrepancyPercentage.toFixed(2)}% de diferencia
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Financial Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Resumen Financiero
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Saldo Inicial</span>
                    <span className="font-bold">{formatCurrency(closure.openingBalance)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Ventas Totales</span>
                    <span className="font-bold text-green-600">{formatCurrency(closure.totalSales)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Ingresos de Caja</span>
                    <span className="font-bold text-green-600">{formatCurrency(closure.totalCashIn)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Egresos de Caja</span>
                    <span className="font-bold text-red-600">-{formatCurrency(closure.totalCashOut)}</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Saldo Esperado</span>
                    <span className="font-bold">{formatCurrency(closure.expectedBalance)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Saldo Final</span>
                    <span className="font-bold">{formatCurrency(closure.closingBalance)}</span>
                  </div>
                  <div className={`flex justify-between items-center p-3 rounded-lg ${discrepancyStatus.bg}`}>
                    <span className="font-medium">Discrepancia</span>
                    <span className={`font-bold ${discrepancyStatus.color}`}>
                      {closure.discrepancy >= 0 ? '+' : ''}{formatCurrency(closure.discrepancy)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Methods Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Ventas por Método de Pago
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-green-500" />
                      <span>Efectivo</span>
                    </div>
                    <span className="font-bold">{formatCurrency(closure.salesByCash)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-blue-500" />
                      <span>Tarjeta</span>
                    </div>
                    <span className="font-bold">{formatCurrency(closure.salesByCard)}</span>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-purple-500" />
                      <span>Transferencia</span>
                    </div>
                    <span className="font-bold">{formatCurrency(closure.salesByTransfer)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RefreshCcw className="h-4 w-4 text-orange-500" />
                      <span>Mixto</span>
                    </div>
                    <span className="font-bold">{formatCurrency(closure.salesByMixed)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Methods Chart */}
              <div className="mt-6">
                <div className="space-y-2">
                  {[
                    { label: 'Efectivo', amount: closure.salesByCash, color: 'bg-green-500' },
                    { label: 'Tarjeta', amount: closure.salesByCard, color: 'bg-blue-500' },
                    { label: 'Transferencia', amount: closure.salesByTransfer, color: 'bg-purple-500' },
                    { label: 'Mixto', amount: closure.salesByMixed, color: 'bg-orange-500' }
                  ].map(method => {
                    const percentage = closure.totalSales > 0 ? (method.amount / closure.totalSales) * 100 : 0
                    return (
                      <div key={method.label} className="flex items-center gap-3">
                        <div className="w-20 text-xs">{method.label}</div>
                        <div className="flex-1 bg-muted rounded-full h-2">
                          <div 
                            className={`h-2 rounded-full ${method.color}`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="w-16 text-xs text-right">{percentage.toFixed(1)}%</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {closure.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notas del Cierre</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm bg-muted/50 p-3 rounded-lg">{closure.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={printReport}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          {checkPermission('canExportData') && (
            <Button variant="outline" onClick={exportClosureReport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          )}
          <Button onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}