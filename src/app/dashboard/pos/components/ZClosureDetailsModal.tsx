'use client'

import React, { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { 
  FileText, Download, Printer, Calendar, User,
  DollarSign, AlertTriangle,
  Banknote, CreditCard, Smartphone, RefreshCcw,
  CheckCircle2, Wrench, ShoppingBag, ArrowDownRight, ArrowUpRight, Search, ListFilter
} from 'lucide-react'
import { formatCurrency } from '@/lib/currency'
import { ZClosureRecord, useCashRegisterContext } from '../contexts/CashRegisterContext'
import { formatRegisterName, formatUserLabel, formatEventConcept } from '@/app/dashboard/pos/lib/formatters'
import { downloadCsvReport } from '@/app/dashboard/pos/lib/exportCsv'
import { downloadPdfReport } from '@/app/dashboard/pos/lib/exportPdf'

interface ZClosureDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  closure: ZClosureRecord | null
}

export function ZClosureDetailsModal({ isOpen, onClose, closure }: ZClosureDetailsModalProps) {
  const { registers } = useCashRegisterContext()
  const [activeTab, setActiveTab] = useState<'summary' | 'movements'>('summary')
  const [movementSearch, setMovementSearch] = useState('')
  const [movementTypeFilter, setMovementTypeFilter] = useState<'all' | 'sale' | 'repair' | 'cash_in' | 'cash_out'>('all')

  // Movimientos categorizados (seguros ante closure nulo)
  const movements = useMemo(() => closure?.movements || [], [closure?.movements])

  const getMovementMeta = (m: any) => {
    const reasonLower = (m.reason || '').toLowerCase()
    const isRepair = reasonLower.includes('reparaci') || reasonLower.includes('orden') || reasonLower.includes('ord-') || reasonLower.includes('tecnico') || reasonLower.includes('repuesto')
    
    if (isRepair) {
      return { label: 'Reparación', typeKey: 'repair', icon: Wrench, color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/60' }
    }
    if (m.type === 'sale' || m.type === 'venta') {
      return { label: 'Venta POS', typeKey: 'sale', icon: ShoppingBag, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/60' }
    }
    if (m.type === 'cash_in' || m.type === 'ingreso') {
      return { label: 'Ingreso Manual', typeKey: 'cash_in', icon: ArrowUpRight, color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60' }
    }
    if (m.type === 'cash_out' || m.type === 'egreso') {
      return { label: 'Egreso / Gasto', typeKey: 'cash_out', icon: ArrowDownRight, color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900/60' }
    }
    if (m.type === 'opening') {
      return { label: 'Apertura', typeKey: 'opening', icon: CheckCircle2, color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300' }
    }
    return { label: 'Cierre Z', typeKey: 'closing', icon: CheckCircle2, color: 'text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/40 border-purple-300' }
  }

  const filteredMovements = useMemo(() => {
    const q = movementSearch.trim().toLowerCase()
    return movements.filter(m => {
      const meta = getMovementMeta(m)
      if (movementTypeFilter !== 'all' && meta.typeKey !== movementTypeFilter) return false
      if (!q) return true
      const fullText = `${m.reason || ''} ${m.payment_method || ''} ${m.userName || ''} ${m.amount || ''}`.toLowerCase()
      return fullText.includes(q)
    })
  }, [movements, movementSearch, movementTypeFilter])

  if (!closure) return null

  const registerDisplayName = formatRegisterName(closure.registerId, registers)
  const openedByDisplayName = formatUserLabel(closure.openedBy)
  const closedByDisplayName = formatUserLabel(closure.closedBy)

  // Desglose de ventas con respaldo
  const salesCash = closure.salesByCash || (closure.totalSales > 0 && !closure.salesByCard && !closure.salesByTransfer && !closure.salesByMixed ? closure.totalSales : 0)
  const salesCard = closure.salesByCard || 0
  const salesTransfer = closure.salesByTransfer || 0
  const salesMixed = closure.salesByMixed || 0

  const discrepancyPercentage = closure.expectedBalance > 0 
    ? (Math.abs(closure.discrepancy) / closure.expectedBalance) * 100 
    : 0

  const exportClosureReport = () => {
    const rows: any[] = [
      ['🟢 FASE 1: APERTURA', 'Fondo Inicial Declarado', closure.openingBalance || 0, 'Fondo de cambio inicial'],
      ['🟢 FASE 1: APERTURA', 'Responsable de Apertura', openedByDisplayName, 'Cajero de apertura'],
      ['🔵 FASE 2: VENTAS', 'Ventas en Efectivo', salesCash, 'Cobrado en efectivo'],
      ['🔵 FASE 2: VENTAS', 'Ventas con Tarjeta', salesCard, 'Terminal POS'],
      ['🔵 FASE 2: VENTAS', 'Ventas QR / SIPAP', salesTransfer, 'Transferencia bancaria'],
      ['🔵 FASE 2: VENTAS', 'Ventas Pago Mixto', salesMixed, 'Cobro combinado'],
      ['🔵 FASE 2: FLUJO', 'Entradas Manuales (+)', closure.totalCashIn || 0, 'Ingresos a caja'],
      ['🔵 FASE 2: FLUJO', 'Salidas / Gastos (-)', closure.totalCashOut || 0, 'Retiros de gaveta'],
      ['🔴 FASE 3: CIERRE Z', 'Saldo Teórico Esperado', closure.expectedBalance || 0, 'Cálculo del sistema'],
      ['🔴 FASE 3: CIERRE Z', 'Dinero Físico Contado', closure.closingBalance || 0, 'Conteo de gaveta'],
      ['🔴 FASE 3: CIERRE Z', 'Diferencia de Arqueo', closure.discrepancy || 0, Math.abs(closure.discrepancy) < 1 ? 'Caja Exacta' : closure.discrepancy > 0 ? 'Sobrante' : 'Faltante']
    ]

    // Si hay movimientos individuales, agregarlos al CSV
    if (movements.length > 0) {
      rows.push(['---', '---', '---', '---'])
      rows.push(['DETALLE DE OPERACIONES', 'HORA', 'MONTO (GS.)', 'CONCEPTO / COMPROBANTE'])
      movements.forEach(m => {
        const meta = getMovementMeta(m)
        const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString('es-PY') : ''
        rows.push([
          `OPERACIÓN: ${meta.label}`,
          timeStr,
          m.amount || 0,
          `${m.payment_method ? m.payment_method.toUpperCase() + ' · ' : ''}${m.reason || 'Operación de caja'}`
        ])
      })
    }

    downloadCsvReport({
      filename: `cierre_z_${closure.id}_${closure.date}`,
      title: 'Comprobante y Acta de Cierre Z Fiscal de Caja (Detallado)',
      subtitle: `Caja: ${registerDisplayName} · Fecha: ${new Date(closure.date).toLocaleDateString('es-PY')}`,
      generatedBy: closedByDisplayName,
      summaryStats: [
        { label: 'ID de Cierre:', value: closure.id },
        { label: 'Cajero Apertura:', value: openedByDisplayName },
        { label: 'Cajero Cierre:', value: closedByDisplayName },
        { label: 'Caja / Terminal:', value: registerDisplayName },
        { label: 'Fecha Apertura:', value: new Date(closure.openedAt || closure.date).toLocaleString('es-PY') },
        { label: 'Fecha Cierre:', value: new Date(closure.closedAt || closure.date).toLocaleString('es-PY') },
        { label: 'Saldo Inicial (Fondo):', value: formatCurrency(closure.openingBalance) },
        { label: 'Total Ventas Turno:', value: formatCurrency(closure.totalSales) },
        { label: 'Saldo Esperado:', value: formatCurrency(closure.expectedBalance) },
        { label: 'Dinero Físico Contado:', value: formatCurrency(closure.closingBalance) },
        { label: 'Discrepancia / Descuadre:', value: `${closure.discrepancy > 0 ? '+' : ''}${formatCurrency(closure.discrepancy)} (${Math.abs(closure.discrepancy) < 1 ? 'Caja Exacta' : closure.discrepancy > 0 ? 'Sobrante' : 'Faltante'})` },
        { label: 'Porcentaje de Variación:', value: `${discrepancyPercentage.toFixed(2)}%` }
      ],
      headers: [
        'Fase / Categoría',
        'Detalle / Medio de Cobro',
        'Monto Registrado (Gs.)',
        'Diagnóstico / Estado'
      ],
      rows
    })
  }

  const exportClosurePdf = async () => {
    const sections: any[] = []

    // SECCIÓN 1: RESUMEN FINANCIERO Y ARQUEO Z
    sections.push({
      title: '1. Resumen Financiero y Balance de Arqueo',
      description: 'Metadatos institucionales del turno, desglose de ventas y diagnóstico de cuadre de caja.',
      headers: [
        'Fase del Turno',
        'Detalle / Canal de Pago',
        'Monto Registrado (Gs.)',
        'Diagnóstico / Estado'
      ],
      rows: [
        ['🟢 FASE 1: APERTURA', 'Fondo Inicial Declarado', formatCurrency(closure.openingBalance || 0), 'Fondo de Apertura'],
        ['🟢 FASE 1: APERTURA', 'Responsable de Apertura', openedByDisplayName, 'Cajero de Apertura'],
        ['🟢 FASE 1: APERTURA', 'Fecha y Hora Apertura', new Date(closure.openedAt || closure.date).toLocaleString('es-PY'), 'Inicio de Turno'],
        ['🔵 FASE 2: VENTAS', 'Ventas en Efectivo', formatCurrency(salesCash), 'Cobrado en Caja'],
        ['🔵 FASE 2: VENTAS', 'Ventas con Tarjeta', formatCurrency(salesCard), 'Terminal POS'],
        ['🔵 FASE 2: VENTAS', 'Ventas QR / SIPAP', formatCurrency(salesTransfer), 'Transferencia'],
        ['🔵 FASE 2: VENTAS', 'Ventas Pago Mixto', formatCurrency(salesMixed), 'Combinado'],
        ['🔵 FASE 2: MOVIMIENTOS', 'Entradas Manuales (+)', formatCurrency(closure.totalCashIn || 0), 'Ingreso a Caja'],
        ['🔵 FASE 2: MOVIMIENTOS', 'Egresos / Gastos (-)', formatCurrency(closure.totalCashOut || 0), 'Retiro de Caja'],
        ['🔴 FASE 3: CIERRE Z', 'Fecha y Hora Cierre', new Date(closure.closedAt || closure.date).toLocaleString('es-PY'), 'Fin de Turno'],
        ['🔴 FASE 3: CIERRE Z', 'Responsable de Cierre', closedByDisplayName, 'Cajero de Cierre'],
        ['🔴 FASE 3: CIERRE Z', 'Saldo Teórico Esperado', formatCurrency(closure.expectedBalance || 0), 'Cálculo del Sistema'],
        ['🔴 FASE 3: CIERRE Z', 'Dinero Físico Contado', formatCurrency(closure.closingBalance || 0), 'Conteo en Gaveta'],
        ['🔴 FASE 3: CIERRE Z', 'Diferencia de Arqueo', closure.discrepancy > 0 ? `+${formatCurrency(closure.discrepancy)}` : formatCurrency(closure.discrepancy || 0), Math.abs(closure.discrepancy) < 1 ? 'Caja Exacta' : closure.discrepancy > 0 ? 'Sobrante en Caja' : 'Faltante en Caja']
      ],
      columnStyles: {
        0: { cellWidth: 120 },
        1: { cellWidth: 150 },
        2: { cellWidth: 120, halign: 'right' },
        3: { halign: 'center' }
      }
    })

    // SECCIÓN 2: DETALLE ÍTEM POR ÍTEM DE VENTAS Y REPARACIONES
    if (movements.length > 0) {
      sections.push({
        title: `2. Detalle de Ventas, Reparaciones y Operaciones Realizadas (${movements.length} eventos)`,
        description: 'Registro cronológico exhaustivo de cada cobro, venta y reparación liquidada en el turno.',
        headers: [
          'Hora',
          'Tipo de Operación',
          'Método de Pago',
          'Monto (Gs.)',
          'Responsable',
          'Concepto / Comprobante / Reparación'
        ],
        rows: movements.map(m => {
          const meta = getMovementMeta(m)
          const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString('es-PY') : '—'
          const methodLabel = (m.payment_method || 'EFECTIVO').toUpperCase()

          return [
            timeStr,
            meta.label,
            methodLabel,
            formatCurrency(m.amount || 0),
            formatUserLabel(m.userName, m.userEmail, m.created_by, closedByDisplayName),
            m.reason || 'Operación registrada en caja'
          ]
        }),
        columnStyles: {
          0: { cellWidth: 60, halign: 'center' },
          1: { cellWidth: 85, halign: 'center' },
          2: { cellWidth: 70, halign: 'center' },
          3: { cellWidth: 80, halign: 'right' },
          4: { cellWidth: 85 },
          5: { halign: 'left' }
        }
      })
    }

    await downloadPdfReport({
      filename: `cierre_z_detallado_${closure.id}_${closure.date}`,
      title: 'Comprobante y Acta de Cierre Z Fiscal de Caja (Detallado)',
      subtitle: `Caja: ${registerDisplayName} · Fecha: ${new Date(closure.date).toLocaleDateString('es-PY')}`,
      generatedBy: closedByDisplayName,
      orientation: 'landscape',
      summaryStats: [
        { label: 'Fondo Apertura', value: formatCurrency(closure.openingBalance) },
        { label: 'Total Ventas', value: formatCurrency(closure.totalSales) },
        { label: 'Saldo Esperado', value: formatCurrency(closure.expectedBalance) },
        { label: 'Físico Contado', value: formatCurrency(closure.closingBalance) }
      ],
      sections
    })
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
              padding: 8px;
              color: #000;
              background: #fff;
              font-size: 11.5px;
              line-height: 1.35;
              max-width: 320px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              border-bottom: 1px dashed #000;
              padding-bottom: 8px;
              margin-bottom: 10px;
            }
            .title {
              font-size: 15px;
              font-weight: 900;
              letter-spacing: 1px;
              margin: 0 0 4px 0;
            }
            .meta {
              font-size: 10.5px;
              color: #222;
              margin: 2px 0;
            }
            .section {
              margin-bottom: 10px;
              border-bottom: 1px dashed #ccc;
              padding-bottom: 8px;
            }
            .section-title {
              font-size: 10.5px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin: 0 0 5px 0;
              border-bottom: 1px solid #000;
              padding-bottom: 2px;
            }
            .row {
              display: flex;
              justify-content: space-between;
              padding: 2px 0;
              font-size: 11px;
            }
            .total-row {
              font-weight: 800;
              font-size: 12px;
              padding-top: 4px;
              border-top: 1px solid #000;
            }
            .discrepancy {
              font-weight: 800;
            }
            .signatures {
              margin-top: 22px;
              display: flex;
              justify-content: space-between;
              gap: 14px;
              text-align: center;
              font-size: 9.5px;
            }
            .sign-line {
              border-top: 1px solid #000;
              padding-top: 4px;
              flex: 1;
            }
            .footer {
              margin-top: 14px;
              text-align: center;
              font-size: 9px;
              color: #555;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">COMPROBANTE CIERRE Z</h1>
            <p class="meta">Caja: ${registerDisplayName}</p>
            <p class="meta">Apertura: ${new Date(closure.openedAt || closure.date).toLocaleString('es-PY')}</p>
            <p class="meta">Cierre: ${new Date(closure.closedAt || closure.date).toLocaleString('es-PY')}</p>
            <p class="meta">Cajero Abre: ${openedByDisplayName}</p>
            <p class="meta">Cajero Cierra: ${closedByDisplayName}</p>
          </div>
          
          <div class="section">
            <div class="section-title">RESUMEN FINANCIERO</div>
            <div class="row"><span>Saldo Inicial:</span><span>${formatCurrency(closure.openingBalance)}</span></div>
            <div class="row"><span>Total Ventas:</span><span>${formatCurrency(closure.totalSales)}</span></div>
            <div class="row"><span>Ingresos Manuales:</span><span>+${formatCurrency(closure.totalCashIn)}</span></div>
            <div class="row"><span>Egresos / Retiros:</span><span>-${formatCurrency(closure.totalCashOut)}</span></div>
            <div class="row total-row"><span>Saldo Esperado:</span><span>${formatCurrency(closure.expectedBalance)}</span></div>
            <div class="row"><span>Dinero Declarado:</span><span>${formatCurrency(closure.closingBalance)}</span></div>
            <div class="row discrepancy">
              <span>Diferencia:</span>
              <span>${closure.discrepancy > 0 ? '+' : ''}${formatCurrency(closure.discrepancy)} ${Math.abs(closure.discrepancy) < 1 ? '[CUADRADA]' : closure.discrepancy > 0 ? '[SOBRANTE]' : '[FALTANTE]'}</span>
            </div>
          </div>
          
          <div class="section">
            <div class="section-title">VENTAS POR FORMA DE PAGO</div>
            <div class="row"><span>Efectivo:</span><span>${formatCurrency(salesCash)}</span></div>
            <div class="row"><span>Tarjeta:</span><span>${formatCurrency(salesCard)}</span></div>
            <div class="row"><span>Transferencia / QR:</span><span>${formatCurrency(salesTransfer)}</span></div>
            <div class="row"><span>Mixto / Otros:</span><span>${formatCurrency(salesMixed)}</span></div>
            <div class="row total-row"><span>Total Movimientos:</span><span>${closure.movementsCount}</span></div>
          </div>
          
          ${closure.notes ? `
          <div class="section">
            <div class="section-title">OBSERVACIONES</div>
            <p style="margin: 4px 0; font-size: 10.5px;">${closure.notes}</p>
          </div>
          ` : ''}

          <div class="signatures">
            <div class="sign-line">Firma Cajero (${closedByDisplayName})</div>
            <div class="sign-line">Firma Supervisor</div>
          </div>
          
          <div class="footer">
            Sistema POS • Garantía de Auditoría • ${new Date().toLocaleString('es-PY')}
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
      return { color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-100 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800', label: 'Caja Exacta (Sin diferencia)', icon: '✓' }
    } else if (closure.discrepancy > 0) {
      return { color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800', label: `Sobrante (+${formatCurrency(closure.discrepancy)})`, icon: '▲' }
    } else {
      return { color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-100 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800', label: `Faltante (${formatCurrency(closure.discrepancy)})`, icon: '▼' }
    }
  }

  const discrepancyStatus = getDiscrepancyStatus()

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 rounded-3xl">
        {/* Header Modal */}
        <DialogHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <span>Detalles del Cierre Z Fiscal</span>
              <Badge variant="outline" className="font-semibold bg-background">
                {registerDisplayName}
              </Badge>
            </DialogTitle>

            {/* Navigation Tabs */}
            <div className="flex items-center p-1 bg-muted rounded-xl border border-border/50 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('summary')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${activeTab === 'summary' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                📊 Resumen Financiero
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('movements')}
                className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${activeTab === 'movements' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <span>🛍️ / 🔧 Ventas y Reparaciones</span>
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px] h-4">
                  {movements.length}
                </Badge>
              </button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'summary' ? (
            <>
              {/* Header Info Cards */}
              <div className="grid gap-3.5 sm:grid-cols-3">
                <Card className="rounded-2xl border-border/60 shadow-sm">
                  <CardContent className="p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      <span>Horarios del Turno</span>
                    </div>
                    <div className="space-y-0.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Apertura:</span>
                        <span className="font-medium text-foreground">{new Date(closure.openedAt || closure.date).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cierre:</span>
                        <span className="font-medium text-foreground">{new Date(closure.closedAt || closure.date).toLocaleString('es-PY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/60 shadow-sm">
                  <CardContent className="p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <User className="h-3.5 w-3.5 text-primary" />
                      <span>Cajeros Responsables</span>
                    </div>
                    <div className="space-y-0.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Apertura:</span>
                        <span className="font-medium text-foreground truncate max-w-[130px]">{openedByDisplayName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cierre:</span>
                        <span className="font-medium text-foreground truncate max-w-[130px]">{closedByDisplayName}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl border-border/60 shadow-sm">
                  <CardContent className="p-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      <AlertTriangle className="h-3.5 w-3.5 text-primary" />
                      <span>Estado de Arqueo</span>
                    </div>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold w-full justify-center ${discrepancyStatus.bg} ${discrepancyStatus.color}`}>
                      <span>{discrepancyStatus.icon}</span>
                      <span>{discrepancyStatus.label}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Financial Summary */}
              <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 pb-3 pt-3.5 px-4 border-b border-border/50">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Flujo Financiero del Turno
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-5">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">🟢 Fondo Inicial de Apertura:</span>
                        <span className="font-bold tabular-nums text-foreground">{formatCurrency(closure.openingBalance)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">🛍️ Ventas Totales del Turno:</span>
                        <span className="font-bold tabular-nums text-emerald-600 dark:text-emerald-400">+{formatCurrency(closure.totalSales)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">📥 Entradas Manuales de Efectivo:</span>
                        <span className="font-bold tabular-nums text-blue-600 dark:text-blue-400">+{formatCurrency(closure.totalCashIn)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">📤 Egresos / Gastos de Caja:</span>
                        <span className="font-bold tabular-nums text-rose-600 dark:text-rose-400">-{formatCurrency(closure.totalCashOut)}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">⚖️ Saldo Teórico Esperado:</span>
                        <span className="font-bold tabular-nums text-foreground">{formatCurrency(closure.expectedBalance)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">💰 Dinero Físico Contado:</span>
                        <span className="font-bold tabular-nums text-foreground text-base">{formatCurrency(closure.closingBalance)}</span>
                      </div>
                      <div className={`flex justify-between items-center p-2.5 rounded-xl ${discrepancyStatus.bg}`}>
                        <span className="font-semibold text-xs uppercase tracking-wider">Diferencia de Arqueo:</span>
                        <span className={`font-bold tabular-nums text-sm ${discrepancyStatus.color}`}>
                          {closure.discrepancy > 0 ? '+' : ''}{formatCurrency(closure.discrepancy)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Methods Breakdown */}
              <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 pb-3 pt-3.5 px-4 border-b border-border/50">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    Desglose de Ventas por Medio de Pago
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        <Banknote className="h-3.5 w-3.5" />
                        <span>Efectivo</span>
                      </div>
                      <p className="text-base font-bold tabular-nums text-foreground">{formatCurrency(salesCash)}</p>
                    </div>

                    <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 dark:text-blue-400">
                        <CreditCard className="h-3.5 w-3.5" />
                        <span>Tarjeta</span>
                      </div>
                      <p className="text-base font-bold tabular-nums text-foreground">{formatCurrency(salesCard)}</p>
                    </div>

                    <div className="p-3 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-400">
                        <Smartphone className="h-3.5 w-3.5" />
                        <span>QR / SIPAP</span>
                      </div>
                      <p className="text-base font-bold tabular-nums text-foreground">{formatCurrency(salesTransfer)}</p>
                    </div>

                    <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                        <RefreshCcw className="h-3.5 w-3.5" />
                        <span>Pago Mixto</span>
                      </div>
                      <p className="text-base font-bold tabular-nums text-foreground">{formatCurrency(salesMixed)}</p>
                    </div>
                  </div>

                  {/* Progress bars */}
                  <div className="space-y-2 pt-1">
                    {[
                      { label: 'Efectivo', amount: salesCash, color: 'bg-emerald-500' },
                      { label: 'Tarjeta', amount: salesCard, color: 'bg-blue-500' },
                      { label: 'Transferencia / QR', amount: salesTransfer, color: 'bg-purple-500' },
                      { label: 'Mixto', amount: salesMixed, color: 'bg-amber-500' }
                    ].map(method => {
                      const percentage = closure.totalSales > 0 ? (method.amount / closure.totalSales) * 100 : 0
                      return (
                        <div key={method.label} className="flex items-center gap-3 text-xs">
                          <div className="w-28 text-muted-foreground font-medium">{method.label}</div>
                          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${method.color}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <div className="w-14 text-right font-bold text-foreground">{percentage.toFixed(1)}%</div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              {closure.notes && (
                <Card className="rounded-2xl border-border/60 shadow-sm">
                  <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border/40">
                    <CardTitle className="text-xs font-bold uppercase tracking-wider">Observaciones y Justificación</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border/50">{closure.notes}</p>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            /* Tab: Ventas y Reparaciones Realizadas */
            <div className="space-y-4">
              {/* Filter controls */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por comprobante, cliente o motivo..."
                    value={movementSearch}
                    onChange={(e) => setMovementSearch(e.target.value)}
                    className="pl-8 h-9 text-xs rounded-xl"
                  />
                </div>

                <div className="flex flex-wrap gap-1.5 text-xs">
                  {[
                    { key: 'all', label: 'Todos' },
                    { key: 'sale', label: '🛍️ Ventas' },
                    { key: 'repair', label: '🔧 Reparaciones' },
                    { key: 'cash_in', label: '📥 Ingresos' },
                    { key: 'cash_out', label: '📤 Egresos' }
                  ].map(tab => (
                    <Button
                      key={tab.key}
                      variant={movementTypeFilter === tab.key ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setMovementTypeFilter(tab.key as any)}
                      className="h-8 text-xs px-2.5 rounded-lg font-medium"
                    >
                      {tab.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* List of movements */}
              {filteredMovements.length === 0 ? (
                <div className="text-center py-10 border border-dashed rounded-2xl border-border/70 p-6 space-y-2">
                  <ListFilter className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
                  <p className="text-sm font-semibold text-foreground">No se encontraron operaciones</p>
                  <p className="text-xs text-muted-foreground">
                    {movements.length === 0 ? 'Esta sesión no cuenta con desglose atómico de movimientos individuales.' : 'Prueba ajustando los filtros de búsqueda.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                  {filteredMovements.map((m, idx) => {
                    const meta = getMovementMeta(m)
                    const Icon = meta.icon
                    const timeStr = m.created_at ? new Date(m.created_at).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'
                    const method = (m.payment_method || 'EFECTIVO').toUpperCase()

                    return (
                      <div
                        key={m.id || idx}
                        className="p-3 rounded-2xl border border-border/60 bg-card hover:bg-muted/30 transition-colors flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2 rounded-xl border ${meta.color} shrink-0`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">{meta.label}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 uppercase font-semibold">
                                {method}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground">{timeStr}</span>
                            </div>
                            <p className="text-muted-foreground truncate max-w-[380px]">
                              {m.reason || 'Operación registrada en terminal'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 space-y-0.5">
                          <p className="font-bold text-sm tabular-nums text-foreground">
                            {formatCurrency(m.amount || 0)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatUserLabel(m.userName, m.userEmail, m.created_by, closedByDisplayName)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between p-4 border-t border-border/60 bg-muted/20 gap-2 flex-wrap">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Documento oficial de arqueo y trazabilidad</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={printReport} className="rounded-xl font-medium">
              <Printer className="h-4 w-4 mr-1.5" />
              Imprimir Ticket
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={exportClosurePdf}
              className="rounded-xl text-red-600 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border-red-200 dark:border-red-800/80 font-bold"
            >
              <FileText className="h-4 w-4 mr-1.5" />
              Descargar PDF Detallado
            </Button>
            <Button variant="outline" size="sm" onClick={exportClosureReport} className="rounded-xl font-medium">
              <Download className="h-4 w-4 mr-1.5" />
              CSV Completo
            </Button>
            <Button size="sm" onClick={onClose} className="rounded-xl font-medium">
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}