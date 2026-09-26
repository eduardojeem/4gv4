import { formatCurrency, getDisplayLocale } from '@/lib/currency'
import { formatDateOnlyDisplay } from '@/lib/date-only'
import { formatCreditId, formatCustomerId } from '@/lib/utils'
import { CREDIT_PAPER_WIDTH_MM, type CreditPaperFormat } from './paper'

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
  /**
   * Datos del emisor. `businessName` ya existia en el tipo pero nunca se
   * dibujaba: el comprobante salia sin decir quien lo emitio, que es lo primero
   * que se le pide a un recibo cuando hay que reclamarlo.
   */
  businessName?: string | null
  businessRuc?: string | null
  businessPhone?: string | null
  businessAddress?: string | null
}

export const CREDIT_PAYMENT_RECEIPT_WIDTH_MM = 80
export const CREDIT_PAYMENT_RECEIPT_HEIGHT_MM = 220
export const CREDIT_PAYMENT_RECEIPT_MAX_HEIGHT_MM = 950

/** Alto de la barra de avance mas el aire que lleva arriba y abajo. */
export const ALTO_BARRA_AVANCE_MM = 9

/**
 * Debajo de este ancho las etiquetas largas se parten solas dentro de su celda
 * y la seccion ocupa el doble de alto. Una sola regla para el estimador y para
 * el dibujo: si difieren, el alto reservado no coincide con lo que se imprime.
 */
export function usesShortLabels(pageWidthMm: number) {
  return pageWidthMm < 70
}

export type CreditPaymentReceiptPdfOptions = {
  /** Ancho exacto del rollo, si se conoce. Ignorado cuando el formato es A4. */
  printerWidthMm?: number
  format?: CreditPaperFormat
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

export function buildCreditInfoRows(
  input: CreditPaymentReceiptInput,
  opciones: { compacto?: boolean } = {}
): ReceiptRow[] {
  const corto = opciones.compacto === true
  const creditCode = input.creditCode || formatCreditId(input.creditId)
  const customerCode = input.customerRuc || input.customerCode || formatCustomerId(input.customerId)

  const rows: ReceiptRow[] = [
    ['Cliente', input.customerName],
  ]

  if (customerCode) {
    rows.push([corto ? 'RUC / CI' : 'RUC / CI / ID', customerCode])
  }
  if (input.customerPhone) {
    rows.push(['Teléfono', input.customerPhone])
  }

  rows.push([corto ? 'Crédito' : 'Crédito Nº', creditCode])

  if (input.saleCode) {
    rows.push([corto ? 'Ticket' : 'Ticket Venta', input.saleCode])
  } else if (input.originLabel) {
    rows.push(['Origen', input.originLabel])
  }

  if (input.productSummary) {
    rows.push([corto ? 'Detalle' : 'Detalle Venta', input.productSummary])
  } else if (input.creditLabel) {
    rows.push(['Concepto', input.creditLabel])
  }

  if (typeof input.totalCreditAmount === 'number' && input.totalCreditAmount > 0) {
    const planText = input.totalInstallments ? ` (${input.totalInstallments} cuotas)` : ''
    rows.push([corto ? 'Financiado' : 'Total Financiado', `${formatCurrency(input.totalCreditAmount)}${planText}`])
  }

  return rows
}

export function buildPaymentDetailRows(
  input: CreditPaymentReceiptInput,
  opciones: { compacto?: boolean } = {}
): ReceiptRow[] {
  const corto = opciones.compacto === true
  const rows: ReceiptRow[] = []

  // La cuota que se abono y el avance del plan viven ahora en su propia
  // seccion: repetirlos aca hacia que el comprobante dijera lo mismo dos veces.

  if (input.installmentDueDate) {
    rows.push([corto ? 'Vence' : 'Vencimiento Cuota', formatDateOnlyDisplay(input.installmentDueDate, undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })])
  }

  if (typeof input.installmentAmount === 'number' && input.installmentAmount > 0) {
    rows.push([corto ? 'Valor' : 'Valor Cuota', formatCurrency(input.installmentAmount)])
  }

  // Monto pagado
  rows.push([corto ? 'ABONADO' : 'MONTO ABONADO', formatCurrency(input.paymentAmount)])
  rows.push([corto ? 'Método' : 'Método de Pago', getCreditPaymentMethodLabel(input.paymentMethod)])

  if (input.reference) {
    rows.push([corto ? 'Referencia' : 'Referencia / N° Trans.', input.reference])
  }

  if (input.notes) {
    rows.push([corto ? 'Obs.' : 'Observaciones', input.notes])
  }

  return rows
}

/**
 * Avance del plan de cuotas.
 *
 * `paidInstallmentsCount` llegaba en la entrada y no se dibujaba en ningun
 * lado: el comprobante decia que cuota se abono y cuantas quedaban sueltas en
 * otra seccion, pero nunca cuantas van pagadas del total. Con eso el cliente no
 * podia responder de un vistazo "voy 3 de 12".
 */
export type CreditInstallmentProgress = {
  /** Numero de la cuota que se acaba de abonar, si el pago fue a una sola. */
  current: number | null
  paid: number | null
  total: number | null
  pending: number | null
  /** Entre 0 y 1. Null cuando no se conoce el total. */
  ratio: number | null
}

export function getCreditInstallmentProgress(
  input: Pick<
    CreditPaymentReceiptInput,
    'installmentNumber' | 'totalInstallments' | 'paidInstallmentsCount' | 'pendingInstallmentsCount'
  >
): CreditInstallmentProgress {
  const total = typeof input.totalInstallments === 'number' && input.totalInstallments > 0
    ? Math.floor(input.totalInstallments)
    : null

  const paidCrudo = typeof input.paidInstallmentsCount === 'number'
    ? Math.max(0, Math.floor(input.paidInstallmentsCount))
    : null

  // Nunca mas cuotas pagadas que las que tiene el plan: un dato inconsistente no
  // puede terminar impreso como "13 de 12" en el papel del cliente.
  const paid = paidCrudo === null ? null : total === null ? paidCrudo : Math.min(paidCrudo, total)

  // Si se conoce el total, lo pendiente se deriva de el en vez de tomar el otro
  // contador: son dos consultas distintas y podrian no sumar.
  const pending = total !== null && paid !== null
    ? Math.max(0, total - paid)
    : typeof input.pendingInstallmentsCount === 'number'
      ? Math.max(0, Math.floor(input.pendingInstallmentsCount))
      : null

  return {
    current: typeof input.installmentNumber === 'number' && input.installmentNumber > 0
      ? Math.floor(input.installmentNumber)
      : null,
    paid,
    total,
    pending,
    ratio: total !== null && paid !== null ? Math.min(1, paid / total) : null,
  }
}

/**
 * En 58 mm la columna de etiquetas no llega ni a 21 mm: "CUOTA ABONADA" se
 * parte en dos lineas y la seccion ocupa el doble de alto por nada. En papel
 * angosto se usan etiquetas cortas en vez de dejar que se quiebren solas.
 */
export function buildInstallmentPlanRows(
  input: CreditPaymentReceiptInput,
  opciones: { compacto?: boolean } = {}
): ReceiptRow[] {
  const p = getCreditInstallmentProgress(input)
  const rows: ReceiptRow[] = []
  const corto = opciones.compacto === true

  // "Cuota 3 de 12": la posicion dentro del plan, que es lo primero que el
  // cliente busca en el papel.
  if (p.current !== null) {
    rows.push([
      corto ? 'CUOTA' : 'CUOTA ABONADA',
      p.total !== null ? `${p.current} de ${p.total}` : `N° ${p.current}`,
    ])
  }

  if (p.paid !== null && p.total !== null) {
    const porcentaje = Math.round((p.paid / p.total) * 100)
    rows.push([corto ? 'Pagadas' : 'Cuotas pagadas', `${p.paid} de ${p.total}  (${porcentaje}%)`])
  } else if (p.paid !== null) {
    rows.push([corto ? 'Pagadas' : 'Cuotas pagadas', String(p.paid)])
  }

  if (p.pending !== null) {
    rows.push([
      corto ? 'Faltan' : 'Cuotas que faltan',
      p.pending === 0
        ? (corto ? 'Ninguna' : 'Ninguna, plan completado')
        : `${p.pending} cuota${p.pending !== 1 ? 's' : ''}`,
    ])
  }

  return rows
}

/**
 * Cuotas pagadas contando el pago que se acaba de registrar.
 *
 * La pantalla recibe los conteos como props, calculados sobre el estado que
 * tenia la pagina antes del cobro. Imprimir ese numero le entrega al cliente un
 * comprobante que no cuenta el pago que tiene en la mano: pago la cuota 4 y el
 * papel dice "3 de 12". El saldo ya se corregia asi restando el importe; esto
 * hace lo mismo con el conteo.
 */
export function projectPaidInstallments(entrada: {
  paidBefore?: number | null
  totalInstallments?: number | null
  paymentAmount: number
  /** Lo que faltaba de la cuota que se estaba pagando. */
  installmentOutstanding?: number | null
  /** Saldo del credito entero antes del pago. */
  remainingBefore?: number | null
  /** El cobro era por el credito completo, no por una cuota. */
  paysWholeCredit?: boolean
}): { paid: number | null; pending: number | null } {
  const total = typeof entrada.totalInstallments === 'number' && entrada.totalInstallments > 0
    ? Math.floor(entrada.totalInstallments)
    : null
  const antes = typeof entrada.paidBefore === 'number' ? Math.max(0, Math.floor(entrada.paidBefore)) : null

  if (antes === null) return { paid: null, pending: null }

  let paid = antes

  if (
    entrada.paysWholeCredit &&
    typeof entrada.remainingBefore === 'number' &&
    entrada.paymentAmount >= entrada.remainingBefore
  ) {
    // Se salda todo el credito: no queda ninguna cuota abierta.
    paid = total ?? antes
  } else if (
    typeof entrada.installmentOutstanding === 'number' &&
    entrada.installmentOutstanding > 0 &&
    entrada.paymentAmount >= entrada.installmentOutstanding
  ) {
    paid = antes + 1
  }
  // Un pago parcial no cierra la cuota, asi que el conteo no se mueve.

  if (total !== null) paid = Math.min(paid, total)

  return { paid, pending: total !== null ? Math.max(0, total - paid) : null }
}

export function buildAccountStatusRows(
  input: CreditPaymentReceiptInput,
  opciones: { compacto?: boolean } = {}
): ReceiptRow[] {
  const corto = opciones.compacto === true
  const rows: ReceiptRow[] = []

  if (typeof input.currentCreditBalance === 'number') {
    const balance = Math.max(0, input.currentCreditBalance)
    if (balance === 0) {
      // El simbolo salia escrito a mano: en una tienda que factura en reales o
      // en dolares el comprobante decia "Gs. 0".
      rows.push(['SALDO PENDIENTE', `${formatCurrency(0)} (TOTALMENTE SALDADO)`])
    } else {
      rows.push([corto ? 'SALDO' : 'SALDO PENDIENTE (FALTA)', formatCurrency(balance)])
    }
  }

  if (input.nextDueDate) {
    const nextAmountText = typeof input.nextDueAmount === 'number' && input.nextDueAmount > 0 ? ` (${formatCurrency(input.nextDueAmount)})` : ''
    rows.push([corto ? 'Próx. venc.' : 'Próximo Vencimiento', `${formatDateOnlyDisplay(input.nextDueDate, undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })}${nextAmountText}`])
  }

  return rows
}

export function getCreditPaymentReceiptHeight(input: CreditPaymentReceiptInput, printerWidthMm = CREDIT_PAYMENT_RECEIPT_WIDTH_MM) {
  const pageWidthMm = Math.max(48, Math.min(90, printerWidthMm))
  const layout = getCreditPaymentReceiptLayout(pageWidthMm)
  const compacto = usesShortLabels(pageWidthMm)
  const creditRows = buildCreditInfoRows(input, { compacto })
  const paymentRows = buildPaymentDetailRows(input, { compacto })
  const planRows = buildInstallmentPlanRows(input, { compacto })
  const statusRows = buildAccountStatusRows(input, { compacto })

  const estimatedHeight =
    layout.headerHeight +
    14 +
    estimateTableHeight(creditRows, layout) +
    layout.sectionGap +
    estimateTableHeight(paymentRows, layout) +
    layout.sectionGap +
    // La seccion del plan incluye la barra de avance, que ocupa alto propio: sin
    // contarla el rollo se corta justo donde el cliente busca cuanto le falta.
    (planRows.length > 0 ? estimateTableHeight(planRows, layout) + ALTO_BARRA_AVANCE_MM + layout.sectionGap : 0) +
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

export type CreditPaymentReceiptRenderTarget = {
  pageWidthMm: number
  pageHeightMm: number
  contentLeftMm: number
  contentWidthMm: number
  labelColumnWidth: number
  valueColumnWidth: number
  titleFontSize: number
  receiptFontSize: number
  metaFontSize: number
  tableHeaderFontSize: number
  tableBodyFontSize: number
  footerFontSize: number
  cellPadding: number
  sectionGap: number
  footerBottom: number
  isSheet: boolean
}

/**
 * Traduce el formato de papel elegido a medidas concretas.
 *
 * En rollo el contenido ocupa el ancho util completo. En A4 no: una tabla de
 * etiqueta y valor estirada a 180 mm deja la etiqueta contra un borde y el
 * valor contra el otro, con un vacio en el medio. Se usa una columna centrada
 * de 120 mm, que es lo que hace que el documento se lea como un recibo y no
 * como una tira estirada sobre una hoja.
 */
export function getCreditPaymentReceiptTarget(
  format: CreditPaperFormat,
  printerWidthMm?: number
): CreditPaymentReceiptRenderTarget {
  if (format === 'A4') {
    const pageWidthMm = 210
    const contentWidthMm = 120
    return {
      pageWidthMm,
      pageHeightMm: 297,
      contentLeftMm: (pageWidthMm - contentWidthMm) / 2,
      contentWidthMm,
      labelColumnWidth: contentWidthMm * 0.38,
      valueColumnWidth: contentWidthMm * 0.62,
      titleFontSize: 14,
      receiptFontSize: 10,
      metaFontSize: 8.5,
      tableHeaderFontSize: 9,
      tableBodyFontSize: 8.5,
      footerFontSize: 8,
      cellPadding: 2.2,
      sectionGap: 6,
      footerBottom: 16,
      isSheet: true,
    }
  }

  const pageWidthMm = Math.max(48, Math.min(90, printerWidthMm ?? CREDIT_PAPER_WIDTH_MM[format]))
  const layout = getCreditPaymentReceiptLayout(pageWidthMm)
  return {
    pageWidthMm,
    pageHeightMm: 0, // en rollo la calcula el generador segun el contenido
    contentLeftMm: layout.margin,
    contentWidthMm: layout.usableWidth,
    labelColumnWidth: layout.labelColumnWidth,
    valueColumnWidth: layout.valueColumnWidth,
    titleFontSize: layout.titleFontSize,
    receiptFontSize: layout.receiptFontSize,
    metaFontSize: layout.metaFontSize,
    tableHeaderFontSize: layout.tableHeaderFontSize,
    tableBodyFontSize: layout.tableBodyFontSize,
    footerFontSize: layout.footerFontSize,
    cellPadding: layout.cellPadding,
    sectionGap: layout.sectionGap,
    footerBottom: layout.footerBottom,
    isSheet: false,
  }
}

export async function createCreditPaymentReceiptPdf(
  input: CreditPaymentReceiptInput,
  options: CreditPaymentReceiptPdfOptions = {}
) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const format: CreditPaperFormat = options.format ?? '80mm'
  const t = getCreditPaymentReceiptTarget(format, options.printerWidthMm)

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: t.isSheet ? 'a4' : [t.pageWidthMm, getCreditPaymentReceiptHeight(input, t.pageWidthMm)],
  })

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const centro = pageW / 2
  const izq = t.contentLeftMm
  const der = pageW - t.contentLeftMm

  const receiptNumber = buildCreditPaymentReceiptNumber(input.paymentId)
  const paidAt = input.paymentDate ? new Date(input.paymentDate) : new Date()
  const compacto = usesShortLabels(t.pageWidthMm)
  const creditRows = buildCreditInfoRows(input, { compacto })
  const paymentRows = buildPaymentDetailRows(input, { compacto })
  const planRows = buildInstallmentPlanRows(input, { compacto })
  const progreso = getCreditInstallmentProgress(input)
  const statusRows = buildAccountStatusRows(input, { compacto })

  const tablaMargen = { left: izq, right: pageW - izq - t.contentWidthMm }

  // ─── Emisor ─────────────────────────────────────────────────────────────
  // Antes la cabecera era un rectangulo negro con el titulo dentro. No decia de
  // que comercio salia el comprobante — `businessName` llegaba en la entrada y
  // se descartaba — y en termica esa mancha gasta cabezal y sale gris sucia.
  // Ahora encabeza el negocio, y la jerarquia la dan el tamaño y una linea, que
  // salen igual en termica, laser y tinta.
  let y = t.isSheet ? 22 : 7

  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(t.titleFontSize)
  const nombreEmisor = input.businessName?.trim() || 'Comprobante de pago'
  const lineasNombre = doc.splitTextToSize(nombreEmisor, t.contentWidthMm)
  doc.text(lineasNombre, centro, y, { align: 'center' })
  y += lineasNombre.length * t.titleFontSize * 0.42 + 1

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(t.metaFontSize)
  doc.setTextColor(90)
  const identidad = [
    input.businessRuc ? `RUC ${input.businessRuc}` : '',
    input.businessPhone || '',
  ].filter(Boolean).join('   -   ')
  if (identidad) {
    doc.text(identidad, centro, y, { align: 'center', maxWidth: t.contentWidthMm })
    y += t.metaFontSize * 0.42 + 1
  }
  if (input.businessAddress) {
    const dir = doc.splitTextToSize(input.businessAddress, t.contentWidthMm)
    doc.text(dir, centro, y, { align: 'center' })
    y += dir.length * t.metaFontSize * 0.42 + 1
  }
  doc.setTextColor(0)

  y += 2
  doc.setDrawColor(30, 58, 138)
  doc.setLineWidth(0.6)
  doc.line(izq, y, der, y)
  doc.setLineWidth(0.2)
  y += t.isSheet ? 8 : 5

  // ─── Titulo del documento ───────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(t.receiptFontSize + 1)
  doc.text('COMPROBANTE DE PAGO', centro, y, { align: 'center' })
  y += t.receiptFontSize * 0.48 + 2

  doc.setFontSize(t.receiptFontSize)
  doc.setTextColor(30, 58, 138)
  doc.text(receiptNumber, centro, y, { align: 'center' })
  doc.setTextColor(0)
  y += t.receiptFontSize * 0.48 + 1.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(t.metaFontSize)
  doc.setTextColor(100)
  doc.text(paidAt.toLocaleString(getDisplayLocale()), centro, y, { align: 'center', maxWidth: t.contentWidthMm })
  doc.setTextColor(0)
  y += t.metaFontSize * 0.42 + t.sectionGap

  const seccion = (
    titulo: string,
    filas: ReceiptRow[],
    color: [number, number, number],
    valorEnNegrita: boolean,
    startY: number
  ) => {
    autoTable(doc, {
      startY,
      // El titulo abarca las dos columnas. Sin colSpan quedaba encerrado en la
      // columna de etiquetas —28 mm en 80 mm de papel— y "DETALLE DEL PAGO
      // EFECTUADO" se partia en tres lineas dentro de su propia cabecera.
      head: [[{ content: titulo, colSpan: 2, styles: { halign: 'center' } }]],
      body: filas,
      theme: 'grid',
      headStyles: {
        fillColor: color,
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
        fontSize: t.tableHeaderFontSize,
      },
      bodyStyles: { fontSize: t.tableBodyFontSize },
      styles: { cellPadding: t.cellPadding, overflow: 'linebreak' },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: t.labelColumnWidth, textColor: [71, 85, 105] },
        1: { cellWidth: t.valueColumnWidth, fontStyle: valorEnNegrita ? 'bold' : 'normal' },
      },
      margin: tablaMargen,
    })
    return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
  }

  // Los titulos tambien se acortan en papel angosto: "DETALLE DEL PAGO
  // EFECTUADO" se quebraba en tres lineas dentro de su propia cabecera.
  const titulo = (largo: string, corto: string) => (compacto ? corto : largo)

  let fin = seccion(titulo('DATOS DEL CLIENTE Y VENTA', 'CLIENTE'), creditRows, [30, 58, 138], false, y)
  fin = seccion(titulo('DETALLE DEL PAGO EFECTUADO', 'PAGO'), paymentRows, [16, 115, 74], true, fin + t.sectionGap)

  // ─── Plan de cuotas ─────────────────────────────────────────────────────
  // Va entre lo que se acaba de pagar y lo que se sigue debiendo, que es el
  // orden en que se lee: cuanto pague ahora, donde voy, cuanto me falta.
  if (planRows.length > 0) {
    fin = seccion(titulo('PLAN DE CUOTAS', 'CUOTAS'), planRows, [124, 45, 18], true, fin + t.sectionGap)

    // Una casilla por cuota, llenas las pagadas. Es la misma pregunta del
    // cliente respondida sin leer: cuantas van y cuantas faltan. Se dibuja en
    // vez de una barra proporcional porque las casillas SON las cuotas.
    if (progreso.total !== null && progreso.paid !== null && progreso.total <= 60) {
      const barraY = fin + 3
      const alto = t.isSheet ? 4 : 3
      const ancho = t.contentWidthMm
      const casilla = ancho / progreso.total

      doc.setDrawColor(120)
      doc.setLineWidth(0.2)

      for (let i = 0; i < progreso.total; i++) {
        const x = izq + i * casilla
        if (i < progreso.paid) {
          doc.setFillColor(30, 58, 138)
          doc.rect(x, barraY, casilla, alto, 'FD')
        } else {
          doc.rect(x, barraY, casilla, alto, 'D')
        }
      }

      doc.setDrawColor(0)
      fin = barraY + alto
    }
  }

  if (statusRows.length > 0) {
    fin = seccion(titulo('ESTADO DE CUENTA', 'CUENTA'), statusRows, [71, 85, 105], true, fin + t.sectionGap)
  }

  // ─── Firma y pie ────────────────────────────────────────────────────────
  // Van sobre la ultima pagina y solo si entran. El pie se ubicaba con un
  // minimo contra el alto de pagina, asi que en un comprobante largo terminaba
  // encima de la ultima tabla.
  doc.setPage(doc.getNumberOfPages())

  const firmaY = fin + t.sectionGap + (t.isSheet ? 16 : 10)
  const pieY = firmaY + (t.isSheet ? 8 : 5)

  if (pieY + t.footerFontSize < pageH - t.footerBottom + 6) {
    doc.setDrawColor(170)
    doc.setLineDashPattern([1, 1], 0)
    doc.line(izq + t.contentWidthMm * 0.15, firmaY, der - t.contentWidthMm * 0.15, firmaY)
    doc.setLineDashPattern([], 0)

    doc.setFontSize(t.footerFontSize)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text('Firma / Sello de cobranza', centro, firmaY + (t.isSheet ? 5 : 3.5), { align: 'center' })
    doc.setTextColor(0)
  }

  doc.setFontSize(t.footerFontSize)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(120)
  const pieFinal = Math.min(pageH - t.footerBottom, pieY + (t.isSheet ? 10 : 6))
  doc.text('Gracias por su pago. Conserve este comprobante.', centro, pieFinal, {
    align: 'center',
    maxWidth: t.contentWidthMm,
  })
  doc.setTextColor(0)
  doc.setFont('helvetica', 'normal')

  return { doc, receiptNumber }
}
