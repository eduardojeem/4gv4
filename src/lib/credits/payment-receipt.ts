import { formatCurrency } from '@/lib/currency'
import { formatCreditId, formatCustomerId } from '@/lib/utils'

export type CreditPaymentReceiptMethod = 'cash' | 'card' | 'transfer' | string | null | undefined

export type CreditPaymentReceiptInput = {
  paymentId: string
  paymentDate?: string | Date | null
  paymentAmount: number
  paymentMethod?: CreditPaymentReceiptMethod
  reference?: string | null
  notes?: string | null
  customerName: string
  customerId?: string | null
  customerCode?: string | null
  customerRuc?: string | null
  customerPhone?: string | null
  creditId: string
  creditCode?: string | null
  creditTypeLabel?: string | null
  originLabel?: string | null
  creditLabel?: string | null
  saleCode?: string | null
  productSummary?: string | null
  totalCreditAmount?: number | null
  totalInstallments?: number | null
  paidInstallmentsCount?: number | null
  pendingInstallmentsCount?: number | null
  installmentNumber?: number | null
  installmentDueDate?: string | null
  installmentAmount?: number | null
  currentCreditBalance?: number | null
  nextDueDate?: string | null
  nextDueAmount?: number | null
  businessName?: string | null
}

export const CREDIT_PAYMENT_RECEIPT_WIDTH_MM = 80
export const CREDIT_PAYMENT_RECEIPT_HEIGHT_MM = 220
export const CREDIT_PAYMENT_RECEIPT_MAX_HEIGHT_MM = 950

export type CreditPaymentReceiptPdfOptions = {
  printerWidthMm?: number
}

export function getCreditPaymentReceiptLayout(pageWidthMm: number) {
  const margin = Math.max(3, Math.min(5, pageWidthMm * 0.05))
  const usableWidth = Math.max(1, pageWidthMm - margin * 2)
  const labelColumnWidth = Math.max(20, Math.min(32, usableWidth * 0.40))
  const isNarrow = pageWidthMm < 70

  return {
    margin,
    usableWidth,
    labelColumnWidth,
    valueColumnWidth: Math.max(1, usableWidth - labelColumnWidth),
    headerHeight: isNarrow ? 24 : 26,
    titleFontSize: isNarrow ? 9 : 10.5,
    receiptFontSize: isNarrow ? 7.5 : 8.5,
    metaFontSize: isNarrow ? 6.5 : 7.2,
    tableHeaderFontSize: isNarrow ? 7 : 8,
    tableBodyFontSize: isNarrow ? 6.5 : 7.2,
    footerFontSize: isNarrow ? 5.8 : 6.5,
    cellPadding: isNarrow ? 1.2 : 1.6,
    sectionGap: isNarrow ? 3 : 4,
    footerBottom: isNarrow ? 6 : 8,
  }
}

type ReceiptRow = [string, string]

function estimateWrappedLines(value: string, columnWidthMm: number) {
  const normalized = String(value || '').trim()
  if (!normalized) return 1

  const charactersPerLine = Math.max(8, Math.floor(columnWidthMm * 1.15))
  return normalized
    .split(/\r?\n/)
    .reduce((lines, part) => lines + Math.max(1, Math.ceil(part.length / charactersPerLine)), 0)
}

function estimateTableHeight(rows: ReceiptRow[], layout: ReturnType<typeof getCreditPaymentReceiptLayout>) {
  const headerHeight = layout.tableHeaderFontSize * 0.55 + layout.cellPadding * 2
  const lineHeight = layout.tableBodyFontSize * 0.45
  const bodyHeight = rows.reduce((height, [label, value]) => {
    const labelLines = estimateWrappedLines(label, layout.labelColumnWidth)
    const valueLines = estimateWrappedLines(value, layout.valueColumnWidth)
    return height + Math.max(labelLines, valueLines) * lineHeight + layout.cellPadding * 2
  }, 0)

  return headerHeight + bodyHeight
}

export function buildCreditInfoRows(input: CreditPaymentReceiptInput): ReceiptRow[] {
  const creditCode = input.creditCode || formatCreditId(input.creditId)
  const customerCode = input.customerRuc || input.customerCode || formatCustomerId(input.customerId)

  const rows: ReceiptRow[] = [
    ['Cliente', input.customerName],
  ]

  if (customerCode) {
    rows.push(['RUC / CI / ID', customerCode])
  }
  if (input.customerPhone) {
    rows.push(['Teléfono', input.customerPhone])
  }

  rows.push(['Crédito Nº', creditCode])

  if (input.saleCode) {
    rows.push(['Ticket Venta', input.saleCode])
  } else if (input.originLabel) {
    rows.push(['Origen', input.originLabel])
  }

  if (input.productSummary) {
    rows.push(['Detalle Venta', input.productSummary])
  } else if (input.creditLabel) {
    rows.push(['Concepto', input.creditLabel])
  }

  if (typeof input.totalCreditAmount === 'number' && input.totalCreditAmount > 0) {
    const planText = input.totalInstallments ? ` (${input.totalInstallments} cuotas)` : ''
    rows.push(['Total Financiado', `${formatCurrency(input.totalCreditAmount)}${planText}`])
  }

  return rows
}

export function buildPaymentDetailRows(input: CreditPaymentReceiptInput): ReceiptRow[] {
  const rows: ReceiptRow[] = []

  if (input.installmentNumber) {
    const totalInstText = input.totalInstallments ? ` de ${input.totalInstallments}` : ''
    rows.push(['Cuota Pagada', `Cuota #${input.installmentNumber}${totalInstText}`])
  }

  if (input.installmentDueDate) {
    rows.push(['Vencimiento Cuota', new Date(input.installmentDueDate).toLocaleDateString('es-AR')])
  }

  if (typeof input.installmentAmount === 'number' && input.installmentAmount > 0) {
    rows.push(['Valor Cuota', formatCurrency(input.installmentAmount)])
  }

  // Monto pagado
  rows.push(['MONTO ABONADO', formatCurrency(input.paymentAmount)])
  rows.push(['Método de Pago', getCreditPaymentMethodLabel(input.paymentMethod)])

  if (input.reference) {
    rows.push(['Referencia / N° Trans.', input.reference])
  }

  if (input.notes) {
    rows.push(['Observaciones', input.notes])
  }

  return rows
}

export function buildAccountStatusRows(input: CreditPaymentReceiptInput): ReceiptRow[] {
  const rows: ReceiptRow[] = []

  if (typeof input.currentCreditBalance === 'number') {
    const balance = Math.max(0, input.currentCreditBalance)
    if (balance === 0) {
      rows.push(['SALDO PENDIENTE', 'Gs. 0 (TOTALMENTE SALDADO)'])
    } else {
      rows.push(['SALDO PENDIENTE (FALTA)', formatCurrency(balance)])
    }
  }

  if (typeof input.pendingInstallmentsCount === 'number') {
    if (input.pendingInstallmentsCount === 0) {
      rows.push(['Cuotas Restantes', '0 cuotas (Completado)'])
    } else {
      rows.push(['Cuotas por Pagar', `${input.pendingInstallmentsCount} cuota${input.pendingInstallmentsCount !== 1 ? 's' : ''} pendiente${input.pendingInstallmentsCount !== 1 ? 's' : ''}`])
    }
  }

  if (input.nextDueDate) {
    const nextAmountText = typeof input.nextDueAmount === 'number' && input.nextDueAmount > 0 ? ` (${formatCurrency(input.nextDueAmount)})` : ''
    rows.push(['Próximo Vencimiento', `${new Date(input.nextDueDate).toLocaleDateString('es-AR')}${nextAmountText}`])
  }

  return rows
}

export function getCreditPaymentReceiptHeight(input: CreditPaymentReceiptInput, printerWidthMm = CREDIT_PAYMENT_RECEIPT_WIDTH_MM) {
  const pageWidthMm = Math.max(48, Math.min(90, printerWidthMm))
  const layout = getCreditPaymentReceiptLayout(pageWidthMm)
  const creditRows = buildCreditInfoRows(input)
  const paymentRows = buildPaymentDetailRows(input)
  const statusRows = buildAccountStatusRows(input)

  const estimatedHeight =
    layout.headerHeight +
    14 +
    estimateTableHeight(creditRows, layout) +
    layout.sectionGap +
    estimateTableHeight(paymentRows, layout) +
    layout.sectionGap +
    (statusRows.length > 0 ? estimateTableHeight(statusRows, layout) + layout.sectionGap : 0) +
    32

  return Math.max(
    CREDIT_PAYMENT_RECEIPT_HEIGHT_MM,
    Math.min(CREDIT_PAYMENT_RECEIPT_MAX_HEIGHT_MM, Math.ceil(estimatedHeight))
  )
}

export function getCreditPaymentMethodLabel(method: CreditPaymentReceiptMethod) {
  switch (method) {
    case 'cash':
      return 'Efectivo'
    case 'card':
      return 'Tarjeta'
    case 'transfer':
      return 'Transferencia'
    default:
      return method || 'No especificado'
  }
}

export function buildCreditPaymentReceiptNumber(paymentId: string) {
  const cleanId = paymentId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  return `REC-${cleanId.slice(0, 10) || Date.now().toString(36).toUpperCase()}`
}

export function getCreditCurrentBalance(installments: Array<{ credit_id: string; amount: number; amount_paid?: number | null }>, creditId: string) {
  return installments
    .filter((installment) => installment.credit_id === creditId)
    .reduce((sum, installment) => {
      const amount = Number(installment.amount || 0)
      const paid = Math.max(0, Number(installment.amount_paid || 0))
      return sum + Math.max(0, amount - paid)
    }, 0)
}

export async function createCreditPaymentReceiptPdf(
  input: CreditPaymentReceiptInput,
  options: CreditPaymentReceiptPdfOptions = {}
) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')
  const printerWidthMm = Math.max(48, Math.min(90, options.printerWidthMm ?? CREDIT_PAYMENT_RECEIPT_WIDTH_MM))
  const receiptHeightMm = getCreditPaymentReceiptHeight(input, printerWidthMm)

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [printerWidthMm, receiptHeightMm],
  })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const layout = getCreditPaymentReceiptLayout(pageW)
  const receiptNumber = buildCreditPaymentReceiptNumber(input.paymentId)
  const paidAt = input.paymentDate ? new Date(input.paymentDate) : new Date()
  const creditRows = buildCreditInfoRows(input)
  const paymentRows = buildPaymentDetailRows(input)
  const statusRows = buildAccountStatusRows(input)

  // 1. Cabecera Elegante
  doc.setFillColor(15, 23, 42) // Slate 900
  doc.rect(0, 0, pageW, layout.headerHeight, 'F')
  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(layout.titleFontSize)
  doc.text('COMPROBANTE DE PAGO', pageW / 2, layout.headerHeight * 0.38, {
    align: 'center',
    maxWidth: layout.usableWidth,
  })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(layout.receiptFontSize)
  doc.setTextColor(147, 197, 253) // Light Blue 300
  doc.text(receiptNumber, pageW / 2, layout.headerHeight * 0.72, {
    align: 'center',
    maxWidth: layout.usableWidth,
  })
  doc.setTextColor(0)

  // 2. Fecha de Emisión
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(layout.metaFontSize)
  doc.setTextColor(100)
  doc.text(`Fecha y Hora: ${paidAt.toLocaleString('es-AR')}`, pageW / 2, layout.headerHeight + 5, {
    align: 'center',
    maxWidth: layout.usableWidth,
  })
  doc.setTextColor(0)

  // 3. Tabla 1: Cliente y Crédito
  autoTable(doc, {
    startY: layout.headerHeight + 9,
    head: [['DATOS DEL CLIENTE Y VENTA', '']],
    body: creditRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: layout.tableHeaderFontSize },
    bodyStyles: { fontSize: layout.tableBodyFontSize },
    styles: { cellPadding: layout.cellPadding, overflow: 'linebreak' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: layout.labelColumnWidth, textColor: [71, 85, 105] },
      1: { cellWidth: layout.valueColumnWidth, fontStyle: 'normal' },
    },
    margin: { left: layout.margin, right: layout.margin },
  })

  // 4. Tabla 2: Detalle del Pago (Cuota Pagada)
  const afterCredit = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  autoTable(doc, {
    startY: afterCredit + layout.sectionGap,
    head: [['DETALLE DEL PAGO EFECTUADO', '']],
    body: paymentRows,
    theme: 'grid',
    headStyles: { fillColor: [16, 115, 74], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: layout.tableHeaderFontSize },
    bodyStyles: { fontSize: layout.tableBodyFontSize },
    styles: { cellPadding: layout.cellPadding, overflow: 'linebreak' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: layout.labelColumnWidth, textColor: [22, 101, 52] },
      1: { cellWidth: layout.valueColumnWidth, fontStyle: 'bold' },
    },
    margin: { left: layout.margin, right: layout.margin },
  })

  // 5. Tabla 3: Estado de Cuenta (¿Cuánto Falta?)
  let afterStatus = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  if (statusRows.length > 0) {
    autoTable(doc, {
      startY: afterStatus + layout.sectionGap,
      head: [['ESTADO DE CUENTA (CUANTO FALTA)', '']],
      body: statusRows,
      theme: 'grid',
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: layout.tableHeaderFontSize },
      bodyStyles: { fontSize: layout.tableBodyFontSize },
      styles: { cellPadding: layout.cellPadding, overflow: 'linebreak' },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: layout.labelColumnWidth, textColor: [51, 65, 85] },
        1: { cellWidth: layout.valueColumnWidth, fontStyle: 'bold' },
      },
      margin: { left: layout.margin, right: layout.margin },
    })
    afterStatus = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  }

  // 6. Firma y Pie de Recibo
  const signatureY = afterStatus + layout.sectionGap + 10
  if (signatureY + 12 < pageH) {
    doc.setDrawColor(180, 180, 180)
    doc.setLineDashPattern([1, 1], 0)
    doc.line(layout.margin + 8, signatureY, pageW - layout.margin - 8, signatureY)
    doc.setLineDashPattern([], 0)

    doc.setFontSize(layout.footerFontSize)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text('Firma / Sello de Cobranza', pageW / 2, signatureY + 4, {
      align: 'center',
    })
  }

  doc.setFontSize(layout.footerFontSize)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(120)
  const footerY = Math.min(pageH - layout.footerBottom, afterStatus + layout.sectionGap + 18)
  doc.text('¡Gracias por su pago puntual!', pageW / 2, footerY, {
    align: 'center',
    maxWidth: layout.usableWidth,
  })
  doc.text('Comprobante oficial de pago interno de cuota.', pageW / 2, footerY + 3.5, {
    align: 'center',
    maxWidth: layout.usableWidth,
  })

  return { doc, receiptNumber }
}
