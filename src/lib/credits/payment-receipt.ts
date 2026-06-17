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
  creditId: string
  creditCode?: string | null
  creditTypeLabel?: string | null
  originLabel?: string | null
  creditLabel?: string | null
  saleCode?: string | null
  productSummary?: string | null
  installmentNumber?: number | null
  installmentDueDate?: string | null
  installmentAmount?: number | null
  currentCreditBalance?: number | null
}

export const CREDIT_PAYMENT_RECEIPT_WIDTH_MM = 80
export const CREDIT_PAYMENT_RECEIPT_HEIGHT_MM = 220
export const CREDIT_PAYMENT_RECEIPT_MAX_HEIGHT_MM = 900

export type CreditPaymentReceiptPdfOptions = {
  printerWidthMm?: number
}

export function getCreditPaymentReceiptLayout(pageWidthMm: number) {
  const margin = Math.max(3, Math.min(5, pageWidthMm * 0.055))
  const usableWidth = Math.max(1, pageWidthMm - margin * 2)
  const labelColumnWidth = Math.max(18, Math.min(28, usableWidth * 0.35))
  const isNarrow = pageWidthMm < 70

  return {
    margin,
    usableWidth,
    labelColumnWidth,
    valueColumnWidth: Math.max(1, usableWidth - labelColumnWidth),
    headerHeight: isNarrow ? 22 : 24,
    titleFontSize: isNarrow ? 8.5 : 10,
    receiptFontSize: isNarrow ? 7 : 8,
    metaFontSize: isNarrow ? 6.3 : 7,
    tableHeaderFontSize: isNarrow ? 7 : 8,
    tableBodyFontSize: isNarrow ? 6.2 : 7,
    footerFontSize: isNarrow ? 5.6 : 6.5,
    cellPadding: isNarrow ? 1.1 : 1.5,
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

function buildCreditInfoRows(input: CreditPaymentReceiptInput): ReceiptRow[] {
  const creditCode = input.creditCode || formatCreditId(input.creditId)
  const customerCode = input.customerCode || formatCustomerId(input.customerId)

  return [
    ['Cliente', input.customerName],
    ...(customerCode ? [['ID cliente', customerCode] as ReceiptRow] : []),
    ['Credito', creditCode],
    ...(input.creditTypeLabel ? [['Tipo', input.creditTypeLabel] as ReceiptRow] : []),
    ...(input.originLabel ? [['Origen', input.originLabel] as ReceiptRow] : []),
    ...(input.saleCode ? [['Ticket', input.saleCode] as ReceiptRow] : []),
    ...(input.creditLabel ? [['Concepto', input.creditLabel] as ReceiptRow] : []),
    ...(input.productSummary ? [['Detalle', input.productSummary] as ReceiptRow] : []),
  ]
}

function buildPaymentDetailRows(input: CreditPaymentReceiptInput): ReceiptRow[] {
  return [
    ['Monto pagado', formatCurrency(input.paymentAmount)],
    ['Metodo', getCreditPaymentMethodLabel(input.paymentMethod)],
    ...(input.installmentNumber ? [['Cuota', `#${input.installmentNumber}`] as ReceiptRow] : []),
    ...(input.installmentDueDate ? [['Vencimiento cuota', new Date(input.installmentDueDate).toLocaleDateString('es-AR')] as ReceiptRow] : []),
    ...(typeof input.installmentAmount === 'number' ? [['Monto cuota', formatCurrency(input.installmentAmount)] as ReceiptRow] : []),
    ...(input.reference ? [['Referencia', input.reference] as ReceiptRow] : []),
    ...(input.notes ? [['Notas', input.notes] as ReceiptRow] : []),
    ...(typeof input.currentCreditBalance === 'number' ? [['Saldo actual credito', formatCurrency(Math.max(0, input.currentCreditBalance))] as ReceiptRow] : []),
  ]
}

export function getCreditPaymentReceiptHeight(input: CreditPaymentReceiptInput, printerWidthMm = CREDIT_PAYMENT_RECEIPT_WIDTH_MM) {
  const pageWidthMm = Math.max(48, Math.min(90, printerWidthMm))
  const layout = getCreditPaymentReceiptLayout(pageWidthMm)
  const creditRows = buildCreditInfoRows(input)
  const paymentRows = buildPaymentDetailRows(input)
  const estimatedHeight =
    layout.headerHeight +
    11 +
    estimateTableHeight(creditRows, layout) +
    layout.sectionGap +
    estimateTableHeight(paymentRows, layout) +
    layout.sectionGap +
    16

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

  doc.setFillColor(37, 99, 235)
  doc.rect(0, 0, pageW, layout.headerHeight, 'F')
  doc.setTextColor(255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(layout.titleFontSize)
  doc.text('COMPROBANTE DE PAGO', pageW / 2, layout.headerHeight * 0.42, {
    align: 'center',
    maxWidth: layout.usableWidth,
  })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(layout.receiptFontSize)
  doc.text(receiptNumber, pageW / 2, layout.headerHeight - 6, {
    align: 'center',
    maxWidth: layout.usableWidth,
  })
  doc.setTextColor(0)

  doc.setFontSize(layout.metaFontSize)
  doc.setTextColor(100)
  doc.text(`Emitido: ${paidAt.toLocaleString('es-AR')}`, pageW / 2, layout.headerHeight + 6, {
    align: 'center',
    maxWidth: layout.usableWidth,
  })
  doc.setTextColor(0)

  autoTable(doc, {
    startY: layout.headerHeight + 11,
    head: [['Cliente y credito', '']],
    body: creditRows,
    theme: 'grid',
    headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: layout.tableHeaderFontSize },
    bodyStyles: { fontSize: layout.tableBodyFontSize },
    styles: { cellPadding: layout.cellPadding, overflow: 'linebreak' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: layout.labelColumnWidth },
      1: { cellWidth: layout.valueColumnWidth },
    },
    margin: { left: layout.margin, right: layout.margin },
  })

  const afterCredit = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  autoTable(doc, {
    startY: afterCredit + layout.sectionGap,
    head: [['Detalle del pago', '']],
    body: paymentRows,
    theme: 'grid',
    headStyles: { fillColor: [22, 163, 74], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: layout.tableHeaderFontSize },
    bodyStyles: { fontSize: layout.tableBodyFontSize },
    styles: { cellPadding: layout.cellPadding, overflow: 'linebreak' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: layout.labelColumnWidth },
      1: { cellWidth: layout.valueColumnWidth },
    },
    margin: { left: layout.margin, right: layout.margin },
  })

  doc.setFontSize(layout.footerFontSize)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(130)
  const afterPayment = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  const footerY = Math.min(pageH - layout.footerBottom, afterPayment + layout.sectionGap + 5)
  doc.text('Este comprobante es valido como constancia del pago registrado.', pageW / 2, footerY, {
    align: 'center',
    maxWidth: layout.usableWidth,
  })

  return { doc, receiptNumber }
}
