/**
 * finance-reports-pdf-exporter.ts
 *
 * Exportador en PDF para los reportes de datos reales del sistema financiero:
 * - Reporte de Rentabilidad (ProfitabilityPanel)
 * - Balance y Resumen Financiero Ejecutivo (FinanceSummary)
 * - Reporte de Gastos y Cuentas por Pagar (ExpensesPanel)
 */

import { formatCurrency } from '@/lib/currency'
import type { FinanceSummaryReport } from '@/lib/finance/server'

// ── Tipos ────────────────────────────────────────────────────────────────────

export type ProfitabilityGroup = 'sale' | 'repair' | 'product' | 'employee' | 'branch'

export interface ProfitabilityRowData {
  id: string
  label: string
  revenue: number
  directCosts: number | null
  grossProfit: number | null
  complete: boolean
  margin?: number | null
}

export interface ExportProfitabilityPdfOptions {
  rows: ProfitabilityRowData[]
  group?: ProfitabilityGroup
  totals?: {
    revenue: number
    directCosts: number | null
    grossProfit: number | null
    margin: number | null
    incompleteCount?: number
  }
  startDate?: string | null
  endDate?: string | null
  branchName?: string | null
  companyName?: string
}

export interface ExportFinanceSummaryPdfOptions {
  summary: FinanceSummaryReport
  startDate?: string | null
  endDate?: string | null
  branchName?: string | null
  companyName?: string
}

export interface ExpenseObligationRowData {
  id: string
  concept: string | null
  amount: number
  paid_amount?: number
  outstanding_amount: number
  due_date: string | null
  vendor?: string | null
  status: string
  categoryName?: string | null
}

export interface ExportExpensesPdfOptions {
  obligations: ExpenseObligationRowData[]
  startDate?: string | null
  endDate?: string | null
  branchName?: string | null
  companyName?: string
}

// ── Helpers de formato ───────────────────────────────────────────────────────

const GROUP_LABELS: Record<ProfitabilityGroup, string> = {
  sale: 'Venta de Mostrador',
  repair: 'Orden de Reparación',
  product: 'Producto / Repuesto',
  employee: 'Técnico / Vendedor',
  branch: 'Sucursal',
}

function formatDateDisplay(dateStr?: string | null): string {
  if (!dateStr) return '-'
  try {
    const parts = dateStr.slice(0, 10).split('-')
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  } catch {
    // fallback
  }
  return dateStr
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. EXPORTACIÓN DE RENTABILIDAD EN PDF
// ─────────────────────────────────────────────────────────────────────────────

export async function exportProfitabilityPdf({
  rows,
  group = 'repair',
  totals,
  startDate,
  endDate,
  branchName,
  companyName = '4G Sistema de Gestión',
}: ExportProfitabilityPdfOptions): Promise<void> {
  const [jsPdfModule, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const JsPdfClass: any = (jsPdfModule as any).jsPDF || (jsPdfModule as any).default || jsPdfModule
  const autoTable: any = (autoTableModule as any).default || autoTableModule

  const doc = new JsPdfClass({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 36
  const contentWidth = pageWidth - margin * 2

  const todayStr = new Date().toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const periodLabel =
    startDate && endDate
      ? `${formatDateDisplay(startDate)} al ${formatDateDisplay(endDate)}`
      : 'Período completo seleccionado'

  let y = 30

  // Banner Corporativo
  doc.setFillColor(15, 23, 42) // Slate 900
  doc.roundedRect(margin, y, contentWidth, 54, 4, 4, 'F')

  // Acento Indigo y Esmeralda
  doc.setFillColor(79, 70, 229)
  doc.rect(margin, y, contentWidth * 0.6, 3, 'F')
  doc.setFillColor(16, 185, 129)
  doc.rect(margin + contentWidth * 0.6, y, contentWidth * 0.4, 3, 'F')

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(companyName.toUpperCase(), margin + 14, y + 22)

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(203, 213, 225)
  doc.text(
    `REPORTE DE RENTABILIDAD • AGRUPADO POR ${GROUP_LABELS[group].toUpperCase()}`,
    margin + 14,
    y + 38
  )

  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(`Emisión: ${todayStr}`, pageWidth - margin - 14, y + 22, { align: 'right' })
  doc.text(
    `Período: ${periodLabel} • Sucursal: ${branchName || 'Todas'}`,
    pageWidth - margin - 14,
    y + 38,
    { align: 'right' }
  )

  y += 66

  // Tarjetas Resumen de KPIs (Totales)
  const calcRevenue = totals?.revenue ?? rows.reduce((acc, r) => acc + (r.revenue || 0), 0)
  const calcDirectCosts = totals?.directCosts ?? rows.reduce((acc, r) => acc + (r.directCosts || 0), 0)
  const calcGrossProfit = totals?.grossProfit ?? (calcRevenue - calcDirectCosts)
  const calcMargin =
    totals?.margin ?? (calcRevenue > 0 ? Math.round((calcGrossProfit / calcRevenue) * 100) : null)
  const incompleteCount = totals?.incompleteCount ?? rows.filter((r) => !r.complete).length

  const cardWidth = (contentWidth - 36) / 4
  const cardHeight = 44

  const kpis = [
    { label: 'Ingresos Totales', val: formatCurrency(calcRevenue), color: [30, 41, 59] },
    { label: 'Costos Directos', val: formatCurrency(calcDirectCosts), color: [225, 29, 72] },
    { label: 'Utilidad Bruta', val: formatCurrency(calcGrossProfit), color: [16, 185, 129] },
    {
      label: 'Margen Bruto Promedio',
      val: calcMargin !== null ? `${calcMargin}%` : 'N/A',
      color: [79, 70, 229],
    },
  ]

  kpis.forEach((kpi, idx) => {
    const cardX = margin + idx * (cardWidth + 12)
    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(cardX, y, cardWidth, cardHeight, 4, 4, 'FD')

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(kpi.label.toUpperCase(), cardX + 10, y + 15)

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2])
    doc.text(kpi.val, cardX + 10, y + 33)
  })

  y += cardHeight + 12

  // Alerta si hay costos incompletos
  if (incompleteCount > 0) {
    doc.setFillColor(254, 243, 199) // Amber 100
    doc.setDrawColor(245, 158, 11) // Amber 500
    doc.roundedRect(margin, y, contentWidth, 20, 3, 3, 'FD')

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(180, 83, 9)
    doc.text(
      `⚠ ATENCIÓN: Se detectaron ${incompleteCount} registros con costo directo no asignado. La ganancia bruta puede estar sobreestimada.`,
      margin + 10,
      y + 13
    )
    y += 26
  }

  // Tabla detallada de filas
  const tableHead = [
    'Identificador / Concepto',
    'Ingreso (Gs.)',
    'Costo Directo (Gs.)',
    'Utilidad Bruta (Gs.)',
    'Margen %',
    'Cobertura de Costo',
  ]

  const tableBody = rows.map((r) => {
    const rowMargin =
      r.margin !== undefined
        ? r.margin
        : r.revenue > 0 && r.grossProfit !== null
        ? Math.round((r.grossProfit / r.revenue) * 100)
        : null

    return [
      r.label || r.id.slice(0, 8),
      formatCurrency(r.revenue),
      r.directCosts === null ? 'Sin costo' : formatCurrency(r.directCosts),
      r.grossProfit === null ? 'Pendiente' : formatCurrency(r.grossProfit),
      rowMargin !== null ? `${rowMargin}%` : '-',
      r.complete ? 'Completa' : 'Falta costo directo',
    ]
  })

  // Fila de Total
  tableBody.push([
    'TOTAL GENERAL',
    formatCurrency(calcRevenue),
    formatCurrency(calcDirectCosts),
    formatCurrency(calcGrossProfit),
    calcMargin !== null ? `${calcMargin}%` : '-',
    `${rows.length} operaciones`,
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [tableHead],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 5,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 4,
      lineColor: [226, 232, 240],
    },
    columnStyles: {
      0: { cellWidth: 260, fontStyle: 'bold' },
      1: { cellWidth: 100, halign: 'right' },
      2: { cellWidth: 100, halign: 'right' },
      3: { cellWidth: 100, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 70, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: contentWidth - 630, halign: 'center' },
    },
    didParseCell: (data: any) => {
      // Destacar la fila de totales
      if (data.row.index === tableBody.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [241, 245, 249]
      }
    },
  })

  // Numeración de páginas
  const totalPages = (doc.internal as any).getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20)

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text('Sistema 4G • Reporte de Rentabilidad y Márgenes', margin, pageHeight - 10)
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
  }

  const cleanStartDate = (startDate || '').replace(/-/g, '')
  const cleanEndDate = (endDate || '').replace(/-/g, '')
  const dateSuffix = cleanStartDate && cleanEndDate ? `_${cleanStartDate}_${cleanEndDate}` : ''
  const filename = `Reporte_Rentabilidad_${group}${dateSuffix}.pdf`

  doc.save(filename)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. EXPORTACIÓN DE RESUMEN Y BALANCE FINANCIERO EN PDF
// ─────────────────────────────────────────────────────────────────────────────

export async function exportFinanceSummaryPdf({
  summary,
  startDate,
  endDate,
  branchName,
  companyName = '4G Sistema de Gestión',
}: ExportFinanceSummaryPdfOptions): Promise<void> {
  const [jsPdfModule, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ])

  const JsPdfClass: any = (jsPdfModule as any).jsPDF || (jsPdfModule as any).default || jsPdfModule
  const autoTable: any = (autoTableModule as any).default || autoTableModule

  const doc = new JsPdfClass({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 36
  const contentWidth = pageWidth - margin * 2

  const todayStr = new Date().toLocaleDateString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const periodLabel =
    startDate && endDate
      ? `${formatDateDisplay(startDate)} al ${formatDateDisplay(endDate)}`
      : 'Período completo seleccionado'

  let y = 30

  // Banner Corporativo
  doc.setFillColor(15, 23, 42)
  doc.roundedRect(margin, y, contentWidth, 54, 4, 4, 'F')

  doc.setFillColor(79, 70, 229)
  doc.rect(margin, y, contentWidth * 0.6, 3, 'F')
  doc.setFillColor(16, 185, 129)
  doc.rect(margin + contentWidth * 0.6, y, contentWidth * 0.4, 3, 'F')

  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(companyName.toUpperCase(), margin + 14, y + 22)

  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(203, 213, 225)
  doc.text('BALANCE FINANCIERO EJECUTIVO • ESTADO DE RESULTADOS Y CAJA', margin + 14, y + 38)

  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(`Emisión: ${todayStr}`, pageWidth - margin - 14, y + 22, { align: 'right' })
  doc.text(
    `Período: ${periodLabel} • Sucursal: ${branchName || 'Todas'}`,
    pageWidth - margin - 14,
    y + 38,
    { align: 'right' }
  )

  y += 68

  // Gran Comparativo: Resultado Devengado vs Flujo Financiero
  const isNetPositive = summary.accrued.netProfit !== null && summary.accrued.netProfit >= 0
  const isCashPositive = summary.cash.netCashFlow >= 0

  const halfWidth = (contentWidth - 14) / 2

  // Caja 1: Devengado
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, y, halfWidth, 54, 4, 4, 'FD')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('1. RESULTADO ECONÓMICO (DEVENGADO)', margin + 12, y + 16)

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(isNetPositive ? 16 : 225, isNetPositive ? 185 : 29, isNetPositive ? 129 : 72)
  doc.text(
    summary.accrued.netProfit === null ? 'Pendiente' : formatCurrency(summary.accrued.netProfit),
    margin + 12,
    y + 36
  )

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(
    summary.accrued.revenue > 0
      ? `Base facturada: ${formatCurrency(summary.accrued.revenue)}`
      : 'Sin ventas en el período',
    margin + 12,
    y + 48
  )

  // Caja 2: Flujo de Fondos
  const box2X = margin + halfWidth + 14
  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(box2X, y, halfWidth, 54, 4, 4, 'FD')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('2. FLUJO FINANCIERO (CAJA / BANCO)', box2X + 12, y + 16)

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(isCashPositive ? 16 : 225, isCashPositive ? 185 : 29, isCashPositive ? 129 : 72)
  doc.text(formatCurrency(summary.cash.netCashFlow), box2X + 12, y + 36)

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(
    `Cobrado: ${formatCurrency(summary.cash.collected)} − Pagado: ${formatCurrency(summary.cash.paid)}`,
    box2X + 12,
    y + 48
  )

  y += 66

  // Tabla Detallada del Estado de Resultados
  const grossMarginPercent =
    summary.accrued.revenue > 0 && summary.accrued.grossProfit !== null
      ? `${Math.round((summary.accrued.grossProfit / summary.accrued.revenue) * 100)}%`
      : '-'

  const netMarginPercent =
    summary.accrued.revenue > 0 && summary.accrued.netProfit !== null
      ? `${Math.round((summary.accrued.netProfit / summary.accrued.revenue) * 100)}%`
      : '-'

  const accruedTableRows = [
    ['(+) Ingresos Operativos', 'Ventas de mostrador y órdenes de taller', formatCurrency(summary.accrued.revenue), '100.0%'],
    [
      '(−) Costos Directos',
      'Pantallas, componentes y repuestos consumidos',
      summary.accrued.directCosts === null ? 'Pendiente' : formatCurrency(summary.accrued.directCosts),
      summary.accrued.directCosts !== null && summary.accrued.revenue > 0
        ? `${Math.round((summary.accrued.directCosts / summary.accrued.revenue) * 100)}%`
        : '-',
    ],
    ['(=) Utilidad Bruta Operativa', 'Margen directo de taller y comercio', formatCurrency(summary.accrued.grossProfit), grossMarginPercent],
    ['(−) Gastos Operativos (OPEX)', 'Alquiler, servicios, insumos y delivery', formatCurrency(summary.accrued.operatingExpenses), summary.accrued.revenue > 0 ? `${Math.round((summary.accrued.operatingExpenses / summary.accrued.revenue) * 100)}%` : '-'],
    ['(−) Nómina y Salarios', 'Sueldos fijos y comisiones a colaboradores', formatCurrency(summary.accrued.payrollCost), summary.accrued.revenue > 0 ? `${Math.round((summary.accrued.payrollCost / summary.accrued.revenue) * 100)}%` : '-'],
    ['(=) RESULTADO NETO FINAL', 'Ganancia líquida para retiro o reinversión', formatCurrency(summary.accrued.netProfit), netMarginPercent],
  ]

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Concepto Contable', 'Descripción', 'Monto en Guaraníes (Gs.)', '% Facturación']],
    body: accruedTableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 7.5,
      cellPadding: 4,
      lineColor: [226, 232, 240],
    },
    columnStyles: {
      0: { cellWidth: 160, fontStyle: 'bold' },
      1: { cellWidth: contentWidth - 360 },
      2: { cellWidth: 120, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 80, halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data: any) => {
      if (data.row.index === 2 || data.row.index === 5) {
        data.cell.styles.fillColor = [241, 245, 249]
        data.cell.styles.fontStyle = 'bold'
      }
    },
  })

  y = ((doc as any).lastAutoTable?.finalY ?? y + 140) + 14

  // Tabla de Cuentas por Pagar Urgentes (si existen)
  const urgentRows: [string, string, string, string][] = []
  summary.overdue.slice(0, 5).forEach((item) => {
    urgentRows.push(['VENCIDO', item.concept || 'Gasto pendiente', formatDateDisplay(item.dueDate), formatCurrency(item.amount)])
  })
  summary.upcomingDue.slice(0, 5).forEach((item) => {
    urgentRows.push(['PRÓXIMO', item.concept || 'Compromiso próximo', formatDateDisplay(item.dueDate), formatCurrency(item.amount)])
  })

  if (urgentRows.length > 0) {
    if (y > pageHeight - 160) {
      doc.addPage()
      y = 40
    }

    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text('COMPROMISOS Y CUENTAS POR PAGAR PRIORITARIAS:', margin, y)
    y += 8

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Estado', 'Concepto / Proveedor', 'Vencimiento', 'Monto Exigible (Gs.)']],
      body: urgentRows,
      theme: 'grid',
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontSize: 7.5,
        fontStyle: 'bold',
        cellPadding: 4,
      },
      bodyStyles: {
        fontSize: 7.5,
        cellPadding: 3.5,
        lineColor: [226, 232, 240],
      },
      columnStyles: {
        0: { cellWidth: 80, fontStyle: 'bold' },
        1: { cellWidth: contentWidth - 280 },
        2: { cellWidth: 90, halign: 'center' },
        3: { cellWidth: 110, halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data: any) => {
        if (data.column.index === 0 && data.cell.raw === 'VENCIDO') {
          data.cell.styles.textColor = [225, 29, 72]
        }
      },
    })

    y = ((doc as any).lastAutoTable?.finalY ?? y + 80) + 12
  }

  // Paginación
  const totalPages = (doc.internal as any).getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20)

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text('Sistema 4G • Balance Financiero Ejecutivo', margin, pageHeight - 10)
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
  }

  const cleanStartDate = (startDate || '').replace(/-/g, '')
  const cleanEndDate = (endDate || '').replace(/-/g, '')
  const dateSuffix = cleanStartDate && cleanEndDate ? `_${cleanStartDate}_${cleanEndDate}` : ''
  const filename = `Balance_Financiero_Ejecutivo${dateSuffix}.pdf`

  doc.save(filename)
}
