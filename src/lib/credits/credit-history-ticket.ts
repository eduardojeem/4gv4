import { formatCurrency, getDisplayLocale } from '@/lib/currency'
import { formatCreditId } from '@/lib/utils'
import {
  getCreditPaperMetrics,
  type CreditPaperFormat,
  type CreditPaperMetrics,
} from './paper'

/**
 * Estado de cuenta en rollo termico (58 mm y 80 mm).
 *
 * Tres cosas separan este archivo de la version anterior:
 *
 * 1. El ancho era 80 mm escrito a mano. Un comercio con impresora de 58 mm
 *    recibia un documento cortado por los costados.
 * 2. La altura se estimaba a ojo y se recortaba a 2000 mm. Pasado ese punto el
 *    contenido desaparecia sin aviso: un cliente con muchos creditos recibia un
 *    estado de cuenta incompleto que parecia completo. Ahora se dibuja dos
 *    veces, la primera solo para medir, asi que la altura es exacta.
 * 3. El diseño usaba bandas de relleno. Una impresora termica es monocroma: un
 *    bloque oscuro sale como una mancha gris, tarda mas y gasta cabezal. Aca la
 *    jerarquia la dan el tamaño, la negrita y las lineas.
 */

export interface CreditHistoryTicketInput {
  customerName: string
  customerCode?: string
  customerPhone?: string
  companyName: string
  companyRuc?: string
  companyPhone?: string
  companyAddress?: string
  credits: Array<{
    creditCode?: string
    id: string
    principal: number
    remainingBalance?: number
    status: string
    startDate: string
    termMonths: number
    installments?: Array<{
      number: number
      dueDate: string
      amount: number
      amountPaid: number
      status: string
    }>
  }>
  totalDebt: number
  totalPaid: number
}

export type CreditHistoryTicketOptions = {
  format?: CreditPaperFormat
  generatedAt?: Date
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  completed: 'Pagado',
  defaulted: 'Mora',
  cancelled: 'Anulado',
  paid: 'Pagado',
  pending: 'Pend.',
  overdue: 'Vencido',
  late: 'Atrasado',
  partial: 'Parcial',
}

function statusLabel(s: string) {
  return STATUS_LABELS[s] || s
}

/** Alto de la pagina de medicion: mas que cualquier estado de cuenta real. */
const ALTO_DE_MEDICION_MM = 6000

type Doc = {
  setFont: (f: string, s?: string) => void
  setFontSize: (n: number) => void
  setTextColor: (...a: number[]) => void
  setDrawColor: (...a: number[]) => void
  setLineWidth: (n: number) => void
  setLineDashPattern: (p: number[], o: number) => void
  text: (t: string | string[], x: number, y: number, o?: Record<string, unknown>) => void
  line: (x1: number, y1: number, x2: number, y2: number) => void
  splitTextToSize: (t: string, w: number) => string[]
}

/**
 * Un credito en mora sigue siendo un credito vigente para el cliente: contar
 * solo los `active` hacia que alguien con todo atrasado leyera "0 creditos
 * activos" arriba de un saldo que si debia.
 */
function vigentes(credits: CreditHistoryTicketInput['credits']) {
  return credits.filter((c) => c.status === 'active' || c.status === 'defaulted').length
}

/**
 * La linea mas util del documento, y la que no estaba: cuando y cuanto hay que
 * pagar la proxima vez.
 */
export function findNextDueInstallment(credits: CreditHistoryTicketInput['credits']) {
  let mejor: { dueDate: string; amount: number } | null = null
  for (const credit of credits) {
    if (credit.status === 'cancelled' || credit.status === 'completed') continue
    for (const inst of credit.installments ?? []) {
      if (inst.status === 'paid') continue
      const falta = Math.max(0, inst.amount - inst.amountPaid)
      if (falta <= 0) continue
      if (!mejor || new Date(inst.dueDate) < new Date(mejor.dueDate)) {
        mejor = { dueDate: inst.dueDate, amount: falta }
      }
    }
  }
  return mejor
}

function separador(doc: Doc, m: CreditPaperMetrics, y: number, punteado = true) {
  doc.setDrawColor(0)
  doc.setLineWidth(0.2)
  if (punteado) doc.setLineDashPattern([0.5, 0.5], 0)
  doc.line(m.marginMm, y, m.pageWidthMm - m.marginMm, y)
  if (punteado) doc.setLineDashPattern([], 0)
}

/** Escribe un texto que puede ocupar varias lineas y devuelve el alto usado. */
function parrafo(
  doc: Doc,
  texto: string,
  x: number,
  y: number,
  ancho: number,
  altoLinea: number,
  opciones: Record<string, unknown> = {}
) {
  const lineas = doc.splitTextToSize(texto, ancho)
  doc.text(lineas, x, y, opciones)
  return lineas.length * altoLinea
}

/**
 * Dibuja el documento completo y devuelve la posicion final. Se ejecuta dos
 * veces: una sobre la pagina de medicion y otra sobre la definitiva.
 */
function dibujar(
  doc: Doc,
  autoTable: (doc: unknown, options: Record<string, unknown>) => void,
  input: CreditHistoryTicketInput,
  m: CreditPaperMetrics,
  ahora: Date
): number {
  const centro = m.pageWidthMm / 2
  const derecha = m.pageWidthMm - m.marginMm
  let y = m.marginMm + 3

  // ─── Emisor ───────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(m.titleSize)
  y += parrafo(doc, input.companyName, centro, y, m.contentWidthMm, m.titleSize * 0.42, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(m.smallSize)
  const identidad = [
    input.companyRuc ? `RUC ${input.companyRuc}` : '',
    input.companyPhone || '',
  ].filter(Boolean).join('  -  ')
  if (identidad) {
    y += parrafo(doc, identidad, centro, y + 1, m.contentWidthMm, m.smallSize * 0.42, { align: 'center' }) + 1
  }
  if (input.companyAddress) {
    y += parrafo(doc, input.companyAddress, centro, y + 1, m.contentWidthMm, m.smallSize * 0.42, { align: 'center' }) + 1
  }

  y += 2.5
  separador(doc, m, y, false)
  y += 4

  // ─── Titulo ───────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(m.headingSize)
  doc.text('ESTADO DE CUENTA', centro, y, { align: 'center' })
  y += m.lineGap

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(m.smallSize)
  doc.setTextColor(90)
  doc.text(
    `${ahora.toLocaleDateString(getDisplayLocale())} ${ahora.toLocaleTimeString(getDisplayLocale(), { hour: '2-digit', minute: '2-digit' })}`,
    centro, y, { align: 'center' }
  )
  doc.setTextColor(0)
  y += m.lineGap + 1

  // ─── Cliente ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(m.bodySize)
  y += parrafo(doc, input.customerName, m.marginMm, y, m.contentWidthMm, m.bodySize * 0.42)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(m.smallSize)
  const datosCliente = [
    input.customerCode ? `Cod. ${input.customerCode}` : '',
    input.customerPhone ? `Tel. ${input.customerPhone}` : '',
  ].filter(Boolean).join('   ')
  if (datosCliente) {
    doc.text(datosCliente, m.marginMm, y + 1)
    y += m.smallSize * 0.42 + 1
  }

  y += 2.5
  separador(doc, m, y)
  y += 4

  // ─── Lo que el cliente busca primero ──────────────────────────────────
  // Saldo y proximo vencimiento van arriba del detalle: son la razon por la que
  // se pide el documento.
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(m.smallSize)
  doc.text('SALDO PENDIENTE', m.marginMm, y)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(m.headingSize)
  doc.text(formatCurrency(input.totalDebt), derecha, y, { align: 'right' })
  y += m.lineGap + 1

  const proxima = findNextDueInstallment(input.credits)
  if (proxima) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(m.smallSize)
    doc.text('Proximo vencimiento', m.marginMm, y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(m.bodySize)
    doc.text(
      `${new Date(proxima.dueDate).toLocaleDateString(getDisplayLocale())}  ${formatCurrency(proxima.amount)}`,
      derecha, y, { align: 'right' }
    )
    y += m.lineGap
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(m.smallSize)
  doc.text(`Creditos vigentes: ${vigentes(input.credits)}`, m.marginMm, y)
  doc.text(`Pagado: ${formatCurrency(input.totalPaid)}`, derecha, y, { align: 'right' })
  y += m.lineGap

  y += 1
  separador(doc, m, y)
  y += 4

  // ─── Detalle por credito ──────────────────────────────────────────────
  const angosto = m.format === '58mm'

  for (const credit of input.credits) {
    const codigo = credit.creditCode || formatCreditId(credit.id)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(m.bodySize)
    doc.text(codigo, m.marginMm, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(m.smallSize)
    doc.text(statusLabel(credit.status), derecha, y, { align: 'right' })
    y += m.lineGap

    doc.setFontSize(m.smallSize)
    doc.setTextColor(90)
    doc.text(`${formatCurrency(credit.principal)} - ${credit.termMonths}m`, m.marginMm, y)
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.text(`Saldo ${formatCurrency(credit.remainingBalance ?? 0)}`, derecha, y, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    y += m.lineGap - 0.5

    if (credit.installments && credit.installments.length > 0) {
      // En 58 mm no entran cinco columnas legibles. Se sacrifica "Pagado", que
      // se deduce del monto y del estado, antes que encoger todo hasta lo ilegible.
      const head = angosto
        ? [['#', 'Venc.', 'Monto', 'Estado']]
        : [['#', 'Venc.', 'Monto', 'Pagado', 'Estado']]

      const body = credit.installments.map((inst) => {
        const venc = new Date(inst.dueDate).toLocaleDateString(getDisplayLocale(), { day: '2-digit', month: '2-digit' })
        return angosto
          ? [String(inst.number), venc, formatCurrency(inst.amount), statusLabel(inst.status)]
          : [String(inst.number), venc, formatCurrency(inst.amount), formatCurrency(inst.amountPaid), statusLabel(inst.status)]
      })

      const u = m.contentWidthMm
      const columnStyles = angosto
        ? {
            0: { halign: 'center', cellWidth: u * 0.12 },
            1: { halign: 'center', cellWidth: u * 0.23 },
            2: { halign: 'right', cellWidth: u * 0.38 },
            3: { halign: 'center', cellWidth: u * 0.27 },
          }
        : {
            0: { halign: 'center', cellWidth: u * 0.10 },
            1: { halign: 'center', cellWidth: u * 0.19 },
            2: { halign: 'right', cellWidth: u * 0.26 },
            3: { halign: 'right', cellWidth: u * 0.24 },
            4: { halign: 'center', cellWidth: u * 0.21 },
          }

      autoTable(doc, {
        startY: y,
        head,
        body,
        theme: 'plain',
        // Sin relleno: en termica una trama gris sale sucia. La cabecera se
        // distingue por la negrita y por la linea inferior.
        headStyles: {
          fontStyle: 'bold',
          fontSize: m.tableHeadSize,
          cellPadding: { top: 0.4, bottom: 1, left: 0.5, right: 0.5 },
          lineWidth: { bottom: 0.2 },
          lineColor: [0, 0, 0],
        },
        bodyStyles: { fontSize: m.tableBodySize, cellPadding: m.cellPadding },
        columnStyles,
        margin: { left: m.marginMm, right: m.marginMm },
        tableWidth: m.contentWidthMm,
      })

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 2.5
    }

    doc.setLineDashPattern([0.3, 0.8], 0)
    doc.setDrawColor(150)
    doc.setLineWidth(0.15)
    doc.line(m.marginMm + 8, y, m.pageWidthMm - m.marginMm - 8, y)
    doc.setLineDashPattern([], 0)
    doc.setDrawColor(0)
    y += 4
  }

  // ─── Pie ──────────────────────────────────────────────────────────────
  doc.setFontSize(m.smallSize)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(110)
  y += parrafo(doc, 'Documento informativo. Conservelo como referencia de su estado de cuenta.',
    centro, y, m.contentWidthMm, m.smallSize * 0.42, { align: 'center' })
  doc.setTextColor(0)

  // Aire de corte: el papel avanza antes de cortarse y sin este margen la
  // ultima linea queda pegada al filo.
  return y + m.marginMm + 4
}

export async function createCreditHistoryTicket(
  input: CreditHistoryTicketInput,
  options: CreditHistoryTicketOptions = {}
) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const format: CreditPaperFormat = options.format === '58mm' ? '58mm' : '80mm'
  const m = getCreditPaperMetrics(format)
  const ahora = options.generatedAt ?? new Date()

  // Primera pasada: se dibuja sobre una pagina deliberadamente larga solo para
  // saber cuanto ocupa de verdad. Es la unica forma de no cortar contenido con
  // una altura fija ni desperdiciar medio metro de rollo.
  const medicion = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [m.pageWidthMm, ALTO_DE_MEDICION_MM] })
  const altoReal = dibujar(medicion as unknown as Doc, autoTable as never, input, m, ahora)

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [m.pageWidthMm, Math.max(60, Math.ceil(altoReal))],
  })
  dibujar(doc as unknown as Doc, autoTable as never, input, m, ahora)

  return doc
}

/** Se mantiene por compatibilidad con quien importe el ancho por defecto. */
export const TICKET_WIDTH_MM = 80
