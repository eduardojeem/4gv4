import { formatCurrency, getDisplayLocale } from '@/lib/currency'
import { formatDateOnlyDisplay } from '@/lib/date-only'
import { formatCreditId } from '@/lib/utils'
import { getCreditPaperMetrics } from './paper'
import { findNextDueInstallment } from './credit-history-ticket'

/**
 * Estado de cuenta en hoja A4.
 *
 * El problema mas serio de la version anterior no se veia en un documento
 * corto: la identificacion del emisor solo se dibujaba en la primera pagina y
 * el pie solo en la ultima, y no habia numeracion. Un estado de cuenta de cinco
 * hojas salia con tres hojas del medio sin nombre de empresa, sin fecha y sin
 * numero de pagina; sueltas sobre un mostrador no se sabia de quien eran ni si
 * faltaba alguna. Ahora la cabecera y el pie se estampan en cada pagina, al
 * final, cuando ya se sabe cuantas son.
 */

export interface CreditHistoryItem {
  id: string
  creditCode?: string
  principal: number
  interestRate: number
  termMonths: number
  startDate: string
  status: 'active' | 'completed' | 'defaulted' | 'cancelled' | string
  totalPaid?: number
  remainingBalance?: number
  installments?: Array<{
    number: number
    dueDate: string
    amount: number
    amountPaid: number
    status: string
  }>
}

export interface CreditHistoryPdfInput {
  customerName: string
  customerCode?: string
  customerPhone?: string
  companyName: string
  companyRuc?: string
  companyPhone?: string
  companyAddress?: string
  generatedAt?: Date
  credits: CreditHistoryItem[]
  totalDebt: number
  totalPaid: number
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  completed: 'Completado',
  defaulted: 'En mora',
  cancelled: 'Anulado',
  paid: 'Pagado',
  pending: 'Pendiente',
  overdue: 'Vencido',
  late: 'Atrasado',
  partial: 'Parcial',
}

function statusLabel(status: string) {
  return STATUS_LABELS[status] || status
}

const AZUL: [number, number, number] = [30, 64, 175]
const GRIS_TEXTO: [number, number, number] = [100, 116, 139]

/** Un credito en mora sigue vigente para el cliente, aunque no sea `active`. */
function vigentes(credits: CreditHistoryItem[]) {
  return credits.filter((c) => c.status === 'active' || c.status === 'defaulted').length
}

export async function createCreditHistoryPdf(input: CreditHistoryPdfInput) {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const m = getCreditPaperMetrics('A4')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = m.marginMm
  const usableW = pageW - margin * 2
  const now = input.generatedAt || new Date()

  // Espacio que la cabecera estampada al final ocupa arriba de cada hoja. Se
  // reserva desde el principio para que ninguna tabla escriba debajo de ella.
  const ALTO_CABECERA = 26
  const ALTO_PIE = 12

  let y = ALTO_CABECERA + 10

  // ─── Cliente ──────────────────────────────────────────────────────────
  doc.setFillColor(243, 244, 246)
  doc.roundedRect(margin, y, usableW, 18, 2, 2, 'F')

  doc.setTextColor(0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text(input.customerName, margin + 4, y + 7, { maxWidth: usableW - 8 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const meta = [
    input.customerCode ? `Código: ${input.customerCode}` : '',
    input.customerPhone ? `Tel: ${input.customerPhone}` : '',
  ].filter(Boolean)
  if (meta.length) {
    doc.text(meta.join('   |   '), margin + 4, y + 13, { maxWidth: usableW - 8 })
  }

  // ─── Resumen ──────────────────────────────────────────────────────────
  y += 24

  const proxima = findNextDueInstallment(
    input.credits.map((c) => ({
      creditCode: c.creditCode,
      id: c.id,
      principal: c.principal,
      remainingBalance: c.remainingBalance,
      status: c.status,
      startDate: c.startDate,
      termMonths: c.termMonths,
      installments: c.installments,
    }))
  )

  // Cuatro celdas en vez de tres: el proximo vencimiento es la respuesta a la
  // pregunta con la que el cliente pide el documento, y antes no figuraba.
  const celdas: Array<{ rotulo: string; valor: string; color: [number, number, number]; fondo: [number, number, number] }> = [
    { rotulo: 'CRÉDITOS VIGENTES', valor: String(vigentes(input.credits)), color: AZUL, fondo: [239, 246, 255] },
    { rotulo: 'TOTAL PAGADO', valor: formatCurrency(input.totalPaid), color: [22, 163, 74], fondo: [240, 253, 244] },
    { rotulo: 'SALDO PENDIENTE', valor: formatCurrency(input.totalDebt), color: [220, 38, 38], fondo: [254, 242, 242] },
    {
      rotulo: 'PRÓXIMO VENCIMIENTO',
      valor: proxima
        ? `${formatDateOnlyDisplay(proxima.dueDate, undefined, { day: '2-digit', month: '2-digit', year: '2-digit' })}  ${formatCurrency(proxima.amount)}`
        : 'Sin cuotas pendientes',
      color: [120, 53, 15],
      fondo: [255, 251, 235],
    },
  ]

  const anchoCelda = (usableW - 3 * 2) / 4
  celdas.forEach((celda, i) => {
    const x = margin + i * (anchoCelda + 2)
    doc.setFillColor(...celda.fondo)
    doc.roundedRect(x, y, anchoCelda, 15, 2, 2, 'F')

    doc.setFontSize(6.2)
    doc.setTextColor(...GRIS_TEXTO)
    doc.setFont('helvetica', 'normal')
    doc.text(celda.rotulo, x + 3, y + 5, { maxWidth: anchoCelda - 6 })

    // El monto se achica si no entra: en guaranies una cifra de ocho digitos a
    // 11 pt se desbordaba sobre la celda siguiente.
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...celda.color)
    let tam = 10.5
    doc.setFontSize(tam)
    while (tam > 6 && doc.getTextWidth(celda.valor) > anchoCelda - 6) {
      tam -= 0.5
      doc.setFontSize(tam)
    }
    doc.text(celda.valor, x + 3, y + 11, { maxWidth: anchoCelda - 6 })
  })

  doc.setTextColor(0)
  doc.setFont('helvetica', 'normal')

  // ─── Tabla de creditos ────────────────────────────────────────────────
  y += 21

  autoTable(doc, {
    startY: y,
    head: [['Código', 'Capital', 'Interés', 'Plazo', 'Inicio', 'Estado', 'Saldo']],
    body: input.credits.map((credit) => [
      credit.creditCode || formatCreditId(credit.id),
      formatCurrency(credit.principal),
      `${credit.interestRate}%`,
      `${credit.termMonths} meses`,
      formatDateOnlyDisplay(credit.startDate, undefined, { day: '2-digit', month: '2-digit', year: '2-digit' }),
      statusLabel(credit.status),
      formatCurrency(credit.remainingBalance ?? 0),
    ]),
    theme: 'striped',
    headStyles: { fillColor: AZUL, textColor: 255, fontStyle: 'bold', fontSize: m.tableHeadSize, halign: 'center' },
    bodyStyles: { fontSize: m.tableBodySize, cellPadding: m.cellPadding },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left' },
      1: { halign: 'right' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin, top: ALTO_CABECERA + 6, bottom: ALTO_PIE },
    styles: { overflow: 'linebreak' },
  })

  let currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // ─── Cuotas de cada credito ───────────────────────────────────────────
  for (const credit of input.credits) {
    if (!credit.installments || credit.installments.length === 0) continue

    // Se salta de hoja si el titulo no entra con al menos una fila debajo: un
    // encabezado solo al pie de la hoja obliga a dar vuelta la pagina para
    // saber a que credito pertenece la tabla.
    if (currentY + 18 > pageH - ALTO_PIE) {
      doc.addPage()
      currentY = ALTO_CABECERA + 10
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...AZUL)
    doc.text(
      `Cuotas — ${credit.creditCode || formatCreditId(credit.id)} (${formatCurrency(credit.principal)})`,
      margin, currentY, { maxWidth: usableW }
    )
    doc.setTextColor(0)
    currentY += 4

    autoTable(doc, {
      startY: currentY,
      head: [['#', 'Vencimiento', 'Monto', 'Pagado', 'Pendiente', 'Estado']],
      body: credit.installments.map((inst) => [
        `#${inst.number}`,
        formatDateOnlyDisplay(inst.dueDate, undefined, { day: '2-digit', month: '2-digit', year: '2-digit' }),
        formatCurrency(inst.amount),
        formatCurrency(inst.amountPaid),
        formatCurrency(Math.max(0, inst.amount - inst.amountPaid)),
        statusLabel(inst.status),
      ]),
      theme: 'grid',
      headStyles: { fillColor: GRIS_TEXTO, textColor: 255, fontSize: 7, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 7, cellPadding: 1.8 },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right', fontStyle: 'bold' },
        5: { halign: 'center' },
      },
      margin: { left: margin + 5, right: margin + 5, top: ALTO_CABECERA + 6, bottom: ALTO_PIE },
    })

    currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  }

  // ─── Cabecera y pie en TODAS las paginas ──────────────────────────────
  // Recien aca se sabe cuantas hojas son, que es lo que permite escribir
  // "Pagina 2 de 5": sin ese total, una hoja perdida pasa inadvertida.
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)

    doc.setFillColor(...AZUL)
    doc.rect(0, 0, pageW, ALTO_CABECERA, 'F')

    doc.setTextColor(255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(input.companyName, margin, 11, { maxWidth: usableW * 0.55 })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    const emisor = [
      input.companyRuc ? `RUC ${input.companyRuc}` : '',
      input.companyPhone || '',
      input.companyAddress || '',
    ].filter(Boolean).join('   ·   ')
    if (emisor) doc.text(emisor, margin, 17, { maxWidth: usableW * 0.55 })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('ESTADO DE CUENTA', pageW - margin, 11, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(
      `${input.customerName}  ·  ${now.toLocaleDateString(getDisplayLocale(), { day: '2-digit', month: 'long', year: 'numeric' })}`,
      pageW - margin, 17, { align: 'right', maxWidth: usableW * 0.42 }
    )
    doc.text(`Página ${p} de ${total}`, pageW - margin, 21.5, { align: 'right' })

    doc.setTextColor(150)
    doc.setFont('helvetica', 'italic')
    doc.setFontSize(7)
    doc.text(
      `Emitido el ${now.toLocaleString(getDisplayLocale())} — ${input.companyName}`,
      pageW / 2, pageH - 7, { align: 'center', maxWidth: usableW }
    )
    doc.setTextColor(0)
    doc.setFont('helvetica', 'normal')
  }

  return doc
}
