import { createReceiptDocument } from './receipt-document'
import { registerThermalPrintDocument } from './thermal-print'
import { installmentProgressLayout } from './installment-progress-layout'
import { formatCurrency as formatCurrencyBase, getDisplayLocale } from '@/lib/currency'
import { formatDateOnlyDisplay } from '@/lib/date-only'
import { formatCreditId, formatCustomerId } from '@/lib/utils'
import { CREDIT_PAPER_WIDTH_MM, creditPrintableWidthMm, toPdfText, type CreditPaperFormat, type CreditPrintableFit } from './paper'

export type CreditPaymentReceiptMethod = 'cash' | 'card' | 'transfer' | string | null | undefined

export type CreditPaymentReceiptInput = {
  paymentId: string
  receiptNumber?: string
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
  /** Recorded payments; never infer these from a potentially inconsistent header. */
  totalPaidAmount?: number | null
  currency?: string
  locale?: string
  timeZone?: string
  historicalNote?: string
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

  // El telefono del cliente no aporta nada a un recibo que el cliente ya tiene
  // en la mano: se saco para dejar solo lo que identifica el pago.
  if (customerCode) {
    rows.push([corto ? 'RUC / CI' : 'RUC / CI / ID', customerCode])
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

  // El total financiado va en el estado de cuenta, junto a lo pagado y al
  // saldo, para que las tres cifras se lean juntas.

  return rows
}

export function buildPaymentDetailRows(
  input: CreditPaymentReceiptInput,
  opciones: { compacto?: boolean } = {}
): ReceiptRow[] {
  const formatCurrency = (amount: number) => toPdfText(formatCurrencyBase(amount, { ...(input.currency ? { currency: input.currency } : {}), locale: input.locale, maximumFractionDigits: 2 }))
  const corto = opciones.compacto === true
  const rows: ReceiptRow[] = []

  // La cuota que se abono y el avance del plan viven ahora en su propia
  // seccion: repetirlos aca hacia que el comprobante dijera lo mismo dos veces.

  if (input.installmentDueDate) {
    rows.push([corto ? 'Vence' : 'Vencimiento Cuota', formatDateOnlyDisplay(input.installmentDueDate, undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })])
  }

  // El valor de la cuota solo se muestra si difiere de lo abonado: cuando se
  // paga la cuota justa, eran dos filas con el mismo monto.
  if (
    typeof input.installmentAmount === 'number' &&
    input.installmentAmount > 0 &&
    Math.abs(input.installmentAmount - input.paymentAmount) >= 0.005
  ) {
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
  if (input.historicalNote) rows.push(['Histórico', input.historicalNote])

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

  // "Pagadas" y "Faltan" dicen lo mismo de dos formas (y la barra de casillas
  // lo vuelve a decir). Queda "Pagadas" solo cuando no hay una cuota puntual.
  if (p.current === null && p.paid !== null) {
    rows.push([
      corto ? 'Pagadas' : 'Cuotas pagadas',
      p.total !== null ? `${p.paid} de ${p.total}` : String(p.paid),
    ])
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
  const formatCurrency = (amount: number) => toPdfText(formatCurrencyBase(amount, { ...(input.currency ? { currency: input.currency } : {}), locale: input.locale, maximumFractionDigits: 2 }))
  const corto = opciones.compacto === true
  const rows: ReceiptRow[] = []

  // Total financiado, lo pagado y lo que falta, en ese orden: las tres cifras
  // con las que el cliente controla su credito. Los pagos vienen del registro
  // real: una diferencia entre cabecera y cuotas no es dinero cobrado.
  const total = typeof input.totalCreditAmount === 'number' && input.totalCreditAmount > 0
    ? input.totalCreditAmount
    : null
  if (total !== null) {
    rows.push([corto ? 'Total créd.' : 'Total financiado', formatCurrency(total)])
  }
  if (typeof input.totalPaidAmount === 'number' && Number.isFinite(input.totalPaidAmount)) {
    rows.push([corto ? 'Pagado' : 'Total pagado', formatCurrency(Math.max(0, input.totalPaidAmount))])
  }

  if (typeof input.currentCreditBalance === 'number') {
    const balance = Math.max(0, input.currentCreditBalance)
    if (balance === 0) {
      // El simbolo salia escrito a mano: en una tienda que factura en reales o
      // en dolares el comprobante decia "Gs. 0".
      rows.push(['SALDO PENDIENTE', `${formatCurrency(0)} (TOTALMENTE SALDADO)`])
    } else {
      rows.push([corto ? 'SALDO' : 'SALDO PENDIENTE', formatCurrency(balance)])
    }
  }

  if (input.nextDueDate) {
    const nextAmountText = typeof input.nextDueAmount === 'number' && input.nextDueAmount > 0 ? ` (${formatCurrency(input.nextDueAmount)})` : ''
    rows.push([corto ? 'Próx. venc.' : 'Próximo Vencimiento', `${formatDateOnlyDisplay(input.nextDueDate, undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })}${nextAmountText}`])
  }

  return rows
}

/** Las filas clave llevan la etiqueta en mayusculas y se imprimen mas grandes. */
function esFilaDestacada(etiqueta: string) {
  return /[A-Z]/.test(etiqueta) && etiqueta === etiqueta.toUpperCase()
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
  printerWidthMm?: number,
  fit?: CreditPrintableFit
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
  // El contenido va centrado dentro del ancho que la impresora realmente
  // imprime. Antes ocupaba todo el papel menos 4 mm por lado y en varias
  // térmicas se cortaba a los costados.
  const contentWidthMm = creditPrintableWidthMm(format === '58mm' ? '58mm' : '80mm', fit, pageWidthMm)
  const labelColumnWidth = Math.max(16, Math.min(30, contentWidthMm * 0.4))
  return {
    pageWidthMm,
    pageHeightMm: 0, // en rollo la calcula el generador segun el contenido
    contentLeftMm: (pageWidthMm - contentWidthMm) / 2,
    contentWidthMm,
    labelColumnWidth,
    valueColumnWidth: Math.max(1, contentWidthMm - labelColumnWidth),
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
  const { default: autoTable } = await import('jspdf-autotable')

  const format: CreditPaperFormat = options.format ?? '80mm'
  const t = getCreditPaymentReceiptTarget(format, options.printerWidthMm)

  const receiptNumber = input.receiptNumber || buildCreditPaymentReceiptNumber(input.paymentId)
  const paidAt = input.paymentDate ? new Date(input.paymentDate) : new Date()
  const progreso = getCreditInstallmentProgress(input)
  const doc = await createReceiptDocument(t, (doc) => {
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const centro = pageW / 2
    const izq = t.contentLeftMm
    const der = pageW - t.contentLeftMm

    const compacto = usesShortLabels(t.pageWidthMm)
    const creditRows = buildCreditInfoRows(input, { compacto })
    const paymentRows = buildPaymentDetailRows(input, { compacto })
    const planRows = buildInstallmentPlanRows(input, { compacto })
    const statusRows = buildAccountStatusRows(input, { compacto })

    const tablaMargen = { left: izq, right: pageW - izq - t.contentWidthMm }

    // ─── Emisor ─────────────────────────────────────────────────────────────
    // Todo el comprobante va en negrita y negro puro: en termica el gris y el
    // texto fino salen lavados y a los pocos meses no se leen. La jerarquia la
    // dan el tamaño, las bandas negras de los titulos y las lineas.
    let y = t.isSheet ? 22 : 7

    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(t.titleFontSize + 1)
    const nombreEmisor = input.businessName?.trim() || 'Comprobante de pago'
    const lineasNombre = doc.splitTextToSize(nombreEmisor, t.contentWidthMm)
    doc.text(lineasNombre, centro, y, { align: 'center' })
    y += lineasNombre.length * (t.titleFontSize + 1) * 0.42 + 1

    doc.setFontSize(t.metaFontSize)
    const identidad = [
      input.businessRuc ? `RUC ${input.businessRuc}` : '',
      input.businessPhone || '',
    ].filter(Boolean).join('   -   ')
    if (identidad) {
      doc.text(identidad, centro, y, { align: 'center', maxWidth: t.contentWidthMm })
      y += doc.splitTextToSize(identidad, t.contentWidthMm).length * t.metaFontSize * 0.42 + 1
    }
    if (input.businessAddress) {
      const dir = doc.splitTextToSize(input.businessAddress, t.contentWidthMm)
      doc.text(dir, centro, y, { align: 'center' })
      y += dir.length * t.metaFontSize * 0.42 + 1
    }

    y += 2
    doc.setDrawColor(0)
    doc.setLineWidth(0.6)
    doc.line(izq, y, der, y)
    doc.setLineWidth(0.2)
    y += t.isSheet ? 8 : 5

    // ─── Titulo del documento ───────────────────────────────────────────────
    doc.setFontSize(t.receiptFontSize + 2)
    doc.text('COMPROBANTE DE PAGO', centro, y, { align: 'center' })
    y += t.receiptFontSize * 0.5 + 2

    doc.setFontSize(t.receiptFontSize + 0.5)
    const numberLines = doc.splitTextToSize(`N° ${receiptNumber}`, t.contentWidthMm)
    doc.text(numberLines, centro, y, { align: 'center' })
    y += numberLines.length * (t.receiptFontSize + 0.5) * 0.48 + 1.5

    doc.setFontSize(t.metaFontSize + 0.5)
    doc.text(toPdfText(paidAt.toLocaleString(input.locale || getDisplayLocale(), { timeZone: input.timeZone })), centro, y, { align: 'center', maxWidth: t.contentWidthMm })
    y += t.metaFontSize * 0.42 + t.sectionGap

    const seccion = (titulo: string, filas: ReceiptRow[], startY: number) => {
      autoTable(doc, {
        startY,
        // El titulo abarca las dos columnas. Sin colSpan quedaba encerrado en la
        // columna de etiquetas —28 mm en 80 mm de papel— y "DETALLE DEL PAGO
        // EFECTUADO" se partia en tres lineas dentro de su propia cabecera.
        head: [[{ content: titulo, colSpan: 2, styles: { halign: 'center' } }]],
        body: filas,
        theme: 'grid',
        headStyles: {
          fillColor: [0, 0, 0],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: t.tableHeaderFontSize + 0.5,
        },
        bodyStyles: { fontSize: t.tableBodyFontSize + 0.3, fontStyle: 'bold', textColor: 0 },
        styles: { cellPadding: t.cellPadding, overflow: 'linebreak', lineColor: [0, 0, 0], lineWidth: 0.25 },
        columnStyles: {
          0: { cellWidth: t.labelColumnWidth },
          1: { cellWidth: t.valueColumnWidth },
        },
        // Las filas con etiqueta en mayusculas (monto abonado, cuota, saldo) son
        // las que el cliente busca: van mas grandes que el resto.
        didParseCell: (data: { section: string; row: { raw: unknown }; cell: { styles: { fontSize: number } } }) => {
          if (data.section !== 'body') return
          const etiqueta = String((data.row.raw as ReceiptRow)[0] ?? '')
          if (esFilaDestacada(etiqueta)) {
            data.cell.styles.fontSize = t.tableBodyFontSize + 1.8
          }
        },
        margin: tablaMargen,
      })
      return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    }

    // Los titulos tambien se acortan en papel angosto: "DETALLE DEL PAGO
    // EFECTUADO" se quebraba en tres lineas dentro de su propia cabecera.
    const titulo = (largo: string, corto: string) => (compacto ? corto : largo)

    let fin = seccion(titulo('DATOS DEL CLIENTE', 'CLIENTE'), creditRows, y)
    fin = seccion(titulo('DETALLE DEL PAGO', 'PAGO'), paymentRows, fin + t.sectionGap)

    // ─── Plan de cuotas ─────────────────────────────────────────────────────
    // Va entre lo que se acaba de pagar y lo que se sigue debiendo, que es el
    // orden en que se lee: cuanto pague ahora, donde voy, cuanto me falta.
    if (planRows.length > 0) {
      fin = seccion(titulo('PLAN DE CUOTAS', 'CUOTAS'), planRows, fin + t.sectionGap)

      // Una casilla por cuota, llenas las pagadas. Es la misma pregunta del
      // cliente respondida sin leer: cuantas van y cuantas faltan. Se dibuja en
      // vez de una barra proporcional porque las casillas SON las cuotas.
      const layout = progreso.total !== null && progreso.paid !== null
        ? installmentProgressLayout(progreso.total, progreso.paid, t.contentWidthMm)
        : null
      if (layout) {
        let barraY = fin + 3
        if (t.isSheet && barraY + layout.height + 9 > pageH - 15) {
          doc.addPage()
          barraY = 15
        }
        const inicio = izq + (t.contentWidthMm - layout.width) / 2

        doc.setDrawColor(0)
        doc.setLineWidth(0.25)
        doc.setFillColor(0, 0, 0)

        for (const box of layout.boxes) {
          doc.rect(inicio + box.x + 0.15, barraY + box.y + 0.15, box.size - 0.3, box.size - 0.3, box.paid ? 'FD' : 'D')
        }
        doc.setFontSize(t.tableBodyFontSize)
        doc.text(toPdfText(layout.label), centro, barraY + layout.height + 4, { align: 'center' })

        doc.setLineWidth(0.2)
        fin = barraY + layout.height + 6
      }
    }

    if (statusRows.length > 0) {
      fin = seccion(titulo('ESTADO DE CUENTA', 'CUENTA'), statusRows, fin + t.sectionGap)
    }

    // ─── Firma y pie ────────────────────────────────────────────────────────
    // Van sobre la ultima pagina y solo si entran. El pie se ubicaba con un
    // minimo contra el alto de pagina, asi que en un comprobante largo terminaba
    // encima de la ultima tabla.
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

  if (!t.isSheet) {
    const compacto = usesShortLabels(t.pageWidthMm)
    registerThermalPrintDocument(doc, {
      title: 'COMPROBANTE DE PAGO',
      issuer: [input.businessName || 'Comprobante de pago', input.businessRuc ? `RUC ${input.businessRuc}` : '', input.businessPhone || '', input.businessAddress || ''],
      metadata: [`N° ${receiptNumber}`, paidAt.toLocaleString(input.locale || getDisplayLocale(), { timeZone: input.timeZone })],
      sections: [
        { title: 'DATOS DEL CLIENTE', rows: buildCreditInfoRows(input, { compacto }) },
        { title: 'DETALLE DEL PAGO', rows: buildPaymentDetailRows(input, { compacto }) },
        {
          title: 'PLAN DE CUOTAS', rows: buildInstallmentPlanRows(input, { compacto }),
          installmentProgress: progreso.paid !== null && progreso.total !== null
            ? { paid: progreso.paid, total: progreso.total }
            : undefined,
        },
        { title: 'ESTADO DE CUENTA', rows: buildAccountStatusRows(input, { compacto }) },
      ],
      contentWidthMm: t.contentWidthMm, fontSizePt: t.tableBodyFontSize + 0.3,
      footer: 'Gracias por su pago. Conserve este comprobante.', signature: true,
    })
  }
  return { doc, receiptNumber }
}
