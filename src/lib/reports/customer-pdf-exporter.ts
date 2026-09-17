import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { type ReportContext, describeReportPeriod } from './section-pdf-exporter'

// ── Helpers de formato ────────────────────────────────────────────────────────
const formatGs = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || isNaN(amount)) return '0 Gs.'
  return `${Math.round(amount).toLocaleString('es-PY')} Gs.`
}

const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined || isNaN(num)) return '0'
  return Math.round(num).toLocaleString('es-PY')
}

const formatDateStr = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '—'
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

const sanitizeFileName = (value: string) => {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 120) || 'reporte_clientes'
}

function capRows<T>(rows: T[], max = 400): { rows: T[]; omitidas: number } {
  if (rows.length <= max) return { rows, omitidas: 0 }
  return { rows: rows.slice(0, max), omitidas: rows.length - max }
}

function renderOmittedNote(doc: jsPDF, omitidas: number, margin: number) {
  if (omitidas <= 0) return
  const y = (doc as any).lastAutoTable.finalY + 12
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(180, 83, 9)
  doc.text(
    `Se listan los primeros clientes por tamaño del documento: quedaron ${formatNumber(omitidas)} fuera de la tabla. Los totales del pie sí incluyen todo el período.`,
    margin,
    y
  )
}

function renderExecutiveCoverHeader(
  doc: jsPDF,
  title: string,
  sectionSubtitle: string,
  dateLabel: string,
  margin: number,
  contentWidth: number,
  pageWidth: number,
  context?: ReportContext
) {
  const periodo = describeReportPeriod(context)
  const alturaExtra = periodo || context?.branchName ? 20 : 0

  doc.setFillColor(15, 23, 42)
  doc.rect(margin, 24, contentWidth, 68 + alturaExtra, 'F')

  doc.setFillColor(37, 99, 235)
  doc.rect(margin, 24, contentWidth / 2, 4, 'F')
  doc.setFillColor(16, 185, 129)
  doc.rect(margin + contentWidth / 2, 24, contentWidth / 2, 4, 'F')

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(title.toUpperCase(), margin + 16, 52)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text(sectionSubtitle.toUpperCase(), margin + 16, 72)

  doc.setFontSize(8.5)
  doc.setTextColor(203, 213, 225)
  doc.text(`Emisión: ${dateLabel}`, pageWidth - margin - 16, 52, { align: 'right' })
  doc.text('Sistema 4G • Confidencial', pageWidth - margin - 16, 72, { align: 'right' })

  if (periodo || context?.branchName) {
    const partes: string[] = []
    if (periodo) partes.push(`Período: ${periodo}`)
    partes.push(`Sucursal: ${context?.branchName?.trim() || 'Todas'}`)

    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(226, 232, 240)
    doc.text(partes.join('     •     '), margin + 16, 92, { maxWidth: contentWidth - 32 })
  }
}

function coverBottom(context?: ReportContext): number {
  return describeReportPeriod(context) || context?.branchName ? 124 : 104
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
      [79, 70, 229],
      [15, 118, 110],
    ]
    const color = colors[idx % colors.length]
    doc.setFillColor(color[0], color[1], color[2])
    doc.roundedRect(cardX, cardY, 3.5, cardHeight, 1.5, 1.5, 'F')

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(key.toUpperCase(), cardX + 10, cardY + 16, { maxWidth: cardWidth - 16 })

    doc.setFontSize(10.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(String(val), cardX + 10, cardY + 34, { maxWidth: cardWidth - 16 })
  })

  const totalRows = Math.ceil(metricEntries.length / cardsPerRow)
  return currentY + totalRows * (cardHeight + cardGap) + 14
}

function setupDocPageHeadersAndFooters(
  doc: jsPDF,
  title: string,
  sectionSubtitle: string,
  dateLabel: string,
  context?: ReportContext
) {
  const totalPages = (doc.internal as any).getNumberOfPages()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 32

  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)

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

    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.5)
    doc.line(margin, pageHeight - 22, pageWidth - margin, pageHeight - 22)

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(148, 163, 184)

    const periodo = describeReportPeriod(context)
    const pie = [
      periodo ? `Período ${periodo}` : null,
      `Generado el ${dateLabel}`,
      context?.generatedBy?.trim() ? `por ${context.generatedBy.trim()}` : null,
      'Documento Confidencial',
    ].filter(Boolean).join(' • ')

    doc.text(pie, margin, pageHeight - 10, { maxWidth: pageWidth - margin * 2 - 90 })
    doc.text(`Página ${p} de ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: 'right' })
  }
}

export interface CustomerPDFItem {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  customerType: string
  totalSpent: number
  ordersCount: number
  posSpent: number
  posOrdersCount: number
  webSpent: number
  webOrdersCount: number
  channel: 'all' | 'pos' | 'web' | 'both'
  averageTicket: number
  lastPurchase: string | null
  firstPurchase: string | null
  isNew: boolean
  isRecurrent: boolean
  repairsSpent?: number
  repairsCount?: number
}

export interface CustomerPDFMetrics {
  totalCustomers: number
  totalSpent: number
  totalPosSpent: number
  totalWebSpent: number
  totalRepairsSpent?: number
  totalPosOrders: number
  totalWebOrders: number
  totalRepairsCount?: number
  posOnlyCustomers: number
  webOnlyCustomers: number
  hybridCustomers: number
  repairsCustomers?: number
  recurrentCount: number
  newCount: number
  retentionRate: number
  avgTicket: number
}

export async function exportCustomersSectionPDF(params: {
  title: string
  customers: CustomerPDFItem[]
  metrics: CustomerPDFMetrics
  hasRepairs?: boolean
  context?: ReportContext
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 32
  const contentWidth = pageWidth - (margin * 2)
  const now = new Date()
  const dateLabel = now.toLocaleString('es-PY', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  renderExecutiveCoverHeader(
    doc,
    params.title,
    'Reporte de Comportamiento de Clientes y Canales de Venta (Local vs Web)',
    dateLabel,
    margin,
    contentWidth,
    pageWidth,
    params.context
  )

  let y = coverBottom(params.context)

  const posPct = params.metrics.totalSpent > 0 ? ((params.metrics.totalPosSpent / params.metrics.totalSpent) * 100).toFixed(1) : '0'
  const webPct = params.metrics.totalSpent > 0 ? ((params.metrics.totalWebSpent / params.metrics.totalSpent) * 100).toFixed(1) : '0'
  const repairsPct = params.hasRepairs && params.metrics.totalSpent > 0
    ? (((params.metrics.totalRepairsSpent ?? 0) / params.metrics.totalSpent) * 100).toFixed(1)
    : '0'

  const kpiMap: Record<string, string> = {
    'Total Compradores': formatNumber(params.metrics.totalCustomers),
    'Facturación Clientes': formatGs(params.metrics.totalSpent),
    'Canal Local (POS)': `${formatGs(params.metrics.totalPosSpent)} (${posPct}%)`,
    'Canal Web (Online)': `${formatGs(params.metrics.totalWebSpent)} (${webPct}%)`,
    ...(params.hasRepairs ? {
      'Canal Taller': `${formatGs(params.metrics.totalRepairsSpent ?? 0)} (${repairsPct}%)`,
      'Clientes c/ Taller': `${formatNumber(params.metrics.repairsCustomers ?? 0)}`,
    } : {}),
    'Clientes Solo Local': `${formatNumber(params.metrics.posOnlyCustomers)}`,
    'Clientes Solo Web': `${formatNumber(params.metrics.webOnlyCustomers)}`,
    'Omnicanal (Ambos)': `${formatNumber(params.metrics.hybridCustomers)}`,
    'Tasa de Recurrencia': `${params.metrics.retentionRate.toFixed(1)}%`,
  }

  y = renderKpiCardsGrid(doc, kpiMap, y, margin, contentWidth)

  const { rows: clientesVisibles, omitidas } = capRows(params.customers)

  const rows = clientesVisibles.map((c, index) => {
    const contactInfo = [c.phone, c.email].filter(Boolean).join(' · ')
    const clientLabel = contactInfo ? `${c.name}\n${contactInfo}` : c.name

    let channelText = 'Solo Local (POS)'
    if (c.channel === 'both' || (c.posOrdersCount > 0 && c.webOrdersCount > 0)) {
      channelText = 'Omnicanal (Ambos)'
    } else if (c.channel === 'web' || c.webOrdersCount > 0) {
      channelText = 'Solo Tienda Web'
    } else if ((c.repairsCount ?? 0) > 0 && c.posOrdersCount === 0 && c.webOrdersCount === 0) {
      channelText = 'Solo Taller'
    }

    let segmentText = 'Regular'
    if (c.customerType === 'empresa') segmentText = 'Empresa'
    else if (c.customerType === 'premium') segmentText = 'VIP'
    else if (c.isNew) segmentText = 'Nuevo'
    else if (c.isRecurrent) segmentText = 'Recurrente'

    const pct = params.metrics.totalSpent > 0 ? ((c.totalSpent / params.metrics.totalSpent) * 100).toFixed(1) : '0'

    const posDetail = c.posOrdersCount > 0 ? `${formatGs(c.posSpent)} (${c.posOrdersCount})` : '—'
    const webDetail = c.webOrdersCount > 0 ? `${formatGs(c.webSpent)} (${c.webOrdersCount})` : '—'
    const repairsDetail = params.hasRepairs
      ? ((c.repairsCount ?? 0) > 0 ? `${formatGs(c.repairsSpent ?? 0)} (${c.repairsCount})` : '—')
      : null

    const baseRow = [
      String(index + 1),
      clientLabel,
      channelText,
      segmentText,
      formatGs(c.totalSpent),
      `${pct}%`,
      posDetail,
      webDetail,
    ]

    if (params.hasRepairs) baseRow.push(repairsDetail ?? '—')
    baseRow.push(formatGs(c.averageTicket), formatDateStr(c.lastPurchase))

    return baseRow
  })

  const footRow: string[] = [
    '',
    `TOTALES (${params.customers.length} clientes)`,
    '—',
    '—',
    formatGs(params.metrics.totalSpent),
    '100%',
    `${formatGs(params.metrics.totalPosSpent)} (${formatNumber(params.metrics.totalPosOrders)} ventas)`,
    `${formatGs(params.metrics.totalWebSpent)} (${formatNumber(params.metrics.totalWebOrders)} pedidos)`,
  ]
  if (params.hasRepairs) {
    footRow.push(`${formatGs(params.metrics.totalRepairsSpent ?? 0)} (${formatNumber(params.metrics.totalRepairsCount ?? 0)} rep)`)
  }
  footRow.push(formatGs(params.metrics.avgTicket), '—')

  const foot = [footRow]

  const headRow = [
    '#',
    'Cliente y Contacto',
    'Canal de Compra',
    'Segmento',
    'Facturación Total (Gs.)',
    'Part. %',
    'Ventas Local (POS)',
    'Pedidos Tienda Web',
    ...(params.hasRepairs ? ['Taller (Reparaciones)'] : []),
    'Ticket Prom.',
    'Última Compra',
  ]

  const repairsColIdx = params.hasRepairs ? 8 : null
  const ticketColIdx = params.hasRepairs ? 9 : 8
  const lastPurchaseColIdx = params.hasRepairs ? 10 : 9

  autoTable(doc, {
    startY: y,
    head: [headRow],
    body: rows,
    foot,
    margin: { left: margin, right: margin },
    styles: { fontSize: 7.5, cellPadding: 3.5, font: 'helvetica' },
    headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 145, fontStyle: 'bold' },
      2: { cellWidth: 80, halign: 'center' },
      3: { cellWidth: 60, halign: 'center' },
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      ...(repairsColIdx !== null ? { [repairsColIdx]: { halign: 'right' } } : {}),
      [ticketColIdx]: { halign: 'right' },
      [lastPurchaseColIdx]: { halign: 'center' },
    },
  })

  renderOmittedNote(doc, omitidas, margin)
  setupDocPageHeadersAndFooters(doc, params.title, 'Reporte de Clientes y Canales de Venta', dateLabel, params.context)

  const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-')
  doc.save(`${sanitizeFileName(params.title)}_${timestamp}.pdf`)
}
