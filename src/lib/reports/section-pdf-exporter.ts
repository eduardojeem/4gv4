import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { CreditReport } from './credit-report'
import {
  renderAreaChartCanvas,
  renderBarChartCanvas,
  renderDonutChartCanvas
} from './canvas-chart-renderer'

// ── Helpers de formato ────────────────────────────────────────────────────────
const formatGs = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return '0 Gs.'
  return `${Math.round(amount).toLocaleString('es-PY')} Gs.`
}

const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined || isNaN(num)) return '0'
  return Math.round(num).toLocaleString('es-PY')
}

const formatDateStr = (dateStr: string): string => {
  if (!dateStr) return ''
  try {
    const parts = dateStr.split('T')[0].split('-')
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
    const d = new Date(dateStr)
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })
    }
  } catch {
    // fallback
  }
  return dateStr
}

const getDayOfWeekStr = (dateStr: string): string => {
  if (!dateStr) return ''
  try {
    const parts = dateStr.split('T')[0].split('-')
    if (parts.length === 3) {
      const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
      return days[d.getDay()] || ''
    }
  } catch {
    // fallback
  }
  return ''
}

const sanitizeFileName = (value: string) => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 120) || 'reporte'
}

// ── RENDERIZADOR DE CABECERA Y FOOTER ESTÁNDAR ────────────────────────────────
function setupDocPageHeadersAndFooters(doc: jsPDF, title: string, sectionSubtitle: string, dateLabel: string) {
  const totalPages = (doc.internal as any).getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 32

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)

    // Cabecera en todas las páginas después de la 1
    if (p > 1) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(148, 163, 184)
      doc.text(`${title} • ${sectionSubtitle}`, margin, 20)
      doc.text('Sistema 4G • Reporte Oficial', pageWidth - margin, 20, { align: 'right' })

      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.5)
      doc.line(margin, 24, pageWidth - margin, 24)
    }

    // Pie de página en todas las páginas
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(margin, pageHeight - 22, pageWidth - margin, pageHeight - 22)

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)
    doc.text(`Generado el ${dateLabel} • Documento Confidencial`, margin, pageHeight - 10)
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
  }
}

function renderExecutiveCoverHeader(
  doc: jsPDF,
  title: string,
  sectionSubtitle: string,
  dateLabel: string,
  margin: number,
  contentWidth: number,
  pageWidth: number
) {
  doc.setFillColor(15, 23, 42)
  doc.rect(margin, 24, contentWidth, 68, 'F')

  doc.setFillColor(37, 99, 235)
  doc.rect(margin, 24, contentWidth / 2, 4, 'F')
  doc.setFillColor(16, 185, 129)
  doc.rect(margin + contentWidth / 2, 24, contentWidth / 2, 4, 'F')

  doc.setFontSize(17)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(title.toUpperCase(), margin + 16, 52)

  doc.setFontSize(9.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text(sectionSubtitle.toUpperCase(), margin + 16, 72)

  doc.setFontSize(8.5)
  doc.setTextColor(203, 213, 225)
  doc.text(`Emisión: ${dateLabel}`, pageWidth - margin - 16, 52, { align: 'right' })
  doc.text('Sistema 4G • Confidencial', pageWidth - margin - 16, 72, { align: 'right' })
}

function renderKpiCardsGrid(
  doc: jsPDF,
  metrics: Record<string, string | number>,
  currentY: number,
  margin: number,
  contentWidth: number
): number {
  const metricEntries = Object.entries(metrics)
  if (metricEntries.length === 0) return currentY

  const cardsPerRow = 4
  const cardGap = 8
  const cardWidth = (contentWidth - ((cardsPerRow - 1) * cardGap)) / cardsPerRow
  const cardHeight = 48

  metricEntries.forEach(([key, val], idx) => {
    const row = Math.floor(idx / cardsPerRow)
    const col = idx % cardsPerRow
    const cardX = margin + col * (cardWidth + cardGap)
    const cardY = currentY + row * (cardHeight + cardGap)

    doc.setFillColor(248, 250, 252)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 5, 5, 'FD')

    const colors = [
      [37, 99, 235],
      [16, 185, 129],
      [124, 58, 237],
      [217, 119, 6],
      [6, 182, 212],
      [236, 72, 153],
    ]
    const color = colors[idx % colors.length]
    doc.setFillColor(color[0], color[1], color[2])
    doc.roundedRect(cardX, cardY, 3.5, cardHeight, 1.5, 1.5, 'F')

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(key.toUpperCase(), cardX + 10, cardY + 16, { maxWidth: cardWidth - 16 })

    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(String(val), cardX + 10, cardY + 34, { maxWidth: cardWidth - 16 })
  })

  const totalRows = Math.ceil(metricEntries.length / cardsPerRow)
  return currentY + totalRows * (cardHeight + cardGap) + 14
}

// ── 1. EXPORTADOR PDF DE VENTAS ───────────────────────────────────────────────
export async function exportSalesSectionPDF(params: {
  title: string
  salesData: any[]
  metrics: {
    totalSales: number
    totalOrders: number
    totalCustomers: number
    avgOrderValue: number
    totalProfit?: number
  }
  chartRef?: React.RefObject<HTMLDivElement | null>
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 32
  const contentWidth = pageWidth - (margin * 2)
  const now = new Date()
  const dateLabel = now.toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  renderExecutiveCoverHeader(doc, params.title, 'Informe Específico de Ventas y Facturación', dateLabel, margin, contentWidth, pageWidth)

  let y = 104
  const kpiMap: Record<string, any> = {
    'Ventas Totales': formatGs(params.metrics.totalSales),
    'Órdenes': formatNumber(params.metrics.totalOrders),
    'Clientes': formatNumber(params.metrics.totalCustomers),
    'Ticket Promedio': formatGs(params.metrics.avgOrderValue),
    ...(params.metrics.totalProfit !== undefined && params.metrics.totalProfit > 0 ? {
      'Ganancia Estimada': formatGs(params.metrics.totalProfit),
      'Margen Bruto': `${params.metrics.totalSales > 0 ? ((params.metrics.totalProfit / params.metrics.totalSales) * 100).toFixed(1) : 0}%`,
    } : {}),
  }
  y = renderKpiCardsGrid(doc, kpiMap, y, margin, contentWidth)

  // Gráfico Canvas de Alta Definición
  if (params.salesData.length > 0) {
    const chartImg = renderAreaChartCanvas(
      'Tendencia y Evolución Diaria de Ventas',
      params.salesData.map((d: any) => ({ label: formatDateStr(d.date), value: Number(d.sales) || 0 })),
      { lineColor: '#2563eb', fillColor: '#3b82f6', formatValue: formatGs }
    )
    if (chartImg) {
      doc.addImage(chartImg, 'PNG', margin, y, contentWidth, 175)
      y += 185
    }
  }

  // Tabla detallada de ventas
  const totalSalesSum = params.metrics.totalSales
  const rows = params.salesData.map((r: any) => {
    const s = Number(r.sales) || 0
    const o = Number(r.orders) || 0
    const p = Number(r.profit) || 0
    const t = o > 0 ? s / o : s
    const m = s > 0 ? ((p / s) * 100).toFixed(1) : '0'
    const share = totalSalesSum > 0 ? ((s / totalSalesSum) * 100).toFixed(1) : '0'

    return [
      formatDateStr(r.date),
      getDayOfWeekStr(r.date),
      formatGs(s),
      formatNumber(o),
      formatGs(t),
      p > 0 ? formatGs(p) : '—',
      p > 0 ? `${m}%` : '—',
      `${share}%`,
    ]
  })

  const foot = [[
    'TOTALES DEL PERÍODO',
    `${params.salesData.length} días`,
    formatGs(totalSalesSum),
    formatNumber(params.metrics.totalOrders),
    formatGs(params.metrics.avgOrderValue),
    params.metrics.totalProfit ? formatGs(params.metrics.totalProfit) : '—',
    params.metrics.totalProfit && totalSalesSum > 0 ? `${((params.metrics.totalProfit / totalSalesSum) * 100).toFixed(1)}%` : '—',
    '100%',
  ]]

  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Día', 'Facturación (Gs.)', 'Órdenes', 'Ticket Promedio', 'Ganancia Est.', 'Margen %', 'Part. %']],
    body: rows,
    foot,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 3.5, font: 'helvetica' },
    headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'center' },
      1: { halign: 'center' },
      2: { halign: 'right', fontStyle: 'bold' },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
    },
  })

  setupDocPageHeadersAndFooters(doc, params.title, 'Reporte Específico de Ventas', dateLabel)
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-')
  doc.save(`${sanitizeFileName(params.title)}_ventas_${timestamp}.pdf`)
}

// ── 2. EXPORTADOR PDF DE PRODUCTOS ────────────────────────────────────────────
export async function exportProductsSectionPDF(params: {
  title: string
  products: any[]
  chartRef?: React.RefObject<HTMLDivElement | null>
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 32
  const contentWidth = pageWidth - (margin * 2)
  const now = new Date()
  const dateLabel = now.toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  renderExecutiveCoverHeader(doc, params.title, 'Ranking y Análisis Comercial de Productos', dateLabel, margin, contentWidth, pageWidth)

  const totalSalesSum = params.products.reduce((acc, p) => acc + (Number(p.sales) || 0), 0)
  const totalQtySum = params.products.reduce((acc, p) => acc + (Number(p.quantity) || 0), 0)
  const totalProfitSum = params.products.reduce((acc, p) => acc + (Number(p.profit) || 0), 0)

  let y = 104
  const kpiMap: Record<string, any> = {
    'Total Facturado Catálogo': formatGs(totalSalesSum),
    'Unidades Vendidas': formatNumber(totalQtySum),
    'Artículos Diferentes': formatNumber(params.products.length),
    'Ganancia Total Estimada': formatGs(totalProfitSum),
  }
  y = renderKpiCardsGrid(doc, kpiMap, y, margin, contentWidth)

  // Gráfico Canvas de Barras
  if (params.products.length > 0) {
    const chartImg = renderBarChartCanvas(
      'Top 10 Productos Más Vendidos por Facturación',
      params.products.slice(0, 10).map((p: any) => ({ label: p.name || 'Sin nombre', value: Number(p.sales) || 0 })),
      { barColor: '#059669', formatValue: formatGs }
    )
    if (chartImg) {
      doc.addImage(chartImg, 'PNG', margin, y, contentWidth, 180)
      y += 190
    }
  }

  const rows = params.products.map((p: any, idx: number) => {
    const s = Number(p.sales) || 0
    const q = Number(p.quantity) || 0
    const prof = Number(p.profit) || 0
    const avg = q > 0 ? s / q : s
    const share = totalSalesSum > 0 ? ((s / totalSalesSum) * 100).toFixed(1) : (p.share?.toFixed(1) || '0')
    const marginPct = s > 0 ? ((prof / s) * 100).toFixed(1) : '0'

    return [
      `#${idx + 1}`,
      p.name || 'Sin nombre',
      p.category || 'General',
      formatNumber(q),
      formatGs(avg),
      formatGs(s),
      `${share}%`,
      prof > 0 ? formatGs(prof) : '—',
      prof > 0 ? `${marginPct}%` : '—',
    ]
  })

  const foot = [[
    '',
    'TOTALES CATÁLOGO',
    '',
    formatNumber(totalQtySum),
    '—',
    formatGs(totalSalesSum),
    '100%',
    totalProfitSum > 0 ? formatGs(totalProfitSum) : '—',
    totalSalesSum > 0 ? `${((totalProfitSum / totalSalesSum) * 100).toFixed(1)}%` : '—',
  ]]

  autoTable(doc, {
    startY: y,
    head: [['#', 'Producto', 'Categoría', 'Unidades', 'Precio Prom. Unit.', 'Facturación Total (Gs.)', 'Part. %', 'Ganancia (Gs.)', 'Margen %']],
    body: rows,
    foot,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 3.5, font: 'helvetica' },
    headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      1: { fontStyle: 'bold' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
    },
  })

  setupDocPageHeadersAndFooters(doc, params.title, 'Ranking de Productos', dateLabel)
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-')
  doc.save(`${sanitizeFileName(params.title)}_productos_${timestamp}.pdf`)
}

// ── 3. EXPORTADOR PDF DE CATEGORÍAS ───────────────────────────────────────────
export async function exportCategoriesSectionPDF(params: {
  title: string
  categories: any[]
  chartRef?: React.RefObject<HTMLDivElement | null>
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 32
  const contentWidth = pageWidth - (margin * 2)
  const now = new Date()
  const dateLabel = now.toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  renderExecutiveCoverHeader(doc, params.title, 'Participación y Ventas por Categoría Comercial', dateLabel, margin, contentWidth, pageWidth)

  const totalSalesSum = params.categories.reduce((acc, c) => acc + (Number(c.sales) || 0), 0)
  const totalQtySum = params.categories.reduce((acc, c) => acc + (Number(c.quantity) || 0), 0)

  let y = 104
  const kpiMap: Record<string, any> = {
    'Total en Rubros': formatGs(totalSalesSum),
    'Unidades Vendidas': formatNumber(totalQtySum),
    'Total Categorías': formatNumber(params.categories.length),
  }
  y = renderKpiCardsGrid(doc, kpiMap, y, margin, contentWidth)

  // Gráfico Canvas Donut
  if (params.categories.length > 0) {
    const chartImg = renderDonutChartCanvas(
      'Participación de Facturación por Categoría',
      params.categories.map((c: any) => ({ label: c.name || 'Sin Categoría', value: Number(c.sales) || 0 })),
      { formatValue: formatGs }
    )
    if (chartImg) {
      doc.addImage(chartImg, 'PNG', margin, y, contentWidth, 180)
      y += 190
    }
  }

  const rows = params.categories.map((c: any) => {
    const s = Number(c.sales) || 0
    const q = Number(c.quantity) || 0
    const avg = q > 0 ? s / q : s
    const share = totalSalesSum > 0 ? ((s / totalSalesSum) * 100).toFixed(1) : '0'

    return [
      c.name || 'Sin Categoría',
      formatNumber(q),
      formatGs(s),
      formatGs(avg),
      `${share}%`,
    ]
  })

  const foot = [['TOTAL GENERAL', formatNumber(totalQtySum), formatGs(totalSalesSum), '—', '100%']]

  autoTable(doc, {
    startY: y,
    head: [['Categoría Comercial', 'Unidades Vendidas', 'Ventas Totales (Gs.)', 'Ticket Promedio / Unid.', 'Participación %']],
    body: rows,
    foot,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8.5, cellPadding: 4.5, font: 'helvetica' },
    headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'right', fontStyle: 'bold' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  })

  setupDocPageHeadersAndFooters(doc, params.title, 'Desglose por Categorías', dateLabel)
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-')
  doc.save(`${sanitizeFileName(params.title)}_categorias_${timestamp}.pdf`)
}

// ── 4. EXPORTADOR PDF DE REPARACIONES / TALLER ─────────────────────────────────
export async function exportRepairsSectionPDF(params: {
  title: string
  trend: any[]
  statusDist: any[]
  metrics: {
    total: number
    completed?: number
    inProgress?: number
    completionRate: number
    avgCost?: number
    avgTATDays?: number
    avgLabor?: number
    avgParts?: number
  }
  chartRefs?: React.RefObject<HTMLDivElement | null>[]
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 32
  const contentWidth = pageWidth - (margin * 2)
  const now = new Date()
  const dateLabel = now.toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  renderExecutiveCoverHeader(doc, params.title, 'Informe Técnico de Reparaciones y Taller', dateLabel, margin, contentWidth, pageWidth)

  let y = 104
  const kpiMap: Record<string, any> = {
    'Órdenes Totales': formatNumber(params.metrics.total),
    'Finalizadas / Entregadas': formatNumber(params.metrics.completed),
    'En Proceso Técnico': formatNumber(params.metrics.inProgress),
    'Tasa de Finalización': `${params.metrics.completionRate.toFixed(1)}%`,
  }
  y = renderKpiCardsGrid(doc, kpiMap, y, margin, contentWidth)

  // Gráficos Canvas (Distribución de Estados y Tendencia)
  if (params.statusDist.length > 0) {
    const chartImg = renderDonutChartCanvas(
      'Distribución de Órdenes por Estado Operativo',
      params.statusDist.map((s: any) => ({ label: s.name, value: Number(s.value) || 0, color: s.color })),
      { formatValue: (v) => `${v} equipos` }
    )
    if (chartImg) {
      doc.addImage(chartImg, 'PNG', margin, y, contentWidth, 160)
      y += 170
    }
  }

  // Tablas de estados y tendencia
  const totalRepairs = params.statusDist.reduce((acc, s) => acc + (Number(s.value) || 0), 0)
  const statusRows = params.statusDist.map((s: any) => {
    const val = Number(s.value) || 0
    const pct = totalRepairs > 0 ? ((val / totalRepairs) * 100).toFixed(1) : '0'
    return [s.name, formatNumber(val), `${pct}%`]
  })

  autoTable(doc, {
    startY: y,
    head: [['Estado de la Orden', 'Equipos Registrados', 'Distribución %']],
    body: statusRows,
    foot: [['TOTAL ÓRDENES', formatNumber(totalRepairs), '100%']],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8.5, cellPadding: 4, font: 'helvetica' },
    headStyles: { fillColor: [124, 58, 237], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'right' },
    },
  })

  let nextY = (doc as any).lastAutoTable.finalY + 16

  if (params.trend.length > 0) {
    const totalTrendCount = params.trend.reduce((acc, t) => acc + (Number(t.count) || 0), 0)
    const trendRows = params.trend.slice(0, 31).map((t: any) => {
      const c = Number(t.count) || 0
      const pct = totalTrendCount > 0 ? ((c / totalTrendCount) * 100).toFixed(1) : '0'
      return [formatDateStr(t.date), getDayOfWeekStr(t.date), formatNumber(c), `${pct}%`]
    })

    autoTable(doc, {
      startY: nextY,
      head: [['Fecha', 'Día', 'Reparaciones Ingresadas', 'Participación %']],
      body: trendRows,
      foot: [['TOTAL INGRESOS TALLER', `${params.trend.length} días`, formatNumber(totalTrendCount), '100%']],
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 3.5, font: 'helvetica' },
      headStyles: { fillColor: [220, 38, 38], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center' },
        1: { halign: 'center' },
        2: { halign: 'right', fontStyle: 'bold' },
        3: { halign: 'right' },
      },
    })
  }

  setupDocPageHeadersAndFooters(doc, params.title, 'Reporte de Taller y Reparaciones', dateLabel)
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-')
  doc.save(`${sanitizeFileName(params.title)}_reparaciones_${timestamp}.pdf`)
}

// ── 5. EXPORTADOR PDF DE CRÉDITOS Y COBRANZAS ──────────────────────────────────
export async function exportCreditsSectionPDF(params: {
  title: string
  report: CreditReport | null
  chartRef?: React.RefObject<HTMLDivElement | null>
}) {
  if (!params.report) return

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 32
  const contentWidth = pageWidth - (margin * 2)
  const now = new Date()
  const dateLabel = now.toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  renderExecutiveCoverHeader(doc, params.title, 'Informe de Créditos, Cartera y Cobranzas', dateLabel, margin, contentWidth, pageWidth)

  let y = 104
  const kpiMap: Record<string, any> = {
    'Créditos Otorgados': formatNumber(params.report.period.grantedCount),
    'Capital Financiado': formatGs(params.report.period.principalGranted),
    'Cobranzas Recibidas': formatGs(params.report.period.paymentsReceived),
    'Cartera Activa por Cobrar': formatGs(params.report.portfolio.outstandingAmount),
    'Monto en Mora': formatGs(params.report.portfolio.overdueAmount),
    'Tasa de Cobranza': `${params.report.portfolio.collectionRate.toFixed(1)}%`,
    'Clientes con Mora': formatNumber(params.report.portfolio.overdueCustomers),
    'Cuotas por Vencer Pronto': formatGs(params.report.portfolio.dueSoonAmount),
  }
  y = renderKpiCardsGrid(doc, kpiMap, y, margin, contentWidth)

  // Gráfico Canvas de Cobranzas
  if (params.report.paymentTrend.length > 0) {
    const chartImg = renderAreaChartCanvas(
      'Evolución Diaria de Cobranzas y Pagos Recibidos',
      params.report.paymentTrend.map((p) => ({ label: formatDateStr(p.date), value: p.amount })),
      { lineColor: '#0f766e', fillColor: '#14b8a6', formatValue: formatGs }
    )
    if (chartImg) {
      doc.addImage(chartImg, 'PNG', margin, y, contentWidth, 160)
      y += 170
    }
  }

  // Tabla 1: Estado de Cartera
  const statusLabels: Record<string, string> = {
    active: 'Al día',
    overdue: 'Con mora',
    completed: 'Cancelados / Pagados',
  }
  const totalStatusCount = params.report.statusDistribution.reduce((acc, s) => acc + s.count, 0)
  const statusRows = params.report.statusDistribution.map((st) => {
    const pct = totalStatusCount > 0 ? ((st.count / totalStatusCount) * 100).toFixed(1) : '0'
    return [
      statusLabels[st.status] || st.status,
      formatNumber(st.count),
      `${pct}%`,
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['Estado de la Cuenta de Crédito', 'Cantidad de Créditos', 'Participación %']],
    body: statusRows,
    foot: [['TOTAL CUENTAS REGISTRADAS', formatNumber(totalStatusCount), '100%']],
    margin: { left: margin, right: margin },
    styles: { fontSize: 8.5, cellPadding: 4, font: 'helvetica' },
    headStyles: { fillColor: [15, 118, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'right' },
    },
  })

  let nextY = (doc as any).lastAutoTable.finalY + 16

  // Tabla 2: Evolución de Pagos Recibidos
  if (params.report.paymentTrend.length > 0) {
    const totalPaymentsReceived = params.report.paymentTrend.reduce((acc, p) => acc + p.amount, 0)
    const paymentRows = params.report.paymentTrend.slice(0, 31).map((p) => {
      const pct = totalPaymentsReceived > 0 ? ((p.amount / totalPaymentsReceived) * 100).toFixed(1) : '0'
      return [
        formatDateStr(p.date),
        getDayOfWeekStr(p.date),
        formatGs(p.amount),
        `${pct}%`,
      ]
    })

    autoTable(doc, {
      startY: nextY,
      head: [['Fecha', 'Día', 'Monto Cobrado (Gs.)', 'Participación sobre Cobranzas %']],
      body: paymentRows,
      foot: [['TOTAL COBRANZAS DEL PERÍODO', `${params.report.paymentTrend.length} días`, formatGs(totalPaymentsReceived), '100%']],
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 3.5, font: 'helvetica' },
      headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center' },
        1: { halign: 'center' },
        2: { halign: 'right', fontStyle: 'bold' },
        3: { halign: 'right' },
      },
    })
  }

  setupDocPageHeadersAndFooters(doc, params.title, 'Reporte de Créditos y Cobranzas', dateLabel)
  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-')
  doc.save(`${sanitizeFileName(params.title)}_creditos_${timestamp}.pdf`)
}
