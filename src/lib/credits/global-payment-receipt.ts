import { createReceiptDocument } from './receipt-document'
import { formatCurrency as formatCurrencyBase, getDisplayLocale } from '@/lib/currency'
import { getCreditPaymentMethodLabel, getCreditPaymentReceiptTarget, usesShortLabels } from './payment-receipt'
import { toPdfText, type CreditPaperFormat } from './paper'

/**
 * Comprobante del abono unificado: un solo pago repartido entre reparaciones y
 * cuotas de un mismo cliente.
 *
 * El boton "Imprimir" del modal llamaba a `window.print()` y sacaba la pantalla
 * entera con el modal encima, sin estilos de impresion. Este documento sigue el
 * formato del comprobante de pago de credito (mismo papel, misma tipografia en
 * negrita y negro puro) para que el cliente reciba un papel igual sin importar
 * desde donde se cobro.
 */
export type GlobalPaymentAllocation = {
  id: string
  type: 'repair' | 'installment'
  title: string
  allocatedAmount: number
  /** Lo que valia la deuda completa (la reparacion o la cuota). */
  totalAmount: number
  /** Lo que queda debiendo de esa deuda despues del pago. */
  newPending: number
}

export type GlobalPaymentReceiptInput = {
  receiptNumber: string
  paidAt: string | Date
  totalAmount: number
  paymentMethod: string
  bankName?: string | null
  referenceNumber?: string | null
  cardType?: 'debit' | 'credit' | null
  posNetwork?: string | null
  voucherNumber?: string | null
  lastFourDigits?: string | null
  notes?: string | null
  allocations: GlobalPaymentAllocation[]
  excessToStoreCredit: number
  /** Deudas del cliente que este pago no toco y siguen pendientes. */
  otherPendingAmount?: number | null
  customerName: string
  customerDocument?: string | null
  businessName?: string | null
  businessRuc?: string | null
  businessPhone?: string | null
  businessAddress?: string | null
  currency?: string
  locale?: string
  timeZone?: string
  historicalNote?: string
  accountSnapshotAvailable?: boolean
  coveredDebtsOnly?: boolean
}

/** `strong`: fila clave, se imprime mas grande. */
export type GlobalReceiptRow = { label: string; value: string; strong?: boolean }

type RowOptions = { compacto?: boolean }

export function buildGlobalPaymentClientRows(input: GlobalPaymentReceiptInput, opciones: RowOptions = {}): GlobalReceiptRow[] {
  const rows: GlobalReceiptRow[] = [{ label: 'Cliente', value: input.customerName }]
  if (input.customerDocument) rows.push({ label: opciones.compacto ? 'RUC / CI' : 'RUC / CI / ID', value: input.customerDocument })
  return rows
}

export function buildGlobalPaymentDetailRows(input: GlobalPaymentReceiptInput, opciones: RowOptions = {}): GlobalReceiptRow[] {
  const formatCurrency = (amount: number) => toPdfText(formatCurrencyBase(amount, { ...(input.currency ? { currency: input.currency } : {}), locale: input.locale, maximumFractionDigits: 2 }))
  const corto = opciones.compacto === true
  const rows: GlobalReceiptRow[] = [
    { label: corto ? 'PAGADO' : 'MONTO PAGADO', value: formatCurrency(input.totalAmount), strong: true },
  ]

  if (input.paymentMethod === 'card') {
    rows.push({ label: corto ? 'Método' : 'Método de Pago', value: `Tarjeta de ${input.cardType === 'credit' ? 'crédito' : 'débito'}` })
    if (input.posNetwork) rows.push({ label: corto ? 'Red' : 'Red POS', value: input.posNetwork })
    if (input.voucherNumber) rows.push({ label: corto ? 'Cupón' : 'Cupón POS N°', value: input.voucherNumber })
    if (input.lastFourDigits) rows.push({ label: 'Tarjeta', value: `**** ${input.lastFourDigits}` })
  } else if (input.paymentMethod === 'transfer') {
    rows.push({ label: corto ? 'Método' : 'Método de Pago', value: 'Transferencia' })
    if (input.bankName) rows.push({ label: 'Banco', value: input.bankName })
    if (input.referenceNumber) rows.push({ label: corto ? 'Ref.' : 'Comprobante N°', value: input.referenceNumber })
  } else {
    rows.push({ label: corto ? 'Método' : 'Método de Pago', value: getCreditPaymentMethodLabel(input.paymentMethod) })
  }

  if (input.notes?.trim()) rows.push({ label: corto ? 'Obs.' : 'Observaciones', value: input.notes.trim() })
  if (input.historicalNote) rows.push({ label: 'Histórico', value: input.historicalNote })
  return rows
}

/** Una fila por deuda cubierta, y el excedente que fue a saldo a favor. */
export function buildGlobalPaymentAllocationRows(input: GlobalPaymentReceiptInput, opciones: RowOptions = {}): GlobalReceiptRow[] {
  const formatCurrency = (amount: number) => toPdfText(formatCurrencyBase(amount, { ...(input.currency ? { currency: input.currency } : {}), locale: input.locale, maximumFractionDigits: 2 }))
  const rows: GlobalReceiptRow[] = input.allocations
    .filter(row => row.allocatedAmount > 0)
    .map(row => ({
      label: row.title,
      value: `${formatCurrency(row.allocatedAmount)}\n${row.newPending <= 0 ? 'Saldada' : `Queda ${formatCurrency(row.newPending)}`}`,
    }))

  if (input.excessToStoreCredit > 0) {
    rows.push({ label: opciones.compacto ? 'A FAVOR' : 'SALDO A FAVOR', value: `+${formatCurrency(input.excessToStoreCredit)}`, strong: true })
  }
  return rows
}

/**
 * Total, pagado y saldo de las deudas que cubrio este pago, en ese orden: las
 * tres cifras con las que el cliente controla lo que debe. Lo que el pago no
 * toco se suma aparte para que el saldo impreso no parezca el total adeudado.
 */
export function buildGlobalPaymentAccountRows(input: GlobalPaymentReceiptInput, opciones: RowOptions = {}): GlobalReceiptRow[] {
  const formatCurrency = (amount: number) => toPdfText(formatCurrencyBase(amount, { ...(input.currency ? { currency: input.currency } : {}), locale: input.locale, maximumFractionDigits: 2 }))
  if (input.accountSnapshotAvailable === false) return []
  const corto = opciones.compacto === true
  const cubiertas = input.allocations.filter(row => row.allocatedAmount > 0)
  if (cubiertas.length === 0) return []

  const total = cubiertas.reduce((sum, row) => sum + Math.max(0, row.totalAmount), 0)
  const saldo = cubiertas.reduce((sum, row) => sum + Math.max(0, row.newPending), 0)
  const otras = Math.max(0, input.otherPendingAmount ?? 0)

  const rows: GlobalReceiptRow[] = [
    { label: corto ? 'Total' : 'Total financiado', value: formatCurrency(total) },
    { label: corto ? 'Pagado' : 'Total pagado', value: formatCurrency(Math.max(0, total - saldo)) },
    {
      label: corto ? 'SALDO' : 'SALDO PENDIENTE',
      value: saldo === 0 ? `${formatCurrency(0)} (SALDADO)` : formatCurrency(saldo),
      strong: true,
    },
  ]

  if (otras > 0) {
    rows.push({ label: corto ? 'Otras deudas' : 'Otras deudas pendientes', value: formatCurrency(otras) })
    rows.push({ label: corto ? 'DEUDA TOTAL' : 'DEUDA TOTAL DEL CLIENTE', value: formatCurrency(saldo + otras), strong: true })
  }
  if (input.coveredDebtsOnly) rows.push({ label: 'Alcance', value: 'Saldo de las deudas incluidas en este pago.' })
  return rows
}

export async function createGlobalPaymentReceiptPdf(
  input: GlobalPaymentReceiptInput,
  options: { format?: CreditPaperFormat } = {},
) {
  const { default: autoTable } = await import('jspdf-autotable')

  const format: CreditPaperFormat = options.format ?? '80mm'
  const t = getCreditPaymentReceiptTarget(format)
  const compacto = usesShortLabels(t.pageWidthMm)

  const secciones: Array<[string, string, GlobalReceiptRow[]]> = [
    ['DATOS DEL CLIENTE', 'CLIENTE', buildGlobalPaymentClientRows(input, { compacto })],
    ['DETALLE DEL PAGO', 'PAGO', buildGlobalPaymentDetailRows(input, { compacto })],
    ['DEUDAS CUBIERTAS', 'CUBIERTO', buildGlobalPaymentAllocationRows(input, { compacto })],
    ['ESTADO DE CUENTA', 'CUENTA', buildGlobalPaymentAccountRows(input, { compacto })],
  ]

  const doc = await createReceiptDocument(t, (doc) => {
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const centro = pageW / 2
    const izq = t.contentLeftMm
    const der = pageW - t.contentLeftMm
    const texto = (value: string) => toPdfText(value)

    // Todo en negrita y negro puro: en termica el gris y el texto fino salen
    // lavados. La jerarquia la dan el tamaño y las bandas negras de los titulos.
    let y = t.isSheet ? 22 : 7
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(t.titleFontSize + 1)
    const nombre = doc.splitTextToSize(texto(input.businessName?.trim() || 'Comprobante de pago'), t.contentWidthMm)
    doc.text(nombre, centro, y, { align: 'center' })
    y += nombre.length * (t.titleFontSize + 1) * 0.42 + 1

    doc.setFontSize(t.metaFontSize)
    const identidad = [input.businessRuc ? `RUC ${input.businessRuc}` : '', input.businessPhone || ''].filter(Boolean).join('   -   ')
    if (identidad) {
      doc.text(texto(identidad), centro, y, { align: 'center', maxWidth: t.contentWidthMm })
      y += doc.splitTextToSize(identidad, t.contentWidthMm).length * t.metaFontSize * 0.42 + 1
    }
    if (input.businessAddress) {
      const dir = doc.splitTextToSize(texto(input.businessAddress), t.contentWidthMm)
      doc.text(dir, centro, y, { align: 'center' })
      y += dir.length * t.metaFontSize * 0.42 + 1
    }

    y += 2
    doc.setDrawColor(0)
    doc.setLineWidth(0.6)
    doc.line(izq, y, der, y)
    doc.setLineWidth(0.2)
    y += t.isSheet ? 8 : 5

    doc.setFontSize(t.receiptFontSize + 2)
    doc.text(compacto ? 'ABONO A CUENTA' : 'COMPROBANTE DE ABONO', centro, y, { align: 'center' })
    y += t.receiptFontSize * 0.5 + 2
    doc.setFontSize(t.receiptFontSize + 0.5)
    const numberLines = doc.splitTextToSize(texto(`N° ${input.receiptNumber}`), t.contentWidthMm)
    doc.text(numberLines, centro, y, { align: 'center' })
    y += numberLines.length * (t.receiptFontSize + 0.5) * 0.48 + 1.5
    doc.setFontSize(t.metaFontSize + 0.5)
    doc.text(texto(new Date(input.paidAt).toLocaleString(input.locale || getDisplayLocale(), { timeZone: input.timeZone })), centro, y, { align: 'center', maxWidth: t.contentWidthMm })
    y += t.metaFontSize * 0.42 + t.sectionGap

    let fin = y - t.sectionGap
    for (const [largo, corto, rows] of secciones) {
      if (rows.length === 0) continue
      autoTable(doc, {
        startY: fin + t.sectionGap,
        head: [[{ content: compacto ? corto : largo, colSpan: 2, styles: { halign: 'center' } }]],
        body: rows.map(row => [texto(row.label), texto(row.value)]),
        theme: 'grid',
        headStyles: { fillColor: [0, 0, 0], textColor: 255, fontStyle: 'bold', halign: 'center', fontSize: t.tableHeaderFontSize + 0.5 },
        bodyStyles: { fontSize: t.tableBodyFontSize + 0.3, fontStyle: 'bold', textColor: 0 },
        styles: { cellPadding: t.cellPadding, overflow: 'linebreak', lineColor: [0, 0, 0], lineWidth: 0.25 },
        columnStyles: { 0: { cellWidth: t.labelColumnWidth }, 1: { cellWidth: t.valueColumnWidth } },
        didParseCell: (data: { section: string; row: { index: number }; cell: { styles: { fontSize: number } } }) => {
          if (data.section === 'body' && rows[data.row.index]?.strong) data.cell.styles.fontSize = t.tableBodyFontSize + 1.8
        },
        margin: { left: izq, right: pageW - izq - t.contentWidthMm },
      })
      fin = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    }

    doc.setPage(doc.getNumberOfPages())
    const firmaY = fin + t.sectionGap + (t.isSheet ? 16 : 10)
    const pieY = firmaY + (t.isSheet ? 8 : 5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0)

    if (pieY + t.footerFontSize < pageH - t.footerBottom + 6) {
      doc.setDrawColor(0)
      doc.setLineWidth(0.3)
      doc.setLineDashPattern([1, 1], 0)
      doc.line(izq + t.contentWidthMm * 0.15, firmaY, der - t.contentWidthMm * 0.15, firmaY)
      doc.setLineDashPattern([], 0)
      doc.setLineWidth(0.2)
      doc.setFontSize(t.footerFontSize + 0.5)
      doc.text('Firma / Sello de cobranza', centro, firmaY + (t.isSheet ? 5 : 3.5), { align: 'center' })
    }

    doc.setFontSize(t.footerFontSize + 0.5)
    const pieFinal = t.isSheet ? Math.min(pageH - t.footerBottom, pieY + 10) : pieY + 6
    doc.text('Gracias por su pago. Conserve este comprobante.', centro, pieFinal, {
      align: 'center',
      maxWidth: t.contentWidthMm,
    })

    const footerLines = doc.splitTextToSize('Gracias por su pago. Conserve este comprobante.', t.contentWidthMm).length
    return pieFinal + footerLines * (t.footerFontSize + 0.5) * 0.42 + t.footerBottom
  })

  return { doc, receiptNumber: input.receiptNumber }
}
