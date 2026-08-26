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
          <meta charset="utf-8">
          <title>Cierre Z - ${closure.date}</title>
          <style>
            @page {
              margin: 4mm;
              size: auto;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Courier New', monospace;
              margin: 0;
              padding: 10px;
              color: #000;
              background: #fff;
              font-size: 12px;
              line-height: 1.4;
              max-width: 320px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 1px dashed #000;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .title {
              font-size: 16px;
              font-weight: 900;
              letter-spacing: 1px;
              margin: 0 0 4px 0;
            }
            .meta {
              font-size: 11px;
              color: #333;
              margin: 2px 0;
            }
            .section {
              margin-bottom: 12px;
              border-bottom: 1px dashed #ccc;
              padding-bottom: 8px;
            }
            .section-title {
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin: 0 0 6px 0;
              border-bottom: 1px solid #000;
              padding-bottom: 2px;
            }
            .row {
              display: flex;
              justify-content: space-between;
              padding: 2px 0;
              font-size: 11.5px;
            }
            .total-row {
              font-weight: 800;
              font-size: 12.5px;
              padding-top: 4px;
              border-top: 1px solid #000;
            }
            .discrepancy {
              font-weight: 800;
            }
            .signatures {
              margin-top: 24px;
              display: flex;
              justify-content: space-between;
              gap: 16px;
              text-align: center;
              font-size: 10px;
            }
            .sign-line {
              border-top: 1px solid #000;
              padding-top: 4px;
              flex: 1;
            }
            .footer {
              margin-top: 16px;
              text-align: center;
              font-size: 10px;
              color: #555;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">COMPROBANTE CIERRE Z</h1>
            <p class="meta">Fecha: ${new Date(closure.date).toLocaleDateString('es-PY')} - ${new Date(closure.closedAt).toLocaleTimeString('es-PY')}</p>
            <p class="meta">Caja: ${closure.registerId} | Responsable: ${closure.closedBy || 'Sistema'}</p>
          </div>
          
          <div class="section">
            <div class="section-title">RESUMEN FINANCIERO</div>
            <div class="row"><span>Saldo Inicial:</span><span>${formatCurrency(closure.openingBalance)}</span></div>
            <div class="row"><span>Total Ventas:</span><span>${formatCurrency(closure.totalSales)}</span></div>
            <div class="row"><span>Ingresos Manuales:</span><span>${formatCurrency(closure.totalCashIn)}</span></div>
            <div class="row"><span>Egresos / Retiros:</span><span>-${formatCurrency(closure.totalCashOut)}</span></div>
            <div class="row total-row"><span>Saldo Esperado:</span><span>${formatCurrency(closure.expectedBalance)}</span></div>
            <div class="row"><span>Saldo Declarado:</span><span>${formatCurrency(closure.closingBalance)}</span></div>
            <div class="row discrepancy">
              <span>Diferencia:</span>
              <span>${closure.discrepancy > 0 ? '+' : ''}${formatCurrency(closure.discrepancy)} ${Math.abs(closure.discrepancy) < 1 ? '[CUADRADA]' : closure.discrepancy > 0 ? '[SOBRANTE]' : '[FALTANTE]'}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">VENTAS POR FORMA DE PAGO</div>
            <div class="row"><span>Efectivo:</span><span>${formatCurrency(closure.salesByCash)}</span></div>
            <div class="row"><span>Tarjeta:</span><span>${formatCurrency(closure.salesByCard)}</span></div>
            <div class="row"><span>Transferencia / QR:</span><span>${formatCurrency(closure.salesByTransfer)}</span></div>
            <div class="row"><span>Mixto / Otros:</span><span>${formatCurrency(closure.salesByMixed)}</span></div>
            <div class="row total-row"><span>Total Movimientos:</span><span>${closure.movementsCount}</span></div>
          </div>
          
          ${closure.notes ? `
          <div class="section">
            <div class="section-title">OBSERVACIONES</div>
            <p style="margin: 4px 0; font-size: 11px;">${closure.notes}</p>
          </div>
          ` : ''}

          <div class="signatures">
            <div class="sign-line">Firma Cajero</div>
            <div class="sign-line">Firma Supervisor</div>
          </div>
          
          <div class="footer">
            Sistema de Gestión POS • Impreso: ${new Date().toLocaleString('es-PY')}
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `

    printWindow.document.write(printContent)
    printWindow.document.close()
  }

  const getDiscrepancyStatus = () => {
    if (Math.abs(closure.discrepancy) < 1) {
      return { color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800', label: 'Sin discrepancia', icon: '✓' }
    } else if (Math.abs(closure.discrepancy) <= 10000) {
      return { color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800', label: 'Discrepancia menor', icon: '⚠' }
    } else {
      return { color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-100 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800', label: 'Discrepancia significativa', icon: '⚠' }
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